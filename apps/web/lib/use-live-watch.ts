"use client";

import * as React from "react";
import type { ChannelListItem } from "@iptv/db";
import { recordWatch } from "@iptv/db";

const MIN_SESSION_SECS = 30;

const FLUSH_INTERVAL_MS = 60_000;

export function useLiveWatch(
  channel: ChannelListItem | null,
  profileId: string | null,
  playing: boolean,
): void {
  const startedAt = React.useRef<number | null>(null);
  const counted = React.useRef(false);
  const pendingSecs = React.useRef(0);

  const flush = React.useCallback(
    (target: ChannelListItem, owner: string, final: boolean) => {
      if (startedAt.current !== null) {
        pendingSecs.current += (Date.now() - startedAt.current) / 1000;
        startedAt.current = final ? null : Date.now();
      }

      const secs = pendingSecs.current;
      if (secs < MIN_SESSION_SECS && !counted.current) return;

      pendingSecs.current = 0;
      const isNew = !counted.current;
      counted.current = true;

      void recordWatch({
        profileId: owner,
        itemId: target.id,
        kind: "live",
        title: target.name,
        poster: target.logo,
        addSecs: secs,
        newSession: isNew,
      });
    },
    [],
  );

  React.useEffect(() => {
    if (!channel || !profileId) return;

    counted.current = false;
    pendingSecs.current = 0;
    startedAt.current = null;

    return () => {
      flush(channel, profileId, true);
    };
  }, [channel, profileId, flush]);

  React.useEffect(() => {
    if (!channel || !profileId) return;

    if (playing) startedAt.current = Date.now();
    else if (startedAt.current !== null) {
      pendingSecs.current += (Date.now() - startedAt.current) / 1000;
      startedAt.current = null;
    }
  }, [playing, channel, profileId]);

  React.useEffect(() => {
    if (!channel || !profileId || !playing) return;

    const timer = setInterval(() => flush(channel, profileId, false), FLUSH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [channel, profileId, playing, flush]);
}
