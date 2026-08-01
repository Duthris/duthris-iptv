"use client";

import type { ContentKind, WatchHistoryEntry } from "@iptv/core";
import { getLiveChannel, getSeriesItem, getVodItem, listFavorites, listHistory } from "@iptv/db";

export interface LibraryEntry {
  id: string;
  kind: ContentKind;
  name: string;
  poster: string | null;
  year: number | null;

  progress: number | null;
  positionSecs: number | null;

  parentId: string | null;

  missing: boolean;
}

async function resolveItem(
  itemId: string,
  kind: ContentKind,
): Promise<{ name: string; poster: string | null; year: number | null } | null> {
  if (kind === "live") {
    const channel = await getLiveChannel(itemId);
    return channel ? { name: channel.name, poster: channel.logo, year: null } : null;
  }
  if (kind === "vod") {
    const item = await getVodItem(itemId);
    return item ? { name: item.name, poster: item.logo, year: item.year } : null;
  }
  const series = await getSeriesItem(itemId);
  return series ? { name: series.name, poster: series.cover, year: series.year } : null;
}

export async function loadFavorites(profileId: string): Promise<LibraryEntry[]> {
  const rows = await listFavorites(profileId);

  const resolved = await Promise.all(
    rows.map(async (row) => {
      const item = await resolveItem(row.itemId, row.kind);
      return {
        id: row.itemId,
        kind: row.kind,
        name: item?.name ?? "(kaynakta bulunamadı)",
        poster: item?.poster ?? null,
        year: item?.year ?? null,
        progress: null,
        positionSecs: null,
        parentId: null,
        missing: item === null,
      } satisfies LibraryEntry;
    }),
  );

  return resolved;
}

function toEntry(row: WatchHistoryEntry): LibraryEntry {
  const progress =
    row.completed || (row.durationSecs && row.positionSecs)
      ? row.completed
        ? 1
        : (row.positionSecs ?? 0) / (row.durationSecs ?? 1)
      : null;

  return {
    id: row.itemId,
    kind: row.kind,

    name: row.title,
    poster: row.poster,
    year: null,
    progress,
    positionSecs: row.positionSecs,
    parentId: row.parentId,
    missing: false,
  };
}

export async function loadHistory(profileId: string, limit = 100): Promise<LibraryEntry[]> {
  return (await listHistory(profileId, limit)).map(toEntry);
}

export async function loadContinueWatching(profileId: string, limit = 40): Promise<LibraryEntry[]> {
  const rows = await listHistory(profileId, 200);
  return rows
    .filter(
      (row) =>
        !row.completed && row.kind !== "live" && row.positionSecs !== null && row.positionSecs > 60,
    )
    .slice(0, limit)
    .map(toEntry);
}
