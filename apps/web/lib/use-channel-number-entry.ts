"use client";

import * as React from "react";

const COMMIT_DELAY_MS = 1_200;

const NOT_FOUND_DELAY_MS = 1_400;

const MAX_DIGITS = 4;

export interface ChannelNumberEntry {
  digits: string;
  notFound: boolean;
}

export function useChannelNumberEntry(
  enabled: boolean,

  onCommit: (channelNumber: number) => boolean,
): ChannelNumberEntry {
  const [digits, setDigits] = React.useState("");
  const [notFound, setNotFound] = React.useState(false);
  const commitRef = React.useRef(onCommit);
  commitRef.current = onCommit;

  React.useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let buffer = "";

    const clearTimer = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };

    const reset = () => {
      buffer = "";
      setDigits("");
      setNotFound(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      if (event.key === "Escape" && buffer) {
        event.preventDefault();
        clearTimer();
        reset();
        return;
      }

      if (event.key === "Backspace" && buffer) {
        event.preventDefault();
        buffer = buffer.slice(0, -1);
        setDigits(buffer);
        if (!buffer) clearTimer();
        return;
      }

      if (!/^[0-9]$/.test(event.key)) return;

      event.preventDefault();
      if (buffer.length >= MAX_DIGITS) return;

      buffer += event.key;
      setDigits(buffer);
      setNotFound(false);

      clearTimer();
      timer = setTimeout(() => {
        const found = commitRef.current(Number(buffer));
        if (found) {
          reset();
          return;
        }

        setNotFound(true);
        timer = setTimeout(reset, NOT_FOUND_DELAY_MS);
      }, COMMIT_DELAY_MS);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimer();
    };
  }, [enabled]);

  return { digits, notFound };
}
