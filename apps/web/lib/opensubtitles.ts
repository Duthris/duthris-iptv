"use client";

import {
  OpenSubtitlesClient,
  cleanTitleForSearch,
  withRequestQueue,
  type SubtitleCandidate,
  type SubtitleSearchInput,
} from "@iptv/core";

import { getHttpClient } from "@/lib/http";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * Subtitle search and download.
 *
 * The service rejects generic user agents, so a real product name and version
 * are sent. Downloads are rate limited per key rather than per user: an
 * anonymous consumer gets a hundred a day, which is ample for one household
 * and would not be for a crowd.
 */
const USER_AGENT = "DuthrisIPTV v1.4.0";

const BUILD_TIME_KEY = process.env["NEXT_PUBLIC_OPENSUBTITLES_KEY"] ?? "";

export function resolveOpenSubtitlesKey(): string | null {
  const { openSubtitlesKey } = useSettingsStore.getState();
  const key = openSubtitlesKey.trim() || BUILD_TIME_KEY.trim();
  return key || null;
}

export function hasBuildTimeOpenSubtitlesKey(): boolean {
  return BUILD_TIME_KEY.trim() !== "";
}

let cached: { key: string; client: OpenSubtitlesClient } | null = null;

function getClient(key: string): OpenSubtitlesClient {
  if (cached?.key === key) return cached.client;
  const client = new OpenSubtitlesClient({
    apiKey: key,
    userAgent: USER_AGENT,
    http: withRequestQueue(getHttpClient(), { minIntervalMs: 250, maxRetries: 1 }),
  });
  cached = { key, client };
  return client;
}

export interface SubtitleQuery {
  title: string;
  year?: number | null;
  tmdbId?: number | null;
  season?: number | null;
  episode?: number | null;
}

export async function searchSubtitles(
  query: SubtitleQuery,
  languages: string,
): Promise<SubtitleCandidate[]> {
  const key = resolveOpenSubtitlesKey();
  if (!key) return [];

  const input: SubtitleSearchInput = {
    languages,
    // Provider titles carry release noise that derails a text search.
    query: cleanTitleForSearch(query.title),
    tmdbId: query.tmdbId ?? null,
    year: query.year ?? null,
    season: query.season ?? null,
    episode: query.episode ?? null,
  };

  return getClient(key).search(input);
}

export interface DownloadedSubtitle {
  text: string;
  fileName: string | null;
  remaining: number | null;
}

/**
 * Resolves a link and fetches the file.
 *
 * Two steps because the link is temporary and issued per request; the first
 * call is the one that costs quota, so it only runs once the user has picked.
 */
export async function downloadSubtitle(fileId: number): Promise<DownloadedSubtitle> {
  const key = resolveOpenSubtitlesKey();
  if (!key) throw new Error("OpenSubtitles anahtarı ayarlanmamış");

  const download = await getClient(key).requestDownload(fileId);
  const text = await getHttpClient().text(download.link);

  return { text, fileName: download.fileName, remaining: download.remaining };
}
