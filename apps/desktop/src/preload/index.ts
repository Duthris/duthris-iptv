import { contextBridge, ipcRenderer } from "electron";

import {
  IPC,
  SECRET_PLACEHOLDER,
  type AppInfo,
  type PickedPlaylistFile,
  type TranscodeSession,
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

  startTranscode: (sourceUrl: string): Promise<TranscodeSession> =>
    ipcRenderer.invoke(IPC.startTranscode, sourceUrl),

  stopTranscode: (sessionUrl: string): Promise<void> =>
    ipcRenderer.invoke(IPC.stopTranscode, sessionUrl),

  setLaunchAtStartup: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC.setLaunchAtStartup, enabled),

  openExternal: (url: string): Promise<void> => ipcRenderer.invoke(IPC.openExternal, url),

  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke(IPC.getAppInfo),
};

contextBridge.exposeInMainWorld("iptvDesktop", bridge);

export type DesktopBridge = typeof bridge;
