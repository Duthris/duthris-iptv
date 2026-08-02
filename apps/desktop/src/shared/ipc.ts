export const IPC = {
  pickPlaylistFile: "dialog:pick-playlist",
  saveCredential: "credential:save",
  hasCredential: "credential:has",

  revealCredential: "credential:reveal",
  deleteCredential: "credential:delete",
  resolveStreamUrl: "player:resolve",

  startTranscode: "transcode:start",
  stopTranscode: "transcode:stop",
  setLaunchAtStartup: "app:launch-at-startup",
  openExternal: "shell:open-external",
  getAppInfo: "app:info",
  searchSubtitles: "subtitles:search",
  downloadSubtitle: "subtitles:download",
  updateStatus: "update:status",
  updateCheck: "update:check",
  updateDownload: "update:download",
  updateInstall: "update:install",
  updateEvent: "update:event",
  getShellSettings: "shell:get",
  setShellSettings: "shell:set",
  exportLogs: "shell:export-logs",
  listDownloads: "download:list",
  startDownload: "download:start",
  cancelDownload: "download:cancel",
  removeDownload: "download:remove",
  downloadUrl: "download:url",
  downloadEvent: "download:event",
  xtreamFetch: "xtream:fetch",
  xtreamClearCache: "xtream:clear-cache",
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

export interface PickedPlaylistFile {
  name: string;
  content: string;
}

export const SECRET_PLACEHOLDER = "__IPTV_SECRET__";

export interface XtreamFetchRequest {
  credentialRef: string;
  /** Carries SECRET_PLACEHOLDER where the password belongs. */
  urlTemplate: string;
  /** Omitted or zero bypasses the disk cache in both directions. */
  maxAgeMs?: number;
}

export type XtreamFetchResult =
  | { ok: true; body: string; fromCache: boolean }
  | { ok: false; message: string; status: number };

export interface ResolveStreamRequest {
  credentialRef: string;

  urlTemplate: string;
}

export interface MediaTrack {
  index: number;
  codec: string;
  language: string | null;
  title: string | null;
  layout: string | null;
  default: boolean;
  forced: boolean;
  textBased: boolean;
}

export interface TranscodeSession {
  url: string;

  subtitleUrl: string;
  videoAction: "copy" | "encode";
  audioAction: "copy" | "encode";
  videoCodec: string | null;
  audioCodec: string | null;

  durationSecs: number | null;
  audioTracks: MediaTrack[];
  subtitleTracks: MediaTrack[];
}

export interface AppInfo {
  version: string;
  platform: NodeJS.Platform;

  ignoreCertificateErrors: boolean;
}

export interface SubtitleSearchRequest {
  apiKey: string;
  languages: string;
  query?: string;
  tmdbId?: number | null;
  year?: number | null;
  season?: number | null;
  episode?: number | null;
}

export interface SubtitleSearchResult {
  fileId: number;
  fileName: string | null;
  language: string;
  release: string;
  downloadCount: number;
  hearingImpaired: boolean;
  machineTranslated: boolean;
  fps: number | null;
}

export interface SubtitleDownloadResult {
  text: string;
  fileName: string | null;
  remaining: number | null;
}

export type UpdateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "current" }
  | { status: "available"; version: string; notes: string | null }
  | { status: "downloading"; percent: number }
  | { status: "ready"; version: string }
  | { status: "error"; message: string }
  | { status: "unsupported"; reason: "portable" | "development" };

export interface ShellSettings {
  minimiseToTray: boolean;
  launchAtStartup: boolean;
  alwaysOnTop: boolean;
}

export type DownloadStatus = "downloading" | "done" | "failed" | "cancelled";

export interface DownloadEntry {
  id: string;
  title: string;
  poster: string | null;
  kind: "vod" | "episode";
  itemId: string;
  status: DownloadStatus;
  progress: number;
  durationSecs: number | null;
  bytes: number;
  startedAt: number;
  error: string | null;
}

export interface StartDownloadRequest {
  id: string;
  url: string;
  title: string;
  poster?: string | null;
  kind: "vod" | "episode";
  itemId: string;
}
