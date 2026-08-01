"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import type { NowNext } from "@iptv/db";
import { cn } from "@iptv/ui";

import { useGuideTime } from "@/lib/use-guide-time";
import { programProgress } from "@/lib/use-epg";

export interface NowPlayingProps {
  channelName: string;
  nowNext: NowNext | undefined;

  guideLoaded: boolean;
  className?: string;
}

export function NowPlaying({ channelName, nowNext, guideLoaded, className }: NowPlayingProps) {
  const { formatTime, shiftMs } = useGuideTime();
  const current = nowNext?.now ?? null;
  const upcoming = nowNext?.next ?? null;
  const progress = programProgress(current);

  return (
    <div className={cn("flex shrink-0 flex-col gap-1.5", className)}>
      <h2 className="text-md text-foreground truncate font-semibold tracking-tight">
        {channelName}
      </h2>

      {current ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-2">
            <span className="text-foreground truncate text-sm">{current.title}</span>
            <span className="tabular text-2xs text-muted-foreground shrink-0">
              {formatTime(current.start + shiftMs)} – {formatTime(current.stop + shiftMs)}
            </span>
          </div>

          {progress !== null ? (
            <div className="bg-surface-3 h-1 w-full max-w-md overflow-hidden rounded-full">
              <div
                className="bg-primary duration-slow ease-brand h-full rounded-full transition-[width]"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          ) : null}

          {current.desc ? (
            <p className="line-clamp-2-safe text-muted-foreground max-w-2xl text-xs leading-relaxed">
              {current.desc}
            </p>
          ) : null}

          {upcoming ? (
            <p className="text-2xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="size-3 shrink-0" />
              <span className="tabular shrink-0">{formatTime(upcoming.start + shiftMs)}</span>
              <span className="truncate">{upcoming.title}</span>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          {guideLoaded
            ? "Bu kanal için program bilgisi yok."
            : "Program bilgisi için Playlistler ekranından TV rehberini indirin."}
        </p>
      )}
    </div>
  );
}
