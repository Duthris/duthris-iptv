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

export interface DesktopBridge {
  isDesktop: true;

  secretPlaceholder: string;
  pickPlaylistFile(): Promise<PickedPlaylistFile | null>;
  saveCredential(ref: string, secret: string): Promise<void>;

  hasCredential(ref: string): Promise<boolean>;

  revealCredential(ref: string): Promise<string | null>;
  deleteCredential(ref: string): Promise<void>;

  resolveStreamUrl(credentialRef: string, urlTemplate: string): Promise<string | null>;

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
