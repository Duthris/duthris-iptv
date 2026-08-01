"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, TvMinimalPlay } from "lucide-react";
import type { ChannelListItem, NowNext } from "@iptv/db";
import { normalizeForSearch } from "@iptv/core";
import { EmptyState, Input, Skeleton, cn } from "@iptv/ui";

import { formatCount, initialsOf } from "@/lib/format";
import { programProgress } from "@/lib/use-epg";
import { useSettingsStore } from "@/stores/settings-store";

const ROW_HEIGHT = 52;

const ROW_HEIGHT_WITH_EPG = 62;

const OVERSCAN = 8;

function ChannelLogo({ channel }: { channel: ChannelListItem }) {
  const [failed, setFailed] = React.useState(false);
  const showLogos = useSettingsStore((state) => state.showChannelLogos);

  if (!showLogos || !channel.logo || failed) {
    return (
      <span className="bg-surface-3 text-2xs text-muted-foreground grid size-8 shrink-0 place-items-center rounded-md font-semibold">
        {initialsOf(channel.name)}
      </span>
    );
  }

  return (
    <img
      src={channel.logo}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="bg-surface-3 size-8 shrink-0 rounded-md object-contain"
    />
  );
}

export interface ChannelListProps {
  channels: ChannelListItem[];
  activeId: string | null;
  onSelect: (channel: ChannelListItem) => void;

  epgByChannelId?: Map<string, NowNext>;
  loading?: boolean;
  className?: string;
}

export function ChannelList({
  channels,
  activeId,
  onSelect,
  epgByChannelId,
  loading = false,
  className,
}: ChannelListProps) {
  const [query, setQuery] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const hasEpg = Boolean(epgByChannelId && epgByChannelId.size > 0);
  const rowHeight = hasEpg ? ROW_HEIGHT_WITH_EPG : ROW_HEIGHT;

  const filtered = React.useMemo(() => {
    const normalized = normalizeForSearch(query);
    if (!normalized) return channels;

    const tokens = normalized.split(" ").filter(Boolean);
    return channels.filter((channel) => {
      const haystack = normalizeForSearch(channel.name);
      return tokens.every((token) => haystack.includes(token));
    });
  }, [channels, query]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN,
  });

  React.useEffect(() => {
    virtualizer.measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowHeight]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [channels]);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="border-border/70 border-b p-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Kanal ara…"
          icon={<Search />}
          type="search"
          aria-label="Kanal ara"
        />
        {query ? (
          <p className="tabular text-2xs text-muted-foreground mt-2 px-1">
            {formatCount(filtered.length)} sonuç
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2 p-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-11" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<TvMinimalPlay />}
          title={query ? "Sonuç bulunamadı" : "Bu kategoride kanal yok"}
          description={query ? "Farklı bir arama deneyin veya kategoriyi değiştirin." : undefined}
        />
      ) : (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const channel = filtered[virtualRow.index];
              if (!channel) return null;
              const active = channel.id === activeId;
              const nowNext = epgByChannelId?.get(channel.id);
              const progress = programProgress(nowNext?.now);

              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => onSelect(channel)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "absolute left-0 top-0 flex w-full items-center gap-3 rounded-md px-2.5 text-left",
                    "duration-fast ease-brand transition-colors",
                    "focus-visible:ring-ring/70 focus-visible:outline-none focus-visible:ring-2",
                    active
                      ? "bg-accent/70 text-foreground"
                      : "text-muted-foreground hover:bg-accent/35 hover:text-foreground",
                  )}
                  style={{
                    height: `${rowHeight - 4}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <ChannelLogo channel={channel} />

                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-sm",
                        active ? "text-foreground font-medium" : "font-normal",
                      )}
                    >
                      {channel.name}
                    </span>

                    {hasEpg ? (
                      <span className="mt-0.5 flex items-center gap-1.5">
                        {progress !== null ? (
                          <span className="bg-surface-3 h-0.5 w-6 shrink-0 overflow-hidden rounded-full">
                            <span
                              className="bg-primary block h-full rounded-full"
                              style={{ width: `${progress * 100}%` }}
                            />
                          </span>
                        ) : null}
                        <span className="text-2xs text-muted-foreground/80 block truncate">
                          {nowNext?.now?.title ?? "—"}
                        </span>
                      </span>
                    ) : null}
                  </span>

                  {channel.number !== null ? (
                    <span className="tabular text-2xs text-muted-foreground/70 shrink-0">
                      {channel.number}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
