"use client";

import * as React from "react";

import { parseSubtitles, type SubtitleCue } from "@/lib/subtitles";

const POLL_INTERVAL_MS = 4_000;

const IDLE_POLLS_BEFORE_STOP = 4;

export function useSubtitleTrack(
  subtitleUrl: string | null,
  enabled: boolean,

  restartKey: string,
): SubtitleCue[] {
  const [cues, setCues] = React.useState<SubtitleCue[]>([]);

  React.useEffect(() => {
    setCues([]);

    if (!enabled || !subtitleUrl) return;

    let cancelled = false;
    let idlePolls = 0;
    let lastLength = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const response = await fetch(subtitleUrl, { cache: "no-store" });
        if (cancelled || !response.ok) return;

        const text = await response.text();
        if (cancelled) return;

        if (text.length === lastLength) {
          idlePolls += 1;
        } else {
          idlePolls = 0;
          lastLength = text.length;
          setCues(parseSubtitles(text));
        }
      } catch {
        // The session may have been torn down mid-request; nothing to report.
      } finally {
        if (!cancelled && idlePolls < IDLE_POLLS_BEFORE_STOP) {
          timer = setTimeout(() => void poll(), POLL_INTERVAL_MS);
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [subtitleUrl, enabled, restartKey]);

  return cues;
}
