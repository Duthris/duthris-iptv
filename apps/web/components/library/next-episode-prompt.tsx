"use client";

import * as React from "react";
import { Play, X } from "lucide-react";
import { Button, cn } from "@iptv/ui";

export interface NextEpisodePromptProps {
  title: string;
  subtitle: string;
  poster?: string | null;
  seconds: number;
  onPlayNow: () => void;
  onCancel: () => void;
}

export function NextEpisodePrompt({
  title,
  subtitle,
  poster,
  seconds,
  onPlayNow,
  onCancel,
}: NextEpisodePromptProps) {
  const [posterFailed, setPosterFailed] = React.useState(false);

  const radius = 18;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className={cn(
        "absolute inset-0 z-30 flex items-end justify-end p-4 sm:p-6",
        "bg-gradient-to-t from-black/85 via-black/40 to-transparent",
        "animate-fade-in",
      )}
    >
      <div
        className={cn(
          "flex w-full max-w-sm items-center gap-4 rounded-lg p-3.5",
          "ring-white/12 bg-black/70 ring-1 ring-inset backdrop-blur-md",
        )}
      >
        {poster && !posterFailed ? (
          <img
            src={poster}
            alt=""
            onError={() => setPosterFailed(true)}
            className="hidden size-14 shrink-0 rounded-md object-cover sm:block"
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-2xs font-medium uppercase tracking-wide text-white/55">
            Sıradaki bölüm
          </span>
          <span className="truncate text-sm font-medium text-white">{title}</span>
          <span className="text-2xs truncate text-white/60">{subtitle}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onPlayNow}
            aria-label={`Hemen geç — ${seconds} saniye içinde otomatik başlayacak`}
            className={cn(
              "relative grid size-11 place-items-center rounded-full",
              "bg-white/12 duration-fast hover:bg-white/22 text-white transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
            )}
          >
            <svg viewBox="0 0 44 44" className="absolute inset-0 size-full -rotate-90">
              <circle
                cx="22"
                cy="22"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-white/20"
              />
              <circle
                cx="22"
                cy="22"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="text-primary"
                style={{
                  strokeDasharray: circumference,
                  strokeDashoffset: circumference * (1 - seconds / 5),
                  transition: "stroke-dashoffset 1s linear",
                }}
              />
            </svg>
            <Play className="size-4 fill-current" />
          </button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onCancel}
            aria-label="İptal"
            className="hover:bg-white/12 text-white/70 hover:text-white"
          >
            <X />
          </Button>
        </div>
      </div>
    </div>
  );
}
