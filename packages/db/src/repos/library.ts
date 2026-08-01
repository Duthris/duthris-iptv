import type { ContentKind, FavoriteEntry, WatchHistoryEntry } from "@iptv/core";
import { getDb } from "../schema.js";

function favoriteId(profileId: string, itemId: string): string {
  return `${profileId}:${itemId}`;
}

export async function listFavorites(
  profileId: string,
  kind?: ContentKind,
): Promise<FavoriteEntry[]> {
  const db = getDb();
  const rows = kind
    ? await db.favorites.where("[profileId+kind]").equals([profileId, kind]).toArray()
    : await db.favorites.where("profileId").equals(profileId).toArray();
  return rows.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function isFavorite(profileId: string, itemId: string): Promise<boolean> {
  return (await getDb().favorites.get(favoriteId(profileId, itemId))) !== undefined;
}

export async function listFavoriteIds(profileId: string): Promise<Set<string>> {
  const rows = await getDb().favorites.where("profileId").equals(profileId).toArray();
  return new Set(rows.map((row) => row.itemId));
}

export async function toggleFavorite(
  profileId: string,
  itemId: string,
  kind: ContentKind,
): Promise<boolean> {
  const db = getDb();
  const id = favoriteId(profileId, itemId);
  const existing = await db.favorites.get(id);

  if (existing) {
    await db.favorites.delete(id);
    return false;
  }

  const count = await db.favorites.where("profileId").equals(profileId).count();
  const entry: FavoriteEntry = {
    id,
    profileId,
    itemId,
    kind,
    sortOrder: count,
    createdAt: Date.now(),
  };
  await db.favorites.add(entry);
  return true;
}

export async function reorderFavorites(profileId: string, orderedItemIds: string[]): Promise<void> {
  const db = getDb();
  await db.transaction("rw", db.favorites, async () => {
    for (let i = 0; i < orderedItemIds.length; i++) {
      const itemId = orderedItemIds[i];
      if (!itemId) continue;
      await db.favorites.update(favoriteId(profileId, itemId), { sortOrder: i });
    }
  });
}

const MAX_HISTORY_ENTRIES = 500;

export interface RecordWatchInput {
  profileId: string;
  itemId: string;
  kind: ContentKind;
  title: string;
  poster?: string | null;
  parentId?: string | null;
  positionSecs?: number | null;
  durationSecs?: number | null;
  /** Seconds to add to the running total for this item. */
  addSecs?: number;
  /** Counts this call as a fresh viewing rather than a progress update. */
  newSession?: boolean;
}

export async function recordWatch(input: RecordWatchInput): Promise<void> {
  const db = getDb();
  const { positionSecs = null, durationSecs = null, addSecs = 0, newSession = false } = input;

  const completed =
    positionSecs !== null && durationSecs !== null && durationSecs > 0
      ? positionSecs / durationSecs >= 0.92
      : false;

  const id = `${input.profileId}:${input.itemId}`;
  const existing = await db.watchHistory.get(id);

  const entry: WatchHistoryEntry = {
    id,
    profileId: input.profileId,
    itemId: input.itemId,
    kind: input.kind,
    parentId: input.parentId ?? null,
    title: input.title,
    poster: input.poster ?? null,
    positionSecs,
    durationSecs,
    completed,
    watchedAt: Date.now(),
    playCount: (existing?.playCount ?? 0) + (newSession || !existing ? 1 : 0),
    totalSecs: (existing?.totalSecs ?? 0) + Math.max(0, Math.round(addSecs)),
  };

  await db.watchHistory.put(entry);
  await trimHistory(input.profileId);
}

async function trimHistory(profileId: string): Promise<void> {
  const db = getDb();
  const count = await db.watchHistory.where("profileId").equals(profileId).count();
  if (count <= MAX_HISTORY_ENTRIES) return;

  const rows = await db.watchHistory
    .where("[profileId+watchedAt]")
    .between([profileId, 0], [profileId, Infinity])
    .limit(count - MAX_HISTORY_ENTRIES)
    .primaryKeys();

  await db.watchHistory.bulkDelete(rows);
}

export async function listHistory(profileId: string, limit = 50): Promise<WatchHistoryEntry[]> {
  const rows = await getDb()
    .watchHistory.where("[profileId+watchedAt]")
    .between([profileId, 0], [profileId, Infinity])
    .reverse()
    .limit(limit)
    .toArray();
  return rows;
}

export async function listContinueWatching(
  profileId: string,
  limit = 20,
): Promise<WatchHistoryEntry[]> {
  const rows = await listHistory(profileId, 200);
  return rows
    .filter(
      (row) =>
        !row.completed && row.kind !== "live" && row.positionSecs !== null && row.positionSecs > 60,
    )
    .slice(0, limit);
}

export async function getWatchProgress(
  profileId: string,
  itemId: string,
): Promise<WatchHistoryEntry | undefined> {
  return getDb().watchHistory.get(`${profileId}:${itemId}`);
}

export async function clearHistory(profileId: string): Promise<void> {
  await getDb().watchHistory.where("profileId").equals(profileId).delete();
}

export async function listLiveHistory(
  profileId: string,
  limit = 200,
): Promise<WatchHistoryEntry[]> {
  const rows = await getDb()
    .watchHistory.where("[profileId+kind]")
    .equals([profileId, "live"])
    .toArray();
  return rows.sort((a, b) => b.watchedAt - a.watchedAt).slice(0, limit);
}

export async function listRecentChannels(
  profileId: string,
  limit = 8,
): Promise<WatchHistoryEntry[]> {
  const rows = await listLiveHistory(profileId);
  return rows.slice(0, limit);
}

export async function listFrequentChannels(
  profileId: string,
  limit = 8,
): Promise<WatchHistoryEntry[]> {
  const rows = await listLiveHistory(profileId);
  const now = Date.now();

  return rows
    .map((row) => {
      const days = Math.max(1, (now - row.watchedAt) / 86_400_000);
      return { row, score: (row.playCount + row.totalSecs / 1800) / Math.sqrt(days) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.row);
}

export interface WatchStats {
  totalSecs: number;
  liveSecs: number;
  vodSecs: number;
  seriesSecs: number;
  itemCount: number;
  completedCount: number;
  unfinishedCount: number;
  topChannels: WatchHistoryEntry[];
  topTitles: WatchHistoryEntry[];
  firstWatchedAt: number | null;
}

export async function getWatchStats(profileId: string): Promise<WatchStats> {
  const rows = await getDb().watchHistory.where("profileId").equals(profileId).toArray();

  const stats: WatchStats = {
    totalSecs: 0,
    liveSecs: 0,
    vodSecs: 0,
    seriesSecs: 0,
    itemCount: rows.length,
    completedCount: 0,
    unfinishedCount: 0,
    topChannels: [],
    topTitles: [],
    firstWatchedAt: null,
  };

  for (const row of rows) {
    const secs = row.totalSecs ?? 0;
    stats.totalSecs += secs;
    if (row.kind === "live") stats.liveSecs += secs;
    else if (row.kind === "vod") stats.vodSecs += secs;
    else stats.seriesSecs += secs;

    if (row.completed) stats.completedCount++;
    else if (row.kind !== "live" && (row.positionSecs ?? 0) > 60) stats.unfinishedCount++;

    if (stats.firstWatchedAt === null || row.watchedAt < stats.firstWatchedAt) {
      stats.firstWatchedAt = row.watchedAt;
    }
  }

  const byTime = (a: WatchHistoryEntry, b: WatchHistoryEntry) =>
    (b.totalSecs ?? 0) - (a.totalSecs ?? 0) || (b.playCount ?? 0) - (a.playCount ?? 0);

  stats.topChannels = rows
    .filter((row) => row.kind === "live")
    .sort(byTime)
    .slice(0, 5);
  stats.topTitles = rows
    .filter((row) => row.kind !== "live")
    .sort(byTime)
    .slice(0, 5);

  return stats;
}
