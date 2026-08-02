import { BrowserWindow, app, shell } from "electron";
import { join } from "node:path";

import { configureSecureDns } from "./dns.js";
import { registerIpcHandlers } from "./ipc.js";
import { registerUpdater } from "./updater.js";
import { initLogs } from "./logs.js";
import { pruneXtreamCache } from "./xtream.js";
import {
  downloadMediaPath,
  registerDownloadWindow,
  shutdownDownloads,
} from "./downloads.js";
import { setLocalFileResolver } from "./transcode.js";
import {
  destroyTray,
  markQuitting,
  registerTray,
  shouldHideOnClose,
  startedHidden,
  syncTray,
} from "./tray.js";
import {
  RENDERER_ORIGIN,
  handleRendererScheme,
  registerRendererScheme,
} from "./renderer-protocol.js";
import { installNetworkPolicies } from "./security.js";
import { shutdownTranscodeServer } from "./transcode.js";

const devServer = process.env["IPTV_DEV_SERVER"] ?? null;
const isDev = devServer !== null;

let mainWindow: BrowserWindow | null = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

if (!isDev) registerRendererScheme();

app.on("second-instance", () => {
  // The lock stops a second copy starting, so this is the only path back when
  // the first one is running without a window.
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#0B0911", // tokens.ts > darkTheme.background
    title: "Duthris IPTV",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),

      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,

      webSecurity: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    if (!startedHidden()) mainWindow?.show();
    // Started at login with no window on screen: without an icon there would
    // be no way to reach the app at all.
    syncTray();
  });

  mainWindow.on("close", (event) => {
    if (!shouldHideOnClose()) return;
    event.preventDefault();
    mainWindow?.hide();
  });

  // The icon follows the window rather than the setting, so turning the setting
  // off while hidden still leaves a way back.
  mainWindow.on("show", syncTray);
  mainWindow.on("hide", syncTray);

  mainWindow.on("closed", () => {
    mainWindow = null;
    syncTray();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowed =
      (isDev && devServer !== null && url.startsWith(devServer)) || url.startsWith(RENDERER_ORIGIN);
    if (allowed) return;

    event.preventDefault();
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
  });

  if (isDev && devServer) {
    void mainWindow.loadURL(devServer);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadURL(`${RENDERER_ORIGIN}/index.html`);
  }
}

app.whenReady().then(() => {
  if (!isDev) handleRendererScheme();
  installNetworkPolicies(devServer);
  void initLogs();
  void pruneXtreamCache();
  registerIpcHandlers(() => mainWindow);
  registerUpdater(() => mainWindow);
  registerDownloadWindow(() => mainWindow);
  setLocalFileResolver(downloadMediaPath);
  // Only registers the accessor; the icon itself appears when a window hides.
  registerTray(() => mainWindow);

  void configureSecureDns();

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", markQuitting);

app.on("window-all-closed", () => {
  // Reaching here means the window really closed: hiding to the tray prevents
  // the close, so this never fires in that case. Staying alive without a
  // window left a process only the tray menu could end.
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", shutdownTranscodeServer);
app.on("before-quit", shutdownDownloads);
app.on("before-quit", destroyTray);
