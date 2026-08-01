"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Film } from "lucide-react";
import type { PosterListItem } from "@iptv/db";
import { EmptyState, Skeleton, cn } from "@iptv/ui";

import { PosterCard } from "@/components/library/poster-card";
import { useSettingsStore } from "@/stores/settings-store";

const MIN_TILE_WIDTH = 168;
const GAP = 16;

const TEXT_BLOCK_HEIGHT = 52;
const OVERSCAN = 4;

export interface PosterGridProps {
  items: PosterListItem[];
  onSelect: (item: PosterListItem) => void;
  progressById?: Map<string, number>;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function PosterGrid({
  items,
  onSelect,
  progressById,
  loading = false,
  emptyTitle = "İçerik bulunamadı",
  emptyDescription,
  className,
}: PosterGridProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    setWidth(element.clientWidth);

    return () => observer.disconnect();
  }, []);

  const preferredColumns = useSettingsStore((state) => state.gridColumns);
  const fitColumns = Math.max(1, Math.floor((width + GAP) / (MIN_TILE_WIDTH + GAP)));
  const columns =
    preferredColumns > 0 && width > 0
      ? Math.max(1, Math.min(preferredColumns, Math.floor((width + GAP) / (120 + GAP))))
      : fitColumns;
  const tileWidth = columns > 0 ? (width - GAP * (columns - 1)) / columns : MIN_TILE_WIDTH;
  const rowHeight = Math.round(tileWidth * 1.5) + TEXT_BLOCK_HEIGHT + GAP;
  const rowCount = Math.ceil(items.length / columns);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN,
  });

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [items]);

  return (
    <div
      ref={scrollRef}
      className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", className)}
    >
      {loading ? (
        <div
          className="grid gap-4 p-4"
          style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${MIN_TILE_WIDTH}px, 1fr))` }}
        >
          {Array.from({ length: 18 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="aspect-[2/3] w-full rounded-lg" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Film />} title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="p-4">
          <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const start = virtualRow.index * columns;
              const rowItems = items.slice(start, start + columns);

              return (
                <div
                  key={virtualRow.key}
                  className="absolute left-0 top-0 grid w-full"
                  style={{
                    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                    gap: `${GAP}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {rowItems.map((item) => (
                    <PosterCard
                      key={item.id}
                      name={item.name}
                      poster={item.poster}
                      year={item.year}
                      rating={item.rating}
                      progress={progressById?.get(item.id) ?? null}
                      onClick={() => onSelect(item)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
