"use client";

import * as React from "react";
import type { NowNext } from "@iptv/db";
import { getMappingsByChannelId, getNowNextForAll } from "@iptv/db";

const REFRESH_MS = 60_000;

export interface EpgSnapshot {
  byChannelId: Map<string, NowNext>;

  mappings: Map<string, string>;
  loaded: boolean;

  empty: boolean;
}

const EMPTY: EpgSnapshot = {
  byChannelId: new Map(),
  mappings: new Map(),
  loaded: false,
  empty: true,
};

export function useEpg(enabled = true): EpgSnapshot {
  const [snapshot, setSnapshot] = React.useState<EpgSnapshot>(EMPTY);

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      const [mappings, nowNext] = await Promise.all([getMappingsByChannelId(), getNowNextForAll()]);
      if (cancelled) return;

      const byChannelId = new Map<string, NowNext>();
      for (const [channelId, channelKey] of mappings) {
        const entry = nowNext.get(channelKey);
        if (entry && (entry.now || entry.next)) byChannelId.set(channelId, entry);
      }

      setSnapshot({
        byChannelId,
        mappings,
        loaded: true,
        empty: nowNext.size === 0,
      });
    };

    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled]);

  return snapshot;
}

export function programProgress(
  program: { start: number; stop: number } | null | undefined,
  at = Date.now(),
): number | null {
  if (!program) return null;
  const span = program.stop - program.start;
  if (span <= 0) return null;
  const ratio = (at - program.start) / span;
  if (ratio < 0 || ratio > 1) return null;
  return ratio;
}
