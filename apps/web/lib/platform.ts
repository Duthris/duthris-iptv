export interface PickedPlaylistFile {
  name: string;
  content: string;
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

export interface DesktopBridge {
  isDesktop: true;

  secretPlaceholder: string;
  pickPlaylistFile(): Promise<PickedPlaylistFile | null>;
  saveCredential(ref: string, secret: string): Promise<void>;

  hasCredential(ref: string): Promise<boolean>;

  revealCredential(ref: string): Promise<string | null>;
  deleteCredential(ref: string): Promise<void>;

  resolveStreamUrl(credentialRef: string, urlTemplate: string): Promise<string | null>;

  /** Panel request made in the main process so the password stays there. */
  xtreamFetch(request: {
    credentialRef: string;
    urlTemplate: string;
    maxAgeMs?: number;
  }): Promise<
    { ok: true; body: string; fromCache: boolean } | { ok: false; message: string; status: number }
  >;
  xtreamClearCache(): Promise<void>;

  startTranscode(sourceUrl: string): Promise<TranscodeSession>;
  stopTranscode(sessionUrl: string): Promise<void>;
  setLaunchAtStartup(enabled: boolean): Promise<void>;
  openExternal(url: string): Promise<void>;
  searchSubtitles(request: {
    apiKey: string;
    languages: string;
    query?: string;
    tmdbId?: number | null;
    year?: number | null;
    season?: number | null;
    episode?: number | null;
  }): Promise<SubtitleSearchResult[]>;
  downloadSubtitle(
    apiKey: string,
    fileId: number,
  ): Promise<{ text: string; fileName: string | null; remaining: number | null }>;
  listDownloads(): Promise<DownloadEntry[]>;
  startDownload(request: StartDownloadRequest): Promise<DownloadEntry>;
  cancelDownload(id: string): Promise<void>;
  removeDownload(id: string): Promise<void>;
  /** Local playback URL for a completed download. */
  downloadUrl(id: string): Promise<string>;
  /** Returns an unsubscribe function. */
  onDownloadState(listener: (entry: DownloadEntry) => void): () => void;
  getShellSettings(): Promise<ShellSettings>;
  setShellSettings(next: ShellSettings): Promise<void>;
  /** Returns the saved path, or null when cancelled. */
  exportLogs(): Promise<string | null>;
  getUpdateState(): Promise<UpdateState>;
  checkForUpdate(): Promise<UpdateState>;
  downloadUpdate(): Promise<void>;
  installUpdate(): Promise<void>;
  /** Returns an unsubscribe function. */
  onUpdateState(listener: (state: UpdateState) => void): () => void;
  getAppInfo(): Promise<{
    version: string;
    platform: string;
    ignoreCertificateErrors: boolean;
  }>;
}

declare global {
  interface Window {
    iptvDesktop?: DesktopBridge;
  }
}

export function getDesktopBridge(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  return window.iptvDesktop ?? null;
}

export function isDesktop(): boolean {
  return getDesktopBridge() !== null;
}

export function isHttpsPage(): boolean {
  if (typeof window === "undefined") return true;

  if (isDesktop()) return false;
  return window.location.protocol === "https:";
}

export function canUseInsecureStreams(): boolean {
  return isDesktop() || !isHttpsPage();
}
