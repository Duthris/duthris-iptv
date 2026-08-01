"use client";

import * as React from "react";
import { cn } from "@iptv/ui";

import type { SubtitleStyle } from "@/stores/settings-store";

export interface SubtitleOverlayProps {
  text: string | null;
  style: SubtitleStyle;

  controlsVisible: boolean;
}

const SIZE_STEPS: Record<SubtitleStyle["size"], string> = {
  small: "2.4cqw",
  medium: "3.1cqw",
  large: "3.9cqw",
  xlarge: "4.8cqw",
};

export function SubtitleOverlay({ text, style, controlsVisible }: SubtitleOverlayProps) {
  if (!text) return null;

  return (
    <div
      aria-live="polite"
      className={cn(
        "pointer-events-none absolute inset-x-0 z-20 flex justify-center px-[6%]",
        "duration-base ease-brand transition-[bottom]",
        controlsVisible ? "bottom-[14%]" : "bottom-[6%]",
      )}
    >
      <p
        className={cn(
          "max-w-[90%] whitespace-pre-line text-center font-medium leading-snug",
          style.background ? "rounded-md bg-black/65 px-2.5 py-1" : null,
        )}
        style={{
          fontSize: SIZE_STEPS[style.size],
          color: style.color,

          textShadow: style.background
            ? undefined
            : "0 1px 3px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.8)",
        }}
      >
        {text}
      </p>
    </div>
  );
}
