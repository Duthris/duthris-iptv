export type SourceKind = "m3u-file" | "m3u-url" | "xtream";
export type ContentKind = "live" | "vod" | "series";

export type StreamFormat = "m3u8" | "ts";

export type StreamProtocolPreference = "auto" | "http" | "https";

export interface StreamEndpoints {
  http: string | null;

  https: string | null;
}

export interface SourceSubscription {
  status: string | null;
  isTrial: boolean;
  /** Epoch milliseconds; null when the panel reports no expiry. */
  expiresAt: number | null;
  maxConnections: number;
  activeConnections: number;
  /** When these figures were last read from the panel. */
  checkedAt: number;
}

export interface PlaylistSource {
  id: string;
  name: string;
  kind: SourceKind;
  enabled: boolean;

  url: string;

  username: string | null;

  credentialRef: string | null;

  preferredFormat: StreamFormat;

  streamProtocol: StreamProtocolPreference;

  streamEndpoints: StreamEndpoints | null;

  epgUrl: string | null;
  refreshIntervalHours: number;
  lastRefreshAt: number | null;
  lastSuccessAt: number | null;
  lastError: string | null;
  stats: SourceStats | null;
  /** Xtream only; M3U playlists carry no account information. */
  subscription: SourceSubscription | null;
  createdAt: number;
  updatedAt: number;
}

export interface SourceStats {
  liveCount: number;
  vodCount: number;
  seriesCount: number;
  categoryCount: number;
  epgProgramCount: number;
}

export interface Category {
  id: string;
  sourceId: string;
  kind: ContentKind;
  rawId: string;
  name: string;
  nameLower: string;
  parentRawId: string | null;
  order: number;
  itemCount: number;

  adult: boolean;
}

export interface LiveChannel {
  id: string;
  sourceId: string;
  rawId: string;
  name: string;
  nameLower: string;

  tokens: string[];

  number: number | null;
  logo: string | null;

  tvgId: string | null;

  categoryRawIds: string[];
  primaryCategoryRawId: string | null;

  url: string | null;

  streamId: number | null;
  hasArchive: boolean;
  archiveDays: number;
  order: number;
  addedAt: number | null;
}

export interface VodItem {
  id: string;
  sourceId: string;
  rawId: string;
  name: string;
  nameLower: string;
  tokens: string[];
  logo: string | null;
  categoryRawIds: string[];
  primaryCategoryRawId: string | null;
  url: string | null;
  streamId: number | null;

  containerExt: string | null;
  year: number | null;
  rating: number | null;
  plot: string | null;
  genre: string | null;
  cast: string | null;
  director: string | null;
  durationSecs: number | null;
  order: number;
  addedAt: number | null;
}

export interface SeriesItem {
  id: string;
  sourceId: string;
  rawId: string;
  name: string;
  nameLower: string;
  tokens: string[];
  cover: string | null;
  backdrop: string | null;
  categoryRawIds: string[];
  primaryCategoryRawId: string | null;
  seriesId: number | null;
  year: number | null;
  rating: number | null;
  plot: string | null;
  genre: string | null;
  cast: string | null;
  director: string | null;

  episodeCount: number | null;
  order: number;
  addedAt: number | null;
}

export interface Episode {
  id: string;
  sourceId: string;
  seriesItemId: string;
  rawId: string;
  season: number;
  episode: number;
  title: string;
  plot: string | null;
  cover: string | null;
  durationSecs: number | null;
  containerExt: string | null;
  streamId: number | null;
  url: string | null;
  addedAt: number | null;
}

export interface EpgProgram {
  id: string;
  epgSourceId: string;

  channelKey: string;

  start: number;

  stop: number;
  title: string;
  desc: string | null;
  category: string | null;
  icon: string | null;
  lang: string | null;
}

export interface EpgChannel {
  id: string;
  epgSourceId: string;
  channelKey: string;
  displayNames: string[];
  icon: string | null;
}

export interface ParsedPlaylist {
  live: LiveChannel[];
  vod: VodItem[];
  series: SeriesItem[];
  episodes: Episode[];
  categories: Category[];

  epgUrl: string | null;
}

export interface ParseProgress {
  phase: "download" | "parse" | "normalize" | "store";

  ratio: number | null;
  processed: number;
  total: number | null;
  label: string;
}

export type ProgressCallback = (progress: ParseProgress) => void;

export interface Profile {
  id: string;
  name: string;

  color: string;
  avatar: string | null;
  pinHash: string | null;
  isKids: boolean;
  parentalControlEnabled: boolean;

  allowedSourceIds: string[];
  hiddenCategoryIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface FavoriteEntry {
  id: string;
  profileId: string;
  itemId: string;
  kind: ContentKind;
  sortOrder: number;
  createdAt: number;
}

export interface WatchHistoryEntry {
  id: string;
  profileId: string;
  itemId: string;
  kind: ContentKind;

  parentId: string | null;
  title: string;
  poster: string | null;

  positionSecs: number | null;
  durationSecs: number | null;
  completed: boolean;
  watchedAt: number;

  playCount: number;
  totalSecs: number;
}
