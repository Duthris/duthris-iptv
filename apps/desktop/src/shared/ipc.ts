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
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];

export interface PickedPlaylistFile {
  name: string;
  content: string;
}

export const SECRET_PLACEHOLDER = "__IPTV_SECRET__";

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
