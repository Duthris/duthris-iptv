import { BrowserWindow, Menu, Tray, app, nativeImage } from "electron";
import { join } from "node:path";

/**
 * Tray icon and window behaviour.
 *
 * Closing the window hides it rather than quitting, so the app stays reachable
 * from the tray the way a television does — but only after the user has asked
 * for that, since silently refusing to close is hostile. Quitting from the tray
 * menu, or from the taskbar, still ends the process.
 *
 * The icon exists only while a window is hidden. It is the way back to a window
 * that cannot be clicked, so with a window on screen it has nothing to offer,
 * and with the setting off it must never appear at all.
 */
let tray: Tray | null = null;
let quitting = false;
let getWindowRef: (() => BrowserWindow | null) | null = null;

export function isQuitting(): boolean {
  return quitting;
}

export function markQuitting(): void {
  quitting = true;
}

function iconPath(): string {
  // Packaged builds keep the icon next to the renderer; development reads it
  // from the build directory the generator writes to.
  return app.isPackaged
    ? join(process.resourcesPath, "renderer", "icons", "icon-192.png")
    : join(app.getAppPath(), "build", "icon.png");
}

export interface TrayOptions {
  minimiseToTray: boolean;
}

let options: TrayOptions = { minimiseToTray: false };

export function setTrayOptions(next: TrayOptions): void {
  options = next;
}

export function shouldHideOnClose(): boolean {
  return options.minimiseToTray && !quitting;
}

export function registerTray(getWindow: () => BrowserWindow | null): void {
  getWindowRef = getWindow;
}

function buildTray(): void {
  if (tray) return;

  const image = nativeImage.createFromPath(iconPath());
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image.resize({ width: 16, height: 16 }));
  tray.setToolTip("Duthris IPTV");

  const show = () => {
    const window = getWindowRef?.() ?? null;
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  };

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Duthris IPTV", enabled: false },
      { type: "separator" },
      { label: "Göster", click: show },
      {
        label: "Çıkış",
        click: () => {
          markQuitting();
          app.quit();
        },
      },
    ]),
  );

  tray.on("click", show);
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}

/**
 * Brings the icon into line with what is on screen.
 *
 * Called whenever a window appears or disappears. A leftover icon is worse
 * than none: clicking it reaches a window that no longer exists, and the
 * single-instance lock then stops the app being started again.
 */
export function syncTray(): void {
  const window = getWindowRef?.() ?? null;
  const wanted = window !== null && !window.isDestroyed() && !window.isVisible();

  if (wanted) buildTray();
  else destroyTray();
}

export function setLaunchAtStartup(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    // Starting straight into a visible window on every boot would be rude; the
    // tray entry is enough to show it is running.
    args: enabled ? ["--hidden"] : [],
  });
}

export function launchAtStartupEnabled(): boolean {
  return app.getLoginItemSettings().openAtLogin;
}

export function startedHidden(): boolean {
  return process.argv.includes("--hidden");
}
