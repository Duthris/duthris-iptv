import { contextBridge, ipcRenderer } from "electron";

import {
  IPC,
  SECRET_PLACEHOLDER,
  type AppInfo,
  type PickedPlaylistFile,
  type SubtitleDownloadResult,
  type SubtitleSearchRequest,
  type SubtitleSearchResult,
  type TranscodeSession,
  type DownloadEntry,
  type ShellSettings,
  type StartDownloadRequest,
  type UpdateState,
  type XtreamFetchRequest,
  type XtreamFetchResult,
  type ExternalPlayer,
  type MediaKeyCommand,
  type OpenExternalRequest,
} from "../shared/ipc.js";

const bridge = {
  isDesktop: true as const,

  secretPlaceholder: SECRET_PLACEHOLDER,

  pickPlaylistFile: (): Promise<PickedPlaylistFile | null> =>
    ipcRenderer.invoke(IPC.pickPlaylistFile),

  saveCredential: (ref: string, secret: string): Promise<void> =>
    ipcRenderer.invoke(IPC.saveCredential, ref, secret),

  hasCredential: (ref: string): Promise<boolean> => ipcRenderer.invoke(IPC.hasCredential, ref),

  revealCredential: (ref: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.revealCredential, ref),

  deleteCredential: (ref: string): Promise<void> => ipcRenderer.invoke(IPC.deleteCredential, ref),

  resolveStreamUrl: (credentialRef: string, urlTemplate: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.resolveStreamUrl, { credentialRef, urlTemplate }),

  xtreamFetch: (request: XtreamFetchRequest): Promise<XtreamFetchResult> =>
    ipcRenderer.invoke(IPC.xtreamFetch, request),

  xtreamClearCache: (): Promise<void> => ipcRenderer.invoke(IPC.xtreamClearCache),

  onMediaKey: (handler: (command: MediaKeyCommand) => void): (() => void) => {
    const listener = (_event: unknown, command: MediaKeyCommand) => handler(command);
    ipcRenderer.on(IPC.mediaKeyEvent, listener);
    return () => ipcRenderer.removeListener(IPC.mediaKeyEvent, listener);
  },

  trailerEmbedUrl: (videoId: string): Promise<string> =>
    ipcRenderer.invoke(IPC.trailerEmbedUrl, videoId),

  listExternalPlayers: (): Promise<ExternalPlayer[]> =>
    ipcRenderer.invoke(IPC.listExternalPlayers),

  pickExternalPlayer: (): Promise<ExternalPlayer | null> =>
    ipcRenderer.invoke(IPC.pickExternalPlayer),

  openExternalPlayer: (
    request: OpenExternalRequest,
  ): Promise<{ ok: boolean; message?: string }> =>
    ipcRenderer.invoke(IPC.openExternalPlayer, request),

  startTranscode: (sourceUrl: string): Promise<TranscodeSession> =>
    ipcRenderer.invoke(IPC.startTranscode, sourceUrl),

  stopTranscode: (sessionUrl: string): Promise<void> =>
    ipcRenderer.invoke(IPC.stopTranscode, sessionUrl),

  setLaunchAtStartup: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC.setLaunchAtStartup, enabled),

  openExternal: (url: string): Promise<void> => ipcRenderer.invoke(IPC.openExternal, url),

  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC.getAppInfo),

  listDownloads: (): Promise<DownloadEntry[]> => ipcRenderer.invoke(IPC.listDownloads),
  startDownload: (request: StartDownloadRequest): Promise<DownloadEntry> =>
    ipcRenderer.invoke(IPC.startDownload, request),
  cancelDownload: (id: string): Promise<void> => ipcRenderer.invoke(IPC.cancelDownload, id),
  removeDownload: (id: string): Promise<void> => ipcRenderer.invoke(IPC.removeDownload, id),
  downloadUrl: (id: string): Promise<string> => ipcRenderer.invoke(IPC.downloadUrl, id),

  onDownloadState: (listener: (entry: DownloadEntry) => void): (() => void) => {
    const handler = (_event: unknown, entry: DownloadEntry) => listener(entry);
    ipcRenderer.on(IPC.downloadEvent, handler);
    return () => ipcRenderer.removeListener(IPC.downloadEvent, handler);
  },

  getShellSettings: (): Promise<ShellSettings> => ipcRenderer.invoke(IPC.getShellSettings),
  setShellSettings: (next: ShellSettings): Promise<void> =>
    ipcRenderer.invoke(IPC.setShellSettings, next),
  exportLogs: (): Promise<string | null> => ipcRenderer.invoke(IPC.exportLogs),

  getUpdateState: (): Promise<UpdateState> => ipcRenderer.invoke(IPC.updateStatus),
  checkForUpdate: (): Promise<UpdateState> => ipcRenderer.invoke(IPC.updateCheck),
  downloadUpdate: (): Promise<void> => ipcRenderer.invoke(IPC.updateDownload),
  installUpdate: (): Promise<void> => ipcRenderer.invoke(IPC.updateInstall),

  onUpdateState: (listener: (state: UpdateState) => void): (() => void) => {
    const handler = (_event: unknown, state: UpdateState) => listener(state);
    ipcRenderer.on(IPC.updateEvent, handler);
    return () => ipcRenderer.removeListener(IPC.updateEvent, handler);
  },

  searchSubtitles: (request: SubtitleSearchRequest): Promise<SubtitleSearchResult[]> =>
    ipcRenderer.invoke(IPC.searchSubtitles, request),

  downloadSubtitle: (apiKey: string, fileId: number): Promise<SubtitleDownloadResult> =>
    ipcRenderer.invoke(IPC.downloadSubtitle, apiKey, fileId),
};

contextBridge.exposeInMainWorld("iptvDesktop", bridge);

export type DesktopBridge = typeof bridge;
