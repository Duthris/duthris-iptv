import type { TmdbDetails } from "@iptv/core";

import { getDb, type TmdbCacheEntry } from "../schema.js";

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

const MISS_TTL_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Bumped whenever a field is added to what we store.
 *
 * The cache holds a whole details object for a month, so a new field would
 * otherwise read as missing on every title already seen — a feature that
 * silently does nothing until the entry happens to expire. Raising this
 * refetches instead.
 *
 * 2: trailerKey
 */
const SHAPE_VERSION = 2;

export type TmdbKind = "movie" | "tv";

function cacheId(kind: TmdbKind, itemId: string): string {
  return `${kind}:${itemId}`;
}

export interface CachedTmdb {
  details: TmdbDetails | null;
  fetchedAt: number;
}

export async function readTmdbCache(kind: TmdbKind, itemId: string): Promise<CachedTmdb | null> {
  const entry = await getDb().tmdbCache.get(cacheId(kind, itemId));
  if (!entry) return null;

  // Written before a field existed; refetch rather than report it missing.
  if ((entry.shape ?? 1) < SHAPE_VERSION) return null;

  const ttl = entry.details === null ? MISS_TTL_MS : TTL_MS;
  if (Date.now() - entry.fetchedAt > ttl) return null;

  return { details: (entry.details as TmdbDetails | null) ?? null, fetchedAt: entry.fetchedAt };
}

export async function writeTmdbCache(
  kind: TmdbKind,
  itemId: string,
  details: TmdbDetails | null,
): Promise<void> {
  const entry: TmdbCacheEntry = {
    id: cacheId(kind, itemId),
    kind,
    tmdbId: details?.tmdbId ?? null,
    details,
    fetchedAt: Date.now(),
    shape: SHAPE_VERSION,
  };
  await getDb().tmdbCache.put(entry);
}

export async function clearTmdbCache(): Promise<void> {
  await getDb().tmdbCache.clear();
}

export async function countTmdbCache(): Promise<number> {
  return getDb().tmdbCache.count();
}
