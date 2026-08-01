import Dexie, { type EntityTable } from "dexie";
import type {
  Category,
  EpgChannel,
  EpgProgram,
  Episode,
  FavoriteEntry,
  LiveChannel,
  PlaylistSource,
  Profile,
  SeriesItem,
  VodItem,
  WatchHistoryEntry,
} from "@iptv/core";
import type { MatchConfidence } from "@iptv/core";

export const DB_NAME = "duthris-iptv";
export const DB_VERSION = 5;

export interface StoredCredential {
  id: string;

  secret: string;
  encrypted: boolean;
  updatedAt: number;
}

export interface EpgMapping {
  channelId: string;
  channelKey: string;
  confidence: MatchConfidence;
  epgSourceId: string;
}

export interface SettingEntry {
  key: string;
  value: unknown;
  updatedAt: number;
}

export interface TmdbCacheEntry {
  id: string;
  kind: "movie" | "tv";
  tmdbId: number | null;

  details: unknown | null;
  fetchedAt: number;
}

export class IptvDatabase extends Dexie {
  profiles!: EntityTable<Profile, "id">;
  playlistSources!: EntityTable<PlaylistSource, "id">;
  credentials!: EntityTable<StoredCredential, "id">;
  categories!: EntityTable<Category, "id">;
  liveChannels!: EntityTable<LiveChannel, "id">;
  vodItems!: EntityTable<VodItem, "id">;
  series!: EntityTable<SeriesItem, "id">;
  episodes!: EntityTable<Episode, "id">;
  epgChannels!: EntityTable<EpgChannel, "id">;
  epgPrograms!: EntityTable<EpgProgram, "id">;
  epgMappings!: EntityTable<EpgMapping, "channelId">;
  favorites!: EntityTable<FavoriteEntry, "id">;
  watchHistory!: EntityTable<WatchHistoryEntry, "id">;
  settings!: EntityTable<SettingEntry, "key">;
  tmdbCache!: EntityTable<TmdbCacheEntry, "id">;

  constructor(name: string = DB_NAME) {
    super(name);

    this.version(1).stores({
      profiles: "id, name, createdAt",
      playlistSources: "id, kind, enabled, createdAt, updatedAt",
      credentials: "id",

      categories: "id, sourceId, kind, [sourceId+kind], nameLower, adult",

      liveChannels: "id, sourceId, nameLower, tvgId, [sourceId+order], *categoryRawIds, *tokens",
      vodItems:
        "id, sourceId, nameLower, year, addedAt, [sourceId+order], *categoryRawIds, *tokens",
      series: "id, sourceId, nameLower, year, [sourceId+order], *categoryRawIds, *tokens",
      episodes: "id, sourceId, seriesItemId, [seriesItemId+season+episode]",

      epgChannels: "id, epgSourceId, channelKey",
      epgPrograms: "id, epgSourceId, channelKey, start, [channelKey+start]",
      epgMappings: "channelId, channelKey, epgSourceId",

      favorites: "id, profileId, itemId, kind, [profileId+kind], sortOrder",
      watchHistory: "id, profileId, itemId, watchedAt, [profileId+watchedAt]",

      settings: "key",
    });

    this.version(2).stores({
      channelHealth: "channelId, status, checkedAt",
    });

    this.version(3).stores({
      channelHealth: null,
    });

    this.version(4).stores({
      tmdbCache: "id, kind, tmdbId, fetchedAt",
    });

    this.version(5)
      .stores({
        watchHistory:
          "id, profileId, itemId, watchedAt, playCount, totalSecs, [profileId+watchedAt], [profileId+kind]",
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<WatchHistoryEntry>("watchHistory")
          .toCollection()
          .modify((entry) => {
            entry.playCount ??= 1;
            entry.totalSecs ??= 0;
          });
      });
  }
}

let instance: IptvDatabase | null = null;

export function getDb(): IptvDatabase {
  if (!instance) instance = new IptvDatabase();
  return instance;
}

export function resetDbInstance(): void {
  instance = null;
}
