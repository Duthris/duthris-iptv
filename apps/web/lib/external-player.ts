"use client";

import * as React from "react";
import { toast } from "sonner";

import { getDesktopBridge, type ExternalPlayerInfo } from "./platform";
import type { StreamTemplate } from "./resolve-stream";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * Handing a stream to mpv or VLC.
 *
 * They decode natively what our player has to convert, and they seek without
 * waiting. The URL is built with the bridge placeholder exactly as playback
 * does, so the password is substituted in the main process and never reaches
 * the command line we assemble here.
 */
export function externalPlayerAvailable(): boolean {
  return getDesktopBridge() !== null;
}

export function useDetectedPlayers(): ExternalPlayerInfo[] {
  const [players, setPlayers] = React.useState<ExternalPlayerInfo[]>([]);

  React.useEffect(() => {
    void getDesktopBridge()
      ?.listExternalPlayers()
      .then(setPlayers)
      .catch(() => undefined);
  }, []);

  return players;
}

export async function browseForPlayer(): Promise<ExternalPlayerInfo | null> {
  return (await getDesktopBridge()?.pickExternalPlayer()) ?? null;
}

/**
 * The whole hand-off, from the caller's point of view.
 *
 * Returns false when nothing was launched so the caller can leave its own
 * playback alone; it must stop that itself before calling, since the
 * subscription allows a single connection.
 */
export async function handOff(input: {
  template: StreamTemplate | null;
  title: string;
  startSecs?: number;
}): Promise<boolean> {
  const playerPath = useSettingsStore.getState().externalPlayerPath;
  if (!playerPath) {
    toast.error("Harici oynatıcı seçilmedi", { description: "Ayarlar › Masaüstü davranışı" });
    return false;
  }

  if (!input.template) {
    toast.error("Yayın adresi çözülemedi");
    return false;
  }

  const result = await openInExternalPlayer({
    playerPath,
    urlTemplate: input.template.urlTemplate,
    credentialRef: input.template.credentialRef,
    startSecs: input.startSecs ?? 0,
    title: input.title,
    userAgent: input.template.userAgent,
  });

  if (!result.ok) {
    toast.error("Harici oynatıcı açılamadı", { description: result.message });
    return false;
  }

  toast.success("Harici oynatıcıda açılıyor");
  return true;
}

export function externalPlayerChosen(): boolean {
  return useSettingsStore.getState().externalPlayerPath !== "";
}

export async function openInExternalPlayer(input: {
  playerPath: string;
  urlTemplate: string;
  credentialRef?: string | null;
  startSecs?: number;
  title: string;
  userAgent?: string | null;
}): Promise<{ ok: boolean; message?: string }> {
  const bridge = getDesktopBridge();
  if (!bridge) return { ok: false, message: "Yalnızca masaüstünde" };
  return bridge.openExternalPlayer(input);
}
