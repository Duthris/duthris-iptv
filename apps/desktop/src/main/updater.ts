import { BrowserWindow, app, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";

import { IPC, type UpdateState } from "../shared/ipc.js";

/**
 * Self-update against the GitHub releases the packaging workflow publishes.
 *
 * Only the installer build can replace itself: a portable executable has no
 * installation to update, and running the downloaded installer from one would
 * put a second copy on the machine rather than upgrading the running one. That
 * case reports back as unsupported so the interface can say so plainly instead
 * of offering a button that cannot work.
 *
 * The executables are unsigned, so Windows will still show its warning when the
 * downloaded installer runs. Signature verification is therefore left off; with
 * no publisher name to check against it would only ever fail.
 */
let state: UpdateState = { status: "idle" };
let getWindow: () => BrowserWindow | null = () => null;

function isPortableBuild(): boolean {
  return Boolean(process.env["PORTABLE_EXECUTABLE_DIR"]);
}

function publish(next: UpdateState): void {
  state = next;
  console.info(`[updater] ${JSON.stringify(next)}`);
  getWindow()?.webContents.send(IPC.updateEvent, next);
}

export function registerUpdater(windowGetter: () => BrowserWindow | null): void {
  getWindow = windowGetter;

  ipcMain.handle(IPC.updateStatus, (): UpdateState => state);

  ipcMain.handle(IPC.updateCheck, async (): Promise<UpdateState> => {
    if (!app.isPackaged) {
      publish({ status: "unsupported", reason: "development" });
      return state;
    }
    if (isPortableBuild()) {
      publish({ status: "unsupported", reason: "portable" });
      return state;
    }

    publish({ status: "checking" });
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      publish({ status: "error", message: error instanceof Error ? error.message : "bilinmeyen" });
    }
    return state;
  });

  ipcMain.handle(IPC.updateDownload, async (): Promise<void> => {
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      publish({ status: "error", message: error instanceof Error ? error.message : "bilinmeyen" });
    }
  });

  /**
   * Quits and runs the installer. `isSilent` false so the user sees what is
   * happening — the build is unsigned and a silent installer would look like
   * something unpleasant happening on its own.
   */
  ipcMain.handle(IPC.updateInstall, (): void => {
    autoUpdater.quitAndInstall(false, true);
  });

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    publish({ status: "available", version: info.version, notes: null });
  });
  autoUpdater.on("update-not-available", () => {
    publish({ status: "current" });
  });
  autoUpdater.on("download-progress", (progress) => {
    publish({ status: "downloading", percent: Math.round(progress.percent) });
  });
  autoUpdater.on("update-downloaded", (info) => {
    publish({ status: "ready", version: info.version });
  });
  autoUpdater.on("error", (error) => {
    publish({ status: "error", message: error.message });
  });

  /**
   * A check on startup, delayed so it never competes with the first paint or
   * with the catalog load. Failures are silent here; the settings screen has an
   * explicit button for when someone actually wants to know.
   */
  if (app.isPackaged && !isPortableBuild()) {
    setTimeout(() => {
      void autoUpdater.checkForUpdates().catch(() => undefined);
    }, 8000);
  }
}
