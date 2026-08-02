"use client";

import * as React from "react";

import { getDesktopBridge } from "./platform";

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

  /**
   * Needed only by the global media keys: the system sends one play/pause key
   * rather than the separate actions Media Session dispatches.
   */
  paused?: boolean;
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
  paused = false,
}: MediaSessionOptions): void {
  const callbacks = React.useRef({ onPlay, onPause, onPrevious, onNext, onSeekBy, paused });
  callbacks.current = { onPlay, onPause, onPrevious, onNext, onSeekBy, paused };

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

  /**
   * The same actions, driven from the system-wide media keys.
   *
   * Media Session only sees those keys while this window has focus, which is
   * exactly the case the desktop shortcut exists to cover. Both routes end in
   * the same callbacks, so behaviour cannot drift between them.
   */
  React.useEffect(() => {
    if (!active) return;
    const bridge = getDesktopBridge();
    if (!bridge) return;

    return bridge.onMediaKey((command) => {
      const current = callbacks.current;
      if (command === "playpause") {
        if (current.paused) current.onPlay();
        else current.onPause();
      } else if (command === "next") current.onNext?.();
      else if (command === "previous") current.onPrevious?.();
      else current.onPause();
    });
  }, [active]);
}

export function useMediaSessionState(paused: boolean, active: boolean): void {
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaSession) return;
    navigator.mediaSession.playbackState = !active ? "none" : paused ? "paused" : "playing";
  }, [paused, active]);
}
