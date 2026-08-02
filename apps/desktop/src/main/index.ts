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
  createTray,
  destroyTray,
  isQuitting,
  markQuitting,
  shouldHideOnClose,
  startedHidden,
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
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
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
  });

  mainWindow.on("close", (event) => {
    if (!shouldHideOnClose()) return;
    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
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
  createTray(() => mainWindow);

  void configureSecureDns();

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", markQuitting);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && isQuitting()) app.quit();
});

app.on("before-quit", shutdownTranscodeServer);
app.on("before-quit", shutdownDownloads);
app.on("before-quit", destroyTray);
