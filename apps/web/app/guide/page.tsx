"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CalendarClock, Clock3, Search } from "lucide-react";
import { normalizeForSearch, type EpgProgram } from "@iptv/core";
import type { ChannelListItem } from "@iptv/db";
import { getMappingsByChannelId, getProgramsForChannels, listLiveChannels } from "@iptv/db";
import { Button, EmptyState, Input, Skeleton, cn } from "@iptv/ui";

import { AppShell } from "@/components/app-shell";
import { DayPicker } from "@/components/guide/day-picker";
import { ProgramDetail } from "@/components/guide/program-detail";
import { useGuideTime } from "@/lib/use-guide-time";
import { useNavigationStore } from "@/stores/navigation-store";
import { useActiveSourceIds, usePlaylistStore } from "@/stores/playlist-store";
import { usePlayerStore } from "@/stores/player-store";

const PX_PER_MINUTE = 5;
const ROW_HEIGHT = 56;
const CHANNEL_COL_WIDTH = 208;
const HOURS_SHOWN = 24;
const DAY_MS = 24 * 60 * 60 * 1000;

interface GuideRow {
  channel: ChannelListItem;
  channelKey: string;
  programs: EpgProgram[];
}

const MIN_DAY_OFFSET = -1;
const MAX_DAY_OFFSET = 6;

export default function GuidePage() {
  const router = useRouter();
  const openArchive = useNavigationStore((state) => state.openArchive);
  const sourcesLoaded = usePlaylistStore((state) => state.loaded);
  const sourceIds = useActiveSourceIds();
  const playChannel = usePlayerStore((state) => state.playChannel);

  const [dayOffset, setDayOffset] = React.useState(0);
  const [rows, setRows] = React.useState<GuideRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<{
    program: EpgProgram;
    channel: ChannelListItem;
  } | null>(null);

  const [query, setQuery] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [now, setNow] = React.useState(() => Date.now());

  const guideTime = useGuideTime();
  const { shiftMs } = guideTime;

  const from = React.useMemo(() => guideTime.startOfDay(dayOffset), [guideTime, dayOffset]);
  const to = from + HOURS_SHOWN * 60 * 60 * 1000;
  const sourceKey = sourceIds.join("|");

  const queryFrom = from - shiftMs;
  const queryTo = to - shiftMs;

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (!sourcesLoaded) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);

      const [channels, mappings] = await Promise.all([
        listLiveChannels({ sourceIds }),
        getMappingsByChannelId(),
      ]);
      if (cancelled) return;

      const linked = channels
        .map((channel) => ({ channel, channelKey: mappings.get(channel.id) }))
        .filter((entry): entry is { channel: ChannelListItem; channelKey: string } =>
          Boolean(entry.channelKey),
        );

      const keys = Array.from(new Set(linked.map((entry) => entry.channelKey)));
      const programs = await getProgramsForChannels(keys, queryFrom, queryTo);
      if (cancelled) return;

      setRows(
        linked
          .map((entry) => ({
            channel: entry.channel,
            channelKey: entry.channelKey,
            programs: programs.get(entry.channelKey) ?? [],
          }))
          .filter((row) => row.programs.length > 0),
      );
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, sourcesLoaded, queryFrom, queryTo]);

  const visibleRows = React.useMemo(() => {
    const normalized = normalizeForSearch(query);
    if (!normalized) return rows;
    const tokens = normalized.split(" ").filter(Boolean);
    return rows.filter((row) => {
      const haystack = normalizeForSearch(row.channel.name);
      return tokens.every((token) => haystack.includes(token));
    });
  }, [rows, query]);

  const virtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
  });

  const timelineWidth = HOURS_SHOWN * 60 * PX_PER_MINUTE;
  const nowOffset = now >= from && now <= to ? ((now - from) / 60_000) * PX_PER_MINUTE : null;

  const scrollToNow = React.useCallback(() => {
    if (nowOffset === null) return;
    scrollRef.current?.scrollTo({ left: Math.max(0, nowOffset - 200), behavior: "smooth" });
  }, [nowOffset]);

  React.useEffect(() => {
    if (loading || nowOffset === null) return;
    scrollRef.current?.scrollTo({ left: Math.max(0, nowOffset - 200) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, dayOffset]);

  const hours = React.useMemo(
    () => Array.from({ length: HOURS_SHOWN }, (_, index) => from + index * 60 * 60 * 1000),
    [from],
  );

  const labelForDay = React.useCallback(
    (offset: number) => {
      if (offset === 0) return "Bugün";
      if (offset === -1) return "Dün";
      if (offset === 1) return "Yarın";
      return guideTime.formatDate(guideTime.startOfDay(offset));
    },
    [guideTime],
  );

  function openChannel(row: GuideRow) {
    playChannel(row.channel);
    router.push("/live");
  }

  return (
    <AppShell bleed>
      <div className="flex h-full flex-col">
        <header className="border-border/70 flex h-14 shrink-0 items-center gap-3 border-b px-4 lg:px-6">
          <CalendarClock className="text-primary size-4" />
          <h1 className="text-foreground text-sm font-semibold tracking-tight">TV Rehberi</h1>

          <div className="w-56 shrink-0">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Kanal ara…"
              icon={<Search />}
              type="search"
              aria-label="Rehberde kanal ara"
            />
          </div>

          <div className="ml-auto flex items-center gap-1">
            {nowOffset !== null ? (
              <Button variant="ghost" size="sm" onClick={scrollToNow}>
                <Clock3 /> Şimdi
              </Button>
            ) : null}

            <DayPicker
              offset={dayOffset}
              onChange={setDayOffset}
              min={MIN_DAY_OFFSET}
              max={MAX_DAY_OFFSET}
              labelFor={labelForDay}
            />
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        ) : visibleRows.length === 0 ? (
          <EmptyState
            icon={<CalendarClock />}
            title={query ? "Bu aramaya uyan kanal yok" : "Bu gün için program bilgisi yok"}
            description={
              query
                ? "Farklı bir arama deneyin; rehberde yalnızca program bilgisi olan kanallar listelenir."
                : "TV rehberini Playlistler ekranından indirebilirsiniz. Rehber genelde bugün ve birkaç günü kapsar."
            }
            action={
              query ? (
                <Button variant="outline" onClick={() => setQuery("")}>
                  Aramayı temizle
                </Button>
              ) : (
                <Link href="/playlists">
                  <Button>Playlistler</Button>
                </Link>
              )
            }
            className="min-h-[50vh]"
          />
        ) : (
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto overscroll-contain">
            <div
              className="border-border/70 bg-background/95 sticky top-0 z-20 flex border-b backdrop-blur"
              style={{ width: CHANNEL_COL_WIDTH + timelineWidth }}
            >
              <div
                className="border-border/70 bg-background/95 sticky left-0 z-10 shrink-0 border-r"
                style={{ width: CHANNEL_COL_WIDTH }}
              />
              <div className="relative h-9" style={{ width: timelineWidth }}>
                {hours.map((hour) => (
                  <span
                    key={hour}
                    className="tabular border-border/50 text-2xs text-muted-foreground absolute top-0 flex h-9 items-center border-l pl-2"
                    style={{ left: ((hour - from) / 60_000) * PX_PER_MINUTE }}
                  >
                    {guideTime.formatTime(hour)}
                  </span>
                ))}
              </div>
            </div>

            <div
              className="relative"
              style={{
                height: virtualizer.getTotalSize(),
                width: CHANNEL_COL_WIDTH + timelineWidth,
              }}
            >
              {nowOffset !== null ? (
                <div
                  className="bg-destructive pointer-events-none absolute top-0 z-10 h-full w-px"
                  style={{ left: CHANNEL_COL_WIDTH + nowOffset }}
                />
              ) : null}

              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = visibleRows[virtualRow.index];
                if (!row) return null;

                return (
                  <div
                    key={row.channel.id}
                    className="border-border/40 absolute left-0 top-0 flex border-b"
                    style={{
                      height: ROW_HEIGHT,
                      width: CHANNEL_COL_WIDTH + timelineWidth,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => openChannel(row)}
                      className={cn(
                        "border-border/70 sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r px-3 text-left",
                        "bg-background/95 duration-fast hover:bg-accent/40 backdrop-blur transition-colors",
                        "focus-visible:ring-ring/70 focus-visible:outline-none focus-visible:ring-2",
                      )}
                      style={{ width: CHANNEL_COL_WIDTH }}
                    >
                      <span className="text-foreground truncate text-xs font-medium">
                        {row.channel.name}
                      </span>
                    </button>

                    <div className="relative" style={{ width: timelineWidth }}>
                      {row.programs.map((program) => {
                        const start = program.start + shiftMs;
                        const stop = program.stop + shiftMs;
                        const left = ((start - from) / 60_000) * PX_PER_MINUTE;
                        const width = ((stop - start) / 60_000) * PX_PER_MINUTE;
                        if (left + width < 0 || left > timelineWidth) return null;

                        const airing = start <= now && stop > now;

                        return (
                          <button
                            key={program.id}
                            type="button"
                            onClick={() => setSelected({ program, channel: row.channel })}
                            title={program.title}
                            className={cn(
                              "absolute top-1.5 flex h-[calc(100%-12px)] items-center overflow-hidden rounded-md px-2 text-left",
                              "duration-fast border transition-colors",
                              "focus-visible:ring-ring/70 focus-visible:outline-none focus-visible:ring-2",
                              airing
                                ? "border-brand-500/40 bg-brand-500/15 hover:bg-brand-500/25"
                                : "border-border/50 bg-surface-2/70 hover:bg-accent/40",
                            )}
                            style={{
                              left: Math.max(0, left),
                              width: Math.max(24, width - 3 + Math.min(0, left)),
                            }}
                          >
                            <span
                              className={cn(
                                "text-2xs truncate",
                                airing ? "text-foreground font-medium" : "text-muted-foreground",
                              )}
                            >
                              {program.title}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <ProgramDetail
        program={selected?.program ?? null}
        channelName={selected?.channel.name ?? ""}
        onWatchArchive={
          selected && selected.channel.hasArchive && selected.program.stop + shiftMs < now
            ? () => {
                openArchive({
                  channelId: selected.channel.id,
                  startAt: selected.program.start + shiftMs,
                  durationMinutes: Math.max(
                    1,
                    Math.round((selected.program.stop - selected.program.start) / 60_000),
                  ),
                  title: selected.program.title,
                });
                router.push("/live");
                setSelected(null);
              }
            : undefined
        }
        onClose={() => setSelected(null)}
        onWatch={() => {
          if (!selected) return;
          const row = rows.find((entry) => entry.channel.id === selected.channel.id);
          if (row) openChannel(row);
          setSelected(null);
        }}
      />
    </AppShell>
  );
}
