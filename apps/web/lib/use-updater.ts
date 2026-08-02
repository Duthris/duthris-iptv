"use client";

import * as React from "react";

import { getDesktopBridge, type UpdateState } from "@/lib/platform";

export interface Updater {
  state: UpdateState;
  supported: boolean;
  check: () => void;
  download: () => void;
  install: () => void;
}

/**
 * Update state, mirrored from the main process.
 *
 * The check itself runs there — the renderer only reflects what it reports and
 * asks it to move to the next step. Web builds have no updater at all, so the
 * hook reports an idle, unsupported state rather than needing callers to guard.
 */
export function useUpdater(): Updater {
  const [state, setState] = React.useState<UpdateState>({ status: "idle" });
  const bridge = getDesktopBridge();
  const supported = bridge !== null;

  React.useEffect(() => {
    const desktop = getDesktopBridge();
    if (!desktop) return;

    void desktop.getUpdateState().then(setState).catch(() => undefined);
    return desktop.onUpdateState(setState);
  }, []);

  const check = React.useCallback(() => {
    void getDesktopBridge()?.checkForUpdate().catch(() => undefined);
  }, []);

  const download = React.useCallback(() => {
    void getDesktopBridge()?.downloadUpdate().catch(() => undefined);
  }, []);

  const install = React.useCallback(() => {
    void getDesktopBridge()?.installUpdate().catch(() => undefined);
  }, []);

  return { state, supported, check, download, install };
}
