"use client";

import * as React from "react";
import { findStaleSources, updateSource } from "@iptv/db";

import { importEpg, refreshSource } from "./import/import-source";
import { usePlaylistStore } from "@/stores/playlist-store";
import { useSettingsStore } from "@/stores/settings-store";

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

const STARTUP_DELAY_MS = 60 * 1000;

export function useAutoRefresh(): void {
  const autoRefreshHours = useSettingsStore((state) => state.autoRefreshHours);
  const refreshSources = usePlaylistStore((state) => state.refresh);
  const running = React.useRef(false);

  React.useEffect(() => {
    if (autoRefreshHours <= 0) return;

    let cancelled = false;

    const tick = async () => {
      if (running.current || cancelled) return;
      running.current = true;

      try {
        const stale = await findStaleSources();
        for (const source of stale) {
          if (cancelled) break;
          if (source.refreshIntervalHours !== autoRefreshHours) {
            await updateSource(source.id, { refreshIntervalHours: autoRefreshHours });
          }

          try {
            if (source.kind !== "m3u-file") await refreshSource(source.id);
            if (source.epgUrl) await importEpg(source.id, source.epgUrl);
          } catch {
            // Silent by design: an unattended refresh failing is not something
            // to interrupt playback for. The error is recorded on the source
            // and shown on the Playlists screen.
          }
        }

        if (!cancelled && stale.length > 0) await refreshSources();
      } finally {
        running.current = false;
      }
    };

    const startup = setTimeout(() => void tick(), STARTUP_DELAY_MS);
    const timer = setInterval(() => void tick(), CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(startup);
      clearInterval(timer);
    };
  }, [autoRefreshHours, refreshSources]);
}
