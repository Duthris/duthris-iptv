import type { Category, ContentKind, Episode, ParsedPlaylist, ProgressCallback } from "@iptv/core";
import { normalizeForSearch } from "@iptv/core";
import { getDb } from "../schema.js";

const DEFAULT_CHUNK_SIZE = 2000;

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function bulkPutChunked<T>(
  table: { bulkPut(items: readonly T[]): Promise<unknown> },
  items: T[],
  chunkSize: number,
  onChunk: (written: number) => void,
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    await table.bulkPut(items.slice(i, i + chunkSize));
    onChunk(Math.min(i + chunkSize, items.length));
    await yieldToEventLoop();
  }
}

export interface ReplaceCatalogOptions {
  onProgress?: ProgressCallback;
  chunkSize?: number;
}

export async function replaceCatalog(
  sourceId: string,
  playlist: ParsedPlaylist,
  options: ReplaceCatalogOptions = {},
): Promise<void> {
  const db = getDb();
  const { onProgress, chunkSize = DEFAULT_CHUNK_SIZE } = options;

  const totalRows =
    playlist.categories.length +
    playlist.live.length +
    playlist.vod.length +
    playlist.series.length +
    playlist.episodes.length;

  let written = 0;
  const report = (label: string) => {
    onProgress?.({
      phase: "store",
      ratio: totalRows > 0 ? written / totalRows : null,
      processed: written,
      total: totalRows,
      label,
    });
  };

  report("Eski kayıtlar temizleniyor");
  await clearCatalog(sourceId);

  report("Kategoriler yazılıyor");
  await bulkPutChunked(db.categories, playlist.categories, chunkSize, (n) => {
    written = n;
    report("Kategoriler yazılıyor");
  });
  written = playlist.categories.length;

  const base = written;
  report("Kanallar yazılıyor");
  await bulkPutChunked(db.liveChannels, playlist.live, chunkSize, (n) => {
    written = base + n;
    report("Kanallar yazılıyor");
  });
  written = base + playlist.live.length;

  const afterLive = written;
  report("Filmler yazılıyor");
  await bulkPutChunked(db.vodItems, playlist.vod, chunkSize, (n) => {
    written = afterLive + n;
    report("Filmler yazılıyor");
  });
  written = afterLive + playlist.vod.length;

  const afterVod = written;
  report("Diziler yazılıyor");
  await bulkPutChunked(db.series, playlist.series, chunkSize, (n) => {
    written = afterVod + n;
    report("Diziler yazılıyor");
  });
  written = afterVod + playlist.series.length;

  if (playlist.episodes.length > 0) {
    const afterSeries = written;
    report("Bölümler yazılıyor");
    await bulkPutChunked(db.episodes, playlist.episodes, chunkSize, (n) => {
      written = afterSeries + n;
      report("Bölümler yazılıyor");
    });
    written = afterSeries + playlist.episodes.length;
  }

  report("Tamamlandı");
}

export async function clearCatalog(sourceId: string): Promise<void> {
  const db = getDb();
  await Promise.all([
    db.categories.where("sourceId").equals(sourceId).delete(),
    db.liveChannels.where("sourceId").equals(sourceId).delete(),
    db.vodItems.where("sourceId").equals(sourceId).delete(),
    db.series.where("sourceId").equals(sourceId).delete(),
    db.episodes.where("sourceId").equals(sourceId).delete(),
  ]);
}

export interface CategoryListItem {
  id: string;
  rawId: string;
  name: string;
  itemCount: number;
  adult: boolean;
  sourceId: string;
}

export async function listCategories(
  sourceIds: string[],
  kind: ContentKind,
  options: { includeAdult?: boolean; hiddenIds?: string[] } = {},
): Promise<CategoryListItem[]> {
  if (sourceIds.length === 0) return [];
  const db = getDb();
  const { includeAdult = true, hiddenIds } = options;
  const hidden = hiddenIds && hiddenIds.length > 0 ? new Set(hiddenIds) : null;

  const rows: Category[] = await db.categories
    .where("[sourceId+kind]")
    .anyOf(sourceIds.map((sourceId) => [sourceId, kind] as [string, ContentKind]))
    .toArray();

  return rows
    .filter((row) => (includeAdult || !row.adult) && !hidden?.has(row.id))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "tr"))
    .map((row) => ({
      id: row.id,
      rawId: row.rawId,
      name: row.name,
      itemCount: row.itemCount,
      adult: row.adult,
      sourceId: row.sourceId,
    }));
}

export interface ChannelListItem {
  id: string;
  sourceId: string;
  name: string;
  logo: string | null;
  number: number | null;
  tvgId: string | null;
  hasArchive: boolean;
}

export interface ListChannelsQuery {
  sourceIds: string[];

  categoryRawId?: string | null;

  excludeCategoryIds?: string[];
  limit?: number;
}

export async function listLiveChannels(query: ListChannelsQuery): Promise<ChannelListItem[]> {
  const db = getDb();
  const { sourceIds, categoryRawId = null, limit } = query;
  if (sourceIds.length === 0) return [];

  const sourceSet = new Set(sourceIds);

  const collection = categoryRawId
    ? db.liveChannels.where("categoryRawIds").equals(categoryRawId)
    : db.liveChannels.where("sourceId").anyOf(sourceIds);

  const rows = await collection.filter((row) => sourceSet.has(row.sourceId)).toArray();

  rows.sort((a, b) => a.order - b.order);
  const sliced = typeof limit === "number" ? rows.slice(0, limit) : rows;

  return sliced.map((row) => ({
    id: row.id,
    sourceId: row.sourceId,
    name: row.name,
    logo: row.logo,
    number: row.number,
    tvgId: row.tvgId,
    hasArchive: row.hasArchive,
  }));
}

export async function countLiveChannels(sourceIds: string[]): Promise<number> {
  if (sourceIds.length === 0) return 0;
  const db = getDb();
  return db.liveChannels.where("sourceId").anyOf(sourceIds).count();
}

export async function getLiveChannel(id: string) {
  return getDb().liveChannels.get(id);
}

export interface PosterListItem {
  id: string;
  sourceId: string;
  name: string;
  poster: string | null;
  year: number | null;
  rating: number | null;

  order: number;
  addedAt: number | null;

  containerExt: string | null;
}

export interface ListPosterQuery {
  sourceIds: string[];

  categoryRawId?: string | null;
  limit?: number;
}

export async function listVodItems(query: ListPosterQuery): Promise<PosterListItem[]> {
  const db = getDb();
  const { sourceIds, categoryRawId = null, limit } = query;
  if (sourceIds.length === 0) return [];

  const sourceSet = new Set(sourceIds);
  const collection = categoryRawId
    ? db.vodItems.where("categoryRawIds").equals(categoryRawId)
    : db.vodItems.where("sourceId").anyOf(sourceIds);

  const rows = await collection.filter((row) => sourceSet.has(row.sourceId)).toArray();
  rows.sort((a, b) => a.order - b.order);

  const sliced = typeof limit === "number" ? rows.slice(0, limit) : rows;
  return sliced.map((row) => ({
    id: row.id,
    sourceId: row.sourceId,
    name: row.name,
    poster: row.logo,
    year: row.year,
    rating: row.rating,
    order: row.order,
    addedAt: row.addedAt,
    containerExt: row.containerExt,
  }));
}

export async function listSeriesItems(query: ListPosterQuery): Promise<PosterListItem[]> {
  const db = getDb();
  const { sourceIds, categoryRawId = null, limit } = query;
  if (sourceIds.length === 0) return [];

  const sourceSet = new Set(sourceIds);
  const collection = categoryRawId
    ? db.series.where("categoryRawIds").equals(categoryRawId)
    : db.series.where("sourceId").anyOf(sourceIds);

  const rows = await collection.filter((row) => sourceSet.has(row.sourceId)).toArray();
  rows.sort((a, b) => a.order - b.order);

  const sliced = typeof limit === "number" ? rows.slice(0, limit) : rows;
  return sliced.map((row) => ({
    id: row.id,
    sourceId: row.sourceId,
    name: row.name,
    poster: row.cover,
    year: row.year,
    rating: row.rating,
    order: row.order,
    addedAt: row.addedAt,
    containerExt: null,
  }));
}

export async function countVodItems(sourceIds: string[]): Promise<number> {
  if (sourceIds.length === 0) return 0;
  return getDb().vodItems.where("sourceId").anyOf(sourceIds).count();
}

export async function countSeriesItems(sourceIds: string[]): Promise<number> {
  if (sourceIds.length === 0) return 0;
  return getDb().series.where("sourceId").anyOf(sourceIds).count();
}

export async function listEpisodes(seriesItemId: string): Promise<Episode[]> {
  const rows = await getDb()
    .episodes.where("[seriesItemId+season+episode]")
    .between([seriesItemId, -Infinity, -Infinity], [seriesItemId, Infinity, Infinity])
    .toArray();
  return rows.sort((a, b) => a.season - b.season || a.episode - b.episode);
}

export async function saveEpisodes(seriesItemId: string, episodes: Episode[]): Promise<void> {
  const db = getDb();
  await db.episodes.where("seriesItemId").equals(seriesItemId).delete();
  if (episodes.length > 0) await db.episodes.bulkPut(episodes);
  await db.series.update(seriesItemId, { episodeCount: episodes.length });
}

export async function getEpisode(id: string): Promise<Episode | undefined> {
  return getDb().episodes.get(id);
}

export async function getVodItem(id: string) {
  return getDb().vodItems.get(id);
}

export async function getSeriesItem(id: string) {
  return getDb().series.get(id);
}

export interface SearchResults {
  live: ChannelListItem[];
  vod: Array<{ id: string; name: string; logo: string | null; year: number | null }>;
  series: Array<{ id: string; name: string; cover: string | null; year: number | null }>;
  truncated: boolean;
}

const SEARCH_PROBE_LIMIT = 400;

export async function searchCatalog(
  rawQuery: string,
  sourceIds: string[],
  limitPerKind = 50,
): Promise<SearchResults> {
  const empty: SearchResults = { live: [], vod: [], series: [], truncated: false };
  if (sourceIds.length === 0) return empty;

  const normalized = normalizeForSearch(rawQuery);
  const tokens = normalized.split(" ").filter((token) => token.length >= 2);
  if (tokens.length === 0) return empty;

  const db = getDb();
  const sourceSet = new Set(sourceIds);

  const probe = tokens.reduce((longest, token) =>
    token.length > longest.length ? token : longest,
  );

  const matchesAll = (nameLower: string) => tokens.every((token) => nameLower.includes(token));

  const [liveRows, vodRows, seriesRows] = await Promise.all([
    db.liveChannels.where("tokens").startsWith(probe).limit(SEARCH_PROBE_LIMIT).toArray(),
    db.vodItems.where("tokens").startsWith(probe).limit(SEARCH_PROBE_LIMIT).toArray(),
    db.series.where("tokens").startsWith(probe).limit(SEARCH_PROBE_LIMIT).toArray(),
  ]);

  const live = liveRows
    .filter((row) => sourceSet.has(row.sourceId) && matchesAll(row.nameLower))
    .slice(0, limitPerKind)
    .map((row) => ({
      id: row.id,
      sourceId: row.sourceId,
      name: row.name,
      logo: row.logo,
      number: row.number,
      tvgId: row.tvgId,
      hasArchive: row.hasArchive,
    }));

  const vod = vodRows
    .filter((row) => sourceSet.has(row.sourceId) && matchesAll(row.nameLower))
    .slice(0, limitPerKind)
    .map((row) => ({ id: row.id, name: row.name, logo: row.logo, year: row.year }));

  const series = seriesRows
    .filter((row) => sourceSet.has(row.sourceId) && matchesAll(row.nameLower))
    .slice(0, limitPerKind)
    .map((row) => ({ id: row.id, name: row.name, cover: row.cover, year: row.year }));

  const truncated =
    liveRows.length >= SEARCH_PROBE_LIMIT ||
    vodRows.length >= SEARCH_PROBE_LIMIT ||
    seriesRows.length >= SEARCH_PROBE_LIMIT;

  return { live, vod, series, truncated };
}
