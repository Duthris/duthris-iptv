import { BrowserWindow, app, dialog, ipcMain, shell } from "electron";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import {
  IPC,
  SECRET_PLACEHOLDER,
  type AppInfo,
  type PickedPlaylistFile,
  type ResolveStreamRequest,
} from "../shared/ipc.js";
import { deleteCredential, readCredential, saveCredential } from "./credentials.js";
import { createTranscodeSession, stopTranscodeSession } from "./transcode.js";

const MAX_PLAYLIST_BYTES = 200 * 1024 * 1024;

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC.pickPlaylistFile, async (): Promise<PickedPlaylistFile | null> => {
    const window = getWindow();
    if (!window) return null;

    const result = await dialog.showOpenDialog(window, {
      title: "M3U playlist seç",
      properties: ["openFile"],
      filters: [
        { name: "M3U playlist", extensions: ["m3u", "m3u8"] },
        { name: "Tüm dosyalar", extensions: ["*"] },
      ],
    });

    const path = result.filePaths[0];
    if (result.canceled || !path) return null;

    const content = await readFile(path, "utf8");
    if (content.length > MAX_PLAYLIST_BYTES) {
      throw new Error("Dosya çok büyük");
    }

    return { name: basename(path).replace(/\.(m3u8?|txt)$/i, ""), content };
  });

  ipcMain.handle(IPC.saveCredential, (_event, ref: string, secret: string) => {
    saveCredential(ref, secret);
  });

  ipcMain.handle(IPC.hasCredential, (_event, ref: string) => {
    return readCredential(ref) !== null;
  });

  ipcMain.handle(IPC.revealCredential, (_event, ref: string) => {
    return readCredential(ref);
  });

  ipcMain.handle(IPC.deleteCredential, (_event, ref: string) => {
    deleteCredential(ref);
  });

  ipcMain.handle(IPC.resolveStreamUrl, (_event, request: ResolveStreamRequest): string | null => {
    const secret = readCredential(request.credentialRef);
    if (secret === null) return null;

    return request.urlTemplate
      .split(encodeURIComponent(SECRET_PLACEHOLDER))
      .join(encodeURIComponent(secret))
      .split(SECRET_PLACEHOLDER)
      .join(encodeURIComponent(secret));
  });

  ipcMain.handle(IPC.startTranscode, async (_event, sourceUrl: string) => {
    return createTranscodeSession(sourceUrl);
  });

  ipcMain.handle(IPC.stopTranscode, (_event, sessionUrl: string) => {
    stopTranscodeSession(sessionUrl);
  });

  ipcMain.handle(IPC.setLaunchAtStartup, (_event, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath });
  });

  ipcMain.handle(IPC.openExternal, async (_event, url: string) => {
    if (!/^https?:\/\//i.test(url)) return;
    await shell.openExternal(url);
  });

  ipcMain.handle(IPC.getAppInfo, (): AppInfo => {
    return {
      version: app.getVersion(),
      platform: process.platform,
      ignoreCertificateErrors: true,
    };
  });
}
