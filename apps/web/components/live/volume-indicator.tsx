"use client";

import { Volume1, Volume2, VolumeX } from "lucide-react";
import { cn } from "@iptv/ui";

export interface VolumeIndicatorProps {
  value: number;
  muted: boolean;
  visible: boolean;
}

export function VolumeIndicator({ value, muted, visible }: VolumeIndicatorProps) {
  const level = muted ? 0 : Math.min(1, Math.max(0, value));
  const percent = Math.round(level * 100);
  const Icon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute right-5 top-1/2 z-20 -translate-y-1/2",
        "duration-base ease-brand-out transition-[opacity,transform]",
        visible ? "translate-x-0 opacity-100" : "translate-x-2 opacity-0",
      )}
    >
      <div
        className={cn(
          "flex flex-col items-center gap-3 rounded-full px-2.5 py-4",
          "bg-black/55 ring-1 ring-inset ring-white/10 backdrop-blur-md",
        )}
      >
        <span className="tabular text-2xs font-semibold leading-none text-white">
          {muted ? "0" : percent}
        </span>

        <div className="relative h-28 w-1.5 overflow-hidden rounded-full bg-white/25">
          <div
            className="bg-primary duration-fast ease-brand absolute inset-x-0 bottom-0 rounded-full transition-[height]"
            style={{ height: `${level * 100}%` }}
          />
        </div>

        <Icon className="size-4 text-white/85" />
      </div>
    </div>
  );
}
