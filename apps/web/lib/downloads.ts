"use client";

import * as React from "react";

import { getDesktopBridge, type DownloadEntry } from "@/lib/platform";

/**
 * Offline copies, kept and converted by the main process.
 *
 * Desktop only: the conversion is ffmpeg's and the files live on disk, neither
 * of which a browser can do. The hook reports an empty list elsewhere so
 * callers do not have to guard.
 */
export function downloadsAvailable(): boolean {
  return getDesktopBridge() !== null;
}

export function downloadIdFor(kind: "vod" | "episode", itemId: string): string {
  // Item ids already carry the source; hashing would only make the folder
  // unreadable when someone looks at it.
  return `${kind}-${itemId.replace(/[^a-zA-Z0-9]+/g, "_")}`;
}

export function useDownloads(): {
  entries: DownloadEntry[];
  refresh: () => void;
  byItem: Map<string, DownloadEntry>;
} {
  const [entries, setEntries] = React.useState<DownloadEntry[]>([]);

  const refresh = React.useCallback(() => {
    void getDesktopBridge()
      ?.listDownloads()
      .then(setEntries)
      .catch(() => undefined);
  }, []);

  React.useEffect(() => {
    const bridge = getDesktopBridge();
    if (!bridge) return;

    refresh();

    // Progress arrives as events rather than polling, so a long conversion does
    // not mean a timer running for an hour.
    return bridge.onDownloadState((entry) => {
      setEntries((current) => {
        // A cancelled download is gone on disk too, so keeping the row would
        // only re-add what the user just dismissed.
        if (entry.status === "cancelled") {
          return current.filter((row) => row.id !== entry.id);
        }

        const index = current.findIndex((row) => row.id === entry.id);
        if (index === -1) return [entry, ...current];
        const next = [...current];
        next[index] = entry;
        return next;
      });
    });
  }, [refresh]);

  const byItem = React.useMemo(() => {
    const map = new Map<string, DownloadEntry>();
    for (const entry of entries) map.set(entry.itemId, entry);
    return map;
  }, [entries]);

  return { entries, refresh, byItem };
}

export async function startDownload(input: {
  url: string;
  title: string;
  poster?: string | null;
  kind: "vod" | "episode";
  itemId: string;
}): Promise<DownloadEntry | null> {
  const bridge = getDesktopBridge();
  if (!bridge) return null;
  return bridge.startDownload({ ...input, id: downloadIdFor(input.kind, input.itemId) });
}

export async function localPlaybackUrl(entry: DownloadEntry): Promise<string | null> {
  const bridge = getDesktopBridge();
  if (!bridge || entry.status !== "done") return null;
  return bridge.downloadUrl(entry.id);
}
