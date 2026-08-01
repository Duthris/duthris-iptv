"use client";

import * as React from "react";

export interface MediaSessionOptions {
  title: string;

  subtitle?: string | null;
  artwork?: string | null;
  active: boolean;
  onPlay: () => void;
  onPause: () => void;
  onPrevious?: (() => void) | undefined;
  onNext?: (() => void) | undefined;

  onSeekBy?: ((seconds: number) => void) | undefined;
}

type MediaSessionAction =
  "play" | "pause" | "previoustrack" | "nexttrack" | "seekbackward" | "seekforward";

function setHandler(action: MediaSessionAction, handler: (() => void) | null): void {
  try {
    navigator.mediaSession?.setActionHandler(action as never, handler as never);
  } catch {
    // Action unsupported in this browser — ignore, the rest still register.
  }
}

export function useMediaSession({
  title,
  subtitle,
  artwork,
  active,
  onPlay,
  onPause,
  onPrevious,
  onNext,
  onSeekBy,
}: MediaSessionOptions): void {
  const callbacks = React.useRef({ onPlay, onPause, onPrevious, onNext, onSeekBy });
  callbacks.current = { onPlay, onPause, onPrevious, onNext, onSeekBy };

  const hasPrevious = Boolean(onPrevious);
  const hasNext = Boolean(onNext);
  const hasSeek = Boolean(onSeekBy);

  React.useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaSession || !active) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: subtitle ?? "",
      album: "Duthris IPTV",

      artwork: artwork ? [{ src: artwork, sizes: "512x512" }] : [],
    });

    setHandler("play", () => callbacks.current.onPlay());
    setHandler("pause", () => callbacks.current.onPause());
    setHandler("previoustrack", hasPrevious ? () => callbacks.current.onPrevious?.() : null);
    setHandler("nexttrack", hasNext ? () => callbacks.current.onNext?.() : null);
    setHandler("seekbackward", hasSeek ? () => callbacks.current.onSeekBy?.(-10) : null);
    setHandler("seekforward", hasSeek ? () => callbacks.current.onSeekBy?.(10) : null);

    return () => {
      setHandler("play", null);
      setHandler("pause", null);
      setHandler("previoustrack", null);
      setHandler("nexttrack", null);
      setHandler("seekbackward", null);
      setHandler("seekforward", null);
      if (navigator.mediaSession) navigator.mediaSession.metadata = null;
    };
  }, [title, subtitle, artwork, active, hasPrevious, hasNext, hasSeek]);
}

export function useMediaSessionState(paused: boolean, active: boolean): void {
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaSession) return;
    navigator.mediaSession.playbackState = !active ? "none" : paused ? "paused" : "playing";
  }, [paused, active]);
}
