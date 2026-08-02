"use client";

import { cleanTitleForSearch } from "@iptv/core";

import { getDesktopBridge, type SubtitleSearchResult } from "@/lib/platform";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * Subtitle search, routed through the main process.
 *
 * It cannot run in the renderer. The API needs an `Api-Key` header, which
 * makes the browser send a CORS preflight, and the service answers that
 * preflight with 403 "User agent required" — a header the browser refuses to
 * let scripts set. The request therefore fails before it is sent, no matter
 * what the response headers say. Main has no preflight and sets the header
 * itself, so the whole exchange happens there.
 *
 * That makes this desktop-only, like audio track selection.
 */
const BUILD_TIME_KEY = process.env["NEXT_PUBLIC_OPENSUBTITLES_KEY"] ?? "";

export function resolveOpenSubtitlesKey(): string | null {
  const { openSubtitlesKey } = useSettingsStore.getState();
  const key = openSubtitlesKey.trim() || BUILD_TIME_KEY.trim();
  return key || null;
}

export function hasBuildTimeOpenSubtitlesKey(): boolean {
  return BUILD_TIME_KEY.trim() !== "";
}

/** True when searching is possible at all: desktop shell plus a key. */
export function isSubtitleSearchAvailable(): boolean {
  return getDesktopBridge() !== null && resolveOpenSubtitlesKey() !== null;
}

export type SubtitleCandidate = SubtitleSearchResult;

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
  const bridge = getDesktopBridge();
  const apiKey = resolveOpenSubtitlesKey();
  if (!bridge || !apiKey) return [];

  return bridge.searchSubtitles({
    apiKey,
    languages,
    // Provider titles carry release noise that derails a text search.
    query: cleanTitleForSearch(query.title),
    tmdbId: query.tmdbId ?? null,
    year: query.year ?? null,
    season: query.season ?? null,
    episode: query.episode ?? null,
  });
}

export interface DownloadedSubtitle {
  text: string;
  fileName: string | null;
  remaining: number | null;
}

export async function downloadSubtitle(fileId: number): Promise<DownloadedSubtitle> {
  const bridge = getDesktopBridge();
  const apiKey = resolveOpenSubtitlesKey();
  if (!bridge || !apiKey) throw new Error("Altyazı arama bu ortamda kullanılamıyor");

  return bridge.downloadSubtitle(apiKey, fileId);
}
