import { net } from "electron";

import type { SubtitleDownloadResult, SubtitleSearchRequest, SubtitleSearchResult } from "../shared/ipc.js";

const API_BASE = "https://api.opensubtitles.com/api/v1";

/**
 * Identifies the app to the service, which rejects requests without one.
 *
 * This is why the calls live in the main process at all: a renderer cannot set
 * User-Agent, so the CORS preflight for the API key header arrives without one
 * and comes back 403 "User agent required" — failing the request before it is
 * ever sent. Main has no preflight and full control of headers.
 */
const USER_AGENT = "DuthrisIPTV v1.4.0";

/**
 * The service answers a malformed query with a redirect rather than an error,
 * so all three rules matter: parameters sorted, `query` lowercased, and its
 * spaces written as `+` rather than percent-encoded.
 */
function buildQuery(params: Record<string, string | number>): string {
  const parts = Object.keys(params)
    .sort()
    .map((key) => {
      const raw = String(params[key]);
      const value =
        key === "query" ? raw.toLowerCase().trim().replace(/\s+/g, "+") : encodeURIComponent(raw);
      return `${key}=${value}`;
    });
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

async function call(apiKey: string, path: string, init?: { method: string; body: string }) {
  const response = await net.fetch(`${API_BASE}${path}`, {
    method: init?.method ?? "GET",
    ...(init?.body ? { body: init.body } : {}),
    headers: {
      "Api-Key": apiKey,
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { message?: string; error?: string };
      message = parsed.message ?? parsed.error ?? message;
    } catch {
      // Non-JSON error page; the status alone is the useful part.
    }
    throw new Error(message);
  }

  return JSON.parse(text) as unknown;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function num(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function searchSubtitles(
  request: SubtitleSearchRequest,
): Promise<SubtitleSearchResult[]> {
  const params: Record<string, string | number> = { languages: request.languages };

  if (request.tmdbId) {
    if (request.season !== null && request.season !== undefined) {
      params["parent_tmdb_id"] = request.tmdbId;
      params["season_number"] = request.season;
      if (request.episode !== null && request.episode !== undefined) {
        params["episode_number"] = request.episode;
      }
    } else {
      params["tmdb_id"] = request.tmdbId;
    }
  } else if (request.query) {
    params["query"] = request.query;
    if (request.year) params["year"] = request.year;
    if (request.season !== null && request.season !== undefined) {
      params["season_number"] = request.season;
    }
    if (request.episode !== null && request.episode !== undefined) {
      params["episode_number"] = request.episode;
    }
  } else {
    return [];
  }

  const raw = await call(request.apiKey, `/subtitles${buildQuery(params)}`);
  const rows = (raw as { data?: unknown }).data;
  if (!Array.isArray(rows)) return [];

  const results: SubtitleSearchResult[] = [];

  for (const row of rows) {
    const attributes = (row as { attributes?: Record<string, unknown> }).attributes;
    if (!attributes) continue;

    const files = attributes["files"];
    const file = Array.isArray(files) && files.length > 0 ? (files[0] as Record<string, unknown>) : null;
    const fileId = num(file?.["file_id"]);
    if (fileId === null) continue;

    results.push({
      fileId,
      fileName: str(file?.["file_name"]),
      language: str(attributes["language"]) ?? "?",
      release: str(attributes["release"]) ?? "—",
      downloadCount: num(attributes["download_count"]) ?? 0,
      hearingImpaired: attributes["hearing_impaired"] === true,
      machineTranslated:
        attributes["ai_translated"] === true || attributes["machine_translated"] === true,
      fps: num(attributes["fps"]),
    });
  }

  return results.sort((a, b) => b.downloadCount - a.downloadCount);
}

/**
 * Resolves a link and fetches the file in one step.
 *
 * The link is single-use and short lived, so handing it back to the renderer
 * to fetch separately would just reintroduce the CORS problem this module
 * exists to avoid.
 */
export async function downloadSubtitle(
  apiKey: string,
  fileId: number,
): Promise<SubtitleDownloadResult> {
  const raw = (await call(apiKey, "/download", {
    method: "POST",
    body: JSON.stringify({ file_id: fileId }),
  })) as Record<string, unknown>;

  const link = str(raw["link"]);
  if (!link) {
    throw new Error(
      str(raw["message"]) ?? "İndirme bağlantısı alınamadı; günlük hak dolmuş olabilir.",
    );
  }

  const response = await net.fetch(link, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`Altyazı dosyası indirilemedi (HTTP ${response.status})`);

  return {
    text: await response.text(),
    fileName: str(raw["file_name"]),
    remaining: num(raw["remaining"]),
  };
}
