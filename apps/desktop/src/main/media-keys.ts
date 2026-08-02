import { BrowserWindow, globalShortcut } from "electron";

import { IPC, type MediaKeyCommand } from "../shared/ipc.js";
import { record } from "./logs.js";

/**
 * The media keys, claimed system-wide.
 *
 * Media Session already covers the keys while this window has focus; this is
 * for the case it cannot reach — the app playing in the background while
 * something else is in front.
 *
 * Off by default, and deliberately so: these keys are shared, and quietly
 * taking them from whatever else the user plays music with would be rude. A
 * global shortcut is exclusive, so the first registrant wins.
 */

const BINDINGS: Array<{ accelerator: string; command: MediaKeyCommand }> = [
  { accelerator: "MediaPlayPause", command: "playpause" },
  { accelerator: "MediaNextTrack", command: "next" },
  { accelerator: "MediaPreviousTrack", command: "previous" },
  { accelerator: "MediaStop", command: "stop" },
];

let registered = false;

export function setGlobalMediaKeys(enabled: boolean, getWindow: () => BrowserWindow | null): void {
  if (enabled === registered) return;

  if (!enabled) {
    for (const { accelerator } of BINDINGS) globalShortcut.unregister(accelerator);
    registered = false;
    return;
  }

  const failed: string[] = [];

  for (const { accelerator, command } of BINDINGS) {
    const ok = globalShortcut.register(accelerator, () => {
      getWindow()?.webContents.send(IPC.mediaKeyEvent, command);
    });
    if (!ok) failed.push(accelerator);
  }

  registered = true;

  // Another application holds them; nothing to do but say so in the log.
  if (failed.length > 0) {
    record(`[media-keys] alınamadı: ${failed.join(", ")}`);
  }
}

export function releaseGlobalMediaKeys(): void {
  for (const { accelerator } of BINDINGS) globalShortcut.unregister(accelerator);
  registered = false;
}
