"use client";

import {
  HttpError,
  XtreamClient,
  parseXtreamCredentials,
  withRequestQueue,
  type HttpClient,
  type PlaylistSource,
} from "@iptv/core";
import { readCredential } from "@iptv/db";

import { getDesktopBridge } from "./platform";
import { getHttpClient } from "./http";

/**
 * One place to build a panel client.
 *
 * On the desktop the password never reaches this process: the URL is built
 * with the bridge's placeholder and the main process substitutes the real
 * secret, fetches, and answers with the body. In the browser there is no such
 * escape hatch, so the credential is read locally as before.
 */

/**
 * Lifetime for per-title reads such as episode lists and movie details, which
 * are asked for again every time a detail page opens and rarely change.
 *
 * Deliberately NOT used by the catalog import: refreshing a playlist exists to
 * pick up what changed, so that path always goes to the panel.
 */
export const CATALOG_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function bridgeHttpClient(
  credentialRef: string,
  maxAgeMs: number,
  userAgent: string | null,
): HttpClient {
  const bridge = getDesktopBridge();
  if (!bridge) throw new Error("Masaüstü köprüsü yok");

  async function body(url: string): Promise<string> {
    const result = await bridge!.xtreamFetch({
      credentialRef,
      urlTemplate: url,
      maxAgeMs,
      userAgent,
    });
    if (!result.ok) throw new HttpError(result.message, result.status, url);
    return result.body;
  }

  return {
    text: (url) => body(url),

    async json<T>(url: string): Promise<T> {
      const raw = (await body(url)).trim();
      // Panels answer an unknown action with a blank body rather than a 404.
      if (!raw) return [] as unknown as T;
      try {
        return JSON.parse(raw) as T;
      } catch {
        const preview = raw.slice(0, 120).replace(/\s+/g, " ");
        throw new HttpError(`Geçersiz JSON yanıtı: "${preview}"`, 0, url);
      }
    },
  };
}

export interface XtreamRuntimeOptions {
  /** Cache lifetime for this client's reads. Defaults to no caching. */
  maxAgeMs?: number;
}

/**
 * Returns null when the source is not an Xtream panel or its credentials are
 * missing, which callers treat as "nothing to fetch".
 */
export async function createXtreamClient(
  source: PlaylistSource,
  options: XtreamRuntimeOptions = {},
): Promise<XtreamClient | null> {
  if (source.kind !== "xtream" || !source.username) return null;

  const bridge = getDesktopBridge();

  if (bridge && source.credentialRef) {
    const credentials = parseXtreamCredentials(source.url, {
      username: source.username,
      password: bridge.secretPlaceholder,
    });
    const http = bridgeHttpClient(
      source.credentialRef,
      options.maxAgeMs ?? 0,
      source.userAgent ?? null,
    );
    return new XtreamClient(withRequestQueue(http), credentials);
  }

  const password = await readCredential(source.credentialRef);
  if (!password) return null;

  const credentials = parseXtreamCredentials(source.url, {
    username: source.username,
    password,
  });
  return new XtreamClient(withRequestQueue(getHttpClient()), credentials);
}

export async function clearXtreamDiskCache(): Promise<void> {
  await getDesktopBridge()?.xtreamClearCache();
}
