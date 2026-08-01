import {
  asBool,
  asCategoryIds,
  asEpochMs,
  asInt,
  asNumber,
  asRequiredString,
  asString,
  asStringArray,
  asYear,
} from "../coerce.js";
import { cleanDisplayName, looksAdult, normalizeForSearch, searchTokens } from "../text.js";
import type { Category, ContentKind, Episode, LiveChannel, SeriesItem, VodItem } from "../types.js";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

export interface VodInfo {
  tmdbId: number | null;
  backdrop: string | null;
  coverBig: string | null;
  durationSecs: number | null;
  country: string | null;
  ageRating: string | null;

  subtitles: string[];
}

export function normalizeVodInfo(raw: unknown): VodInfo | null {
  const root = asRecord(raw);
  const info = asRecord(root?.["info"]);
  if (!info) return null;

  const backdrops = asStringArray(info["backdrop_path"]);
  const subtitles = Array.isArray(info["subtitles"])
    ? info["subtitles"]
        .map((entry) => asString(asRecord(entry)?.["language"] ?? entry))
        .filter((value): value is string => Boolean(value))
    : [];

  return {
    tmdbId: asInt(info["tmdb_id"]),
    backdrop: backdrops[0] ?? null,
    coverBig: asString(info["cover_big"]) ?? asString(info["movie_image"]),
    durationSecs: asInt(info["duration_secs"]),
    country: asString(info["country"]),
    ageRating: asString(info["age"]) ?? asString(info["mpaa_rating"]),
    subtitles,
  };
}

export function normalizeCategories(
  raw: unknown[],
  sourceId: string,
  kind: ContentKind,
): Category[] {
  const result: Category[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = asRecord(raw[i]);
    if (!row) continue;

    const rawId = asString(row["category_id"]);
    if (!rawId) continue;

    const name = cleanDisplayName(asRequiredString(row["category_name"], "Diğer"));
    result.push({
      id: `${sourceId}:${kind}:${rawId}`,
      sourceId,
      kind,
      rawId,
      name,
      nameLower: normalizeForSearch(name),
      parentRawId: asString(row["parent_id"]),
      order: i,
      itemCount: 0,
      adult: looksAdult(name),
    });
  }
  return result;
}

export function normalizeLiveStreams(raw: unknown[], sourceId: string): LiveChannel[] {
  const result: LiveChannel[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const row = asRecord(raw[i]);
    if (!row) continue;

    const streamId = asInt(row["stream_id"]);
    if (streamId === null) continue;

    const rawId = String(streamId);
    const id = `${sourceId}:live:${rawId}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const name = cleanDisplayName(asRequiredString(row["name"], `Kanal ${rawId}`));
    const categoryRawIds = asCategoryIds(row["category_id"], row["category_ids"]);

    result.push({
      id,
      sourceId,
      rawId,
      name,
      nameLower: normalizeForSearch(name),
      tokens: searchTokens(name),
      number: asInt(row["num"]),
      logo: asString(row["stream_icon"]),
      tvgId: asString(row["epg_channel_id"]),
      categoryRawIds,
      primaryCategoryRawId: categoryRawIds[0] ?? null,

      url: asString(row["direct_source"]),
      streamId,
      hasArchive: asBool(row["tv_archive"]),
      archiveDays: asInt(row["tv_archive_duration"]) ?? 0,
      order: i,
      addedAt: asEpochMs(row["added"]),
    });
  }
  return result;
}

export function normalizeVodStreams(raw: unknown[], sourceId: string): VodItem[] {
  const result: VodItem[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const row = asRecord(raw[i]);
    if (!row) continue;

    const streamId = asInt(row["stream_id"]);
    if (streamId === null) continue;

    const rawId = String(streamId);
    const id = `${sourceId}:vod:${rawId}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const name = cleanDisplayName(
      asString(row["title"]) ?? asRequiredString(row["name"], `Film ${rawId}`),
    );
    const categoryRawIds = asCategoryIds(row["category_id"], row["category_ids"]);
    const runtimeMinutes = asNumber(row["episode_run_time"]);

    result.push({
      id,
      sourceId,
      rawId,
      name,
      nameLower: normalizeForSearch(name),
      tokens: searchTokens(name),
      logo: asString(row["stream_icon"]),
      categoryRawIds,
      primaryCategoryRawId: categoryRawIds[0] ?? null,
      url: asString(row["direct_source"]),
      streamId,
      containerExt: asString(row["container_extension"]),
      year: asYear(row["year"]) ?? asYear(row["release_date"]),
      rating: asNumber(row["rating"]),
      plot: asString(row["plot"]),
      genre: asString(row["genre"]),
      cast: asString(row["cast"]),
      director: asString(row["director"]),
      durationSecs: runtimeMinutes && runtimeMinutes > 0 ? Math.round(runtimeMinutes * 60) : null,
      order: i,
      addedAt: asEpochMs(row["added"]),
    });
  }
  return result;
}

export function normalizeSeries(raw: unknown[], sourceId: string): SeriesItem[] {
  const result: SeriesItem[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const row = asRecord(raw[i]);
    if (!row) continue;

    const seriesId = asInt(row["series_id"]);
    if (seriesId === null) continue;

    const rawId = String(seriesId);
    const id = `${sourceId}:series:${rawId}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const name = cleanDisplayName(
      asString(row["title"]) ?? asRequiredString(row["name"], `Dizi ${rawId}`),
    );
    const categoryRawIds = asCategoryIds(row["category_id"], row["category_ids"]);
    const backdrops = asStringArray(row["backdrop_path"]);

    result.push({
      id,
      sourceId,
      rawId,
      name,
      nameLower: normalizeForSearch(name),
      tokens: searchTokens(name),
      cover: asString(row["cover"]),
      backdrop: backdrops[0] ?? null,
      categoryRawIds,
      primaryCategoryRawId: categoryRawIds[0] ?? null,
      seriesId,
      year: asYear(row["year"]) ?? asYear(row["release_date"]),
      rating: asNumber(row["rating"]),
      plot: asString(row["plot"]),
      genre: asString(row["genre"]),
      cast: asString(row["cast"]),
      director: asString(row["director"]),
      episodeCount: null,
      order: i,
      addedAt: asEpochMs(row["last_modified"]),
    });
  }
  return result;
}

export function normalizeEpisodes(
  episodesBySeason: Record<string, unknown[]> | undefined,
  sourceId: string,
  seriesItemId: string,
): Episode[] {
  if (!episodesBySeason) return [];

  const result: Episode[] = [];
  const seasonKeys = Object.keys(episodesBySeason).sort(
    (a, b) => (Number.parseInt(a, 10) || 0) - (Number.parseInt(b, 10) || 0),
  );

  for (const seasonKey of seasonKeys) {
    const list = episodesBySeason[seasonKey];
    if (!Array.isArray(list)) continue;

    const seasonFromKey = Number.parseInt(seasonKey, 10);

    for (let i = 0; i < list.length; i++) {
      const row = asRecord(list[i]);
      if (!row) continue;

      const rawId = asString(row["id"]);
      if (!rawId) continue;

      const info = asRecord(row["info"]);
      const episodeNumber = asInt(row["episode_num"]) ?? i + 1;
      const season = asInt(row["season"]) ?? (Number.isFinite(seasonFromKey) ? seasonFromKey : 1);

      result.push({
        id: `${sourceId}:ep:${rawId}`,
        sourceId,
        seriesItemId,
        rawId,
        season,
        episode: episodeNumber,
        title: cleanDisplayName(
          asRequiredString(row["title"], `${season}. Sezon ${episodeNumber}. Bölüm`),
        ),
        plot: info ? asString(info["plot"]) : null,
        cover: info ? asString(info["movie_image"]) : null,
        durationSecs: info ? asInt(info["duration_secs"]) : null,
        containerExt: asString(row["container_extension"]),
        streamId: asInt(row["id"]),
        url: null,
        addedAt: asEpochMs(row["added"]),
      });
    }
  }

  return result;
}

export function applyCategoryCounts(
  categories: Category[],
  items: Array<{ categoryRawIds: string[] }>,
): void {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const rawId of item.categoryRawIds) {
      counts.set(rawId, (counts.get(rawId) ?? 0) + 1);
    }
  }
  for (const category of categories) {
    category.itemCount = counts.get(category.rawId) ?? 0;
  }
}
