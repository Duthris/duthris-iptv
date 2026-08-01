"use client";

import * as React from "react";
import { ImageOff, Star } from "lucide-react";
import { tmdbImageAtSize } from "@iptv/core";
import { cn } from "@iptv/ui";

export interface PosterCardProps {
  name: string;
  poster: string | null;
  year: number | null;
  rating: number | null;

  progress?: number | null;
  onClick: () => void;
  className?: string;
}

export function PosterCard({
  name,
  poster,
  year,
  rating,
  progress = null,
  onClick,
  className,
}: PosterCardProps) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => setFailed(false), [poster]);

  const source = tmdbImageAtSize(poster, "w342");

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full flex-col gap-2 text-left",
        "focus-visible:outline-none",
        className,
      )}
    >
      <div
        className={cn(
          "relative aspect-[2/3] w-full overflow-hidden rounded-lg",
          "border-border/70 bg-surface-2 border",
          "duration-base ease-brand transition-all",
          "group-hover:border-brand-500/45 group-hover:shadow-glow-sm group-hover:-translate-y-0.5",
          "group-focus-visible:ring-ring/70 group-focus-visible:ring-2",
        )}
      >
        {source && !failed ? (
          <img
            src={source}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center">
            <ImageOff className="text-muted-foreground/50 size-4" />
            <span className="line-clamp-2-safe text-2xs text-muted-foreground leading-tight">
              {name}
            </span>
          </div>
        )}

        {rating !== null && rating > 0 ? (
          <span className="text-2xs absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/65 px-1.5 py-0.5 font-medium text-white backdrop-blur-sm">
            <Star className="fill-warning text-warning size-2.5" />
            {rating.toFixed(1)}
          </span>
        ) : null}

        {progress !== null && progress > 0 ? (
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-black/50">
            <div
              className="bg-primary h-full"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-0.5 px-0.5">
        <span className="line-clamp-2-safe text-foreground text-xs font-medium leading-snug">
          {name}
        </span>
        {year ? <span className="tabular text-2xs text-muted-foreground">{year}</span> : null}
      </div>
    </button>
  );
}
