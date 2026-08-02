import { app, net } from "electron";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  SECRET_PLACEHOLDER,
  type XtreamFetchRequest,
  type XtreamFetchResult,
} from "../shared/ipc.js";
import { readCredential } from "./credentials.js";
import { record } from "./logs.js";

/**
 * Panel requests, made here rather than in the renderer.
 *
 * The renderer builds a URL carrying SECRET_PLACEHOLDER instead of the
 * password and hands it over; the real secret is substituted in this process
 * and never crosses the bridge. net.fetch is deliberate: it goes through
 * Chromium's stack, so the DNS-over-HTTPS override applies and there is no
 * CORS preflight to satisfy.
 */

const CACHE_DIR_NAME = "xtream-cache";

/** Entries older than this are swept on startup regardless of their own TTL. */
const MAX_ENTRY_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheFile {
  savedAt: number;
  body: string;
}

export function substituteSecret(template: string, secret: string): string {
  // The placeholder may have been percent-encoded while the URL was built, so
  // both spellings have to be replaced.
  return template
    .split(encodeURIComponent(SECRET_PLACEHOLDER))
    .join(encodeURIComponent(secret))
    .split(SECRET_PLACEHOLDER)
    .join(encodeURIComponent(secret));
}

function cacheDir(): string {
  return join(app.getPath("userData"), CACHE_DIR_NAME);
}

/**
 * Keyed on the template, which still holds the placeholder rather than the
 * password — so no secret reaches the filename or the disk.
 */
function cacheKey(urlTemplate: string): string {
  return createHash("sha256").update(urlTemplate).digest("hex").slice(0, 32);
}

async function readCache(key: string, maxAgeMs: number): Promise<string | null> {
  try {
    const raw = await readFile(join(cacheDir(), `${key}.json`), "utf8");
    const parsed = JSON.parse(raw) as CacheFile;
    if (typeof parsed?.body !== "string" || typeof parsed?.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > maxAgeMs) return null;
    return parsed.body;
  } catch {
    return null;
  }
}

async function writeCache(key: string, body: string): Promise<void> {
  try {
    await mkdir(cacheDir(), { recursive: true });
    const payload: CacheFile = { savedAt: Date.now(), body };
    await writeFile(join(cacheDir(), `${key}.json`), JSON.stringify(payload), "utf8");
  } catch (error) {
    // A cache that cannot be written is a slowdown, never a failure.
    record(`[xtream] önbellek yazılamadı: ${String(error)}`);
  }
}

export async function fetchXtream(request: XtreamFetchRequest): Promise<XtreamFetchResult> {
  const maxAgeMs = request.maxAgeMs ?? 0;
  const key = cacheKey(request.urlTemplate);

  if (maxAgeMs > 0) {
    const cached = await readCache(key, maxAgeMs);
    if (cached !== null) return { ok: true, body: cached, fromCache: true };
  }

  const secret = readCredential(request.credentialRef);
  if (secret === null) {
    return { ok: false, message: "Kaynağın giriş bilgileri okunamadı", status: 401 };
  }

  const url = substituteSecret(request.urlTemplate, secret);

  try {
    const response = await net.fetch(url, { redirect: "follow" });
    if (!response.ok) {
      return {
        ok: false,
        message: `HTTP ${response.status} — ${response.statusText}`,
        status: response.status,
      };
    }

    const body = await response.text();
    if (maxAgeMs > 0) await writeCache(key, body);
    return { ok: true, body, fromCache: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen ağ hatası";
    // The URL is not logged: it carries the password once substituted.
    record(`[xtream] istek başarısız: ${message}`);
    return { ok: false, message, status: 0 };
  }
}

export async function clearXtreamCache(): Promise<void> {
  await rm(cacheDir(), { recursive: true, force: true });
}

export async function xtreamCacheBytes(): Promise<number> {
  try {
    const names = await readdir(cacheDir());
    let total = 0;
    for (const name of names) {
      const info = await stat(join(cacheDir(), name));
      total += info.size;
    }
    return total;
  } catch {
    return 0;
  }
}

/** Drops stale entries so an abandoned source does not keep its data forever. */
export async function pruneXtreamCache(): Promise<void> {
  try {
    const names = await readdir(cacheDir());
    const cutoff = Date.now() - MAX_ENTRY_AGE_MS;

    for (const name of names) {
      const path = join(cacheDir(), name);
      const info = await stat(path);
      if (info.mtimeMs < cutoff) await rm(path, { force: true });
    }
  } catch {
    // No cache directory yet, nothing to prune.
  }
}
