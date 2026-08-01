"use client";

import * as React from "react";
import Link from "next/link";
import { ListVideo, PanelLeftClose, PanelLeftOpen, Radio } from "lucide-react";
import { toast } from "sonner";
import type { CategoryListItem, ChannelListItem } from "@iptv/db";
import { countLiveChannels, listCategories, listLiveChannels, updateSource } from "@iptv/db";
import { Button, EmptyState, cn } from "@iptv/ui";

import { AppShell } from "@/components/app-shell";
import { ALL_CATEGORIES, CategoryPanel } from "@/components/live/category-panel";
import { ChannelList } from "@/components/live/channel-list";
import { ChannelNumberEntry } from "@/components/live/channel-number-entry";
import { useChannelNumberEntry } from "@/lib/use-channel-number-entry";
import { useLiveWatch } from "@/lib/use-live-watch";
import { FavoriteButton } from "@/components/library/favorite-button";
import { NowPlaying } from "@/components/live/now-playing";
import { VideoPlayer } from "@/components/live/video-player";
import { useEpg } from "@/lib/use-epg";
import { effectiveProtocol, rewriteScheme } from "@iptv/core";
import { canUseInsecureStreams } from "@/lib/platform";
import { currentPlaybackContext, resolveChannelStream } from "@/lib/resolve-stream";
import { useNavigationStore } from "@/stores/navigation-store";
import { useActiveSourceIds, usePlaylistStore } from "@/stores/playlist-store";
import { useActiveProfile } from "@/stores/profile-store";
import { useSettingsStore } from "@/stores/settings-store";
import { usePlayerStore } from "@/stores/player-store";

export default function LivePage() {
  const sourcesLoaded = usePlaylistStore((state) => state.loaded);
  const sources = usePlaylistStore((state) => state.sources);
  const refreshSources = usePlaylistStore((state) => state.refresh);
  const sourceIds = useActiveSourceIds();
  const profile = useActiveProfile();
  const preferredFormat = useSettingsStore((state) => state.preferredFormat);
  const showAdult = useSettingsStore((state) => state.showAdultCategories);

  const current = usePlayerStore((state) => state.current);
  const playChannel = usePlayerStore((state) => state.playChannel);
  const previousChannel = usePlayerStore((state) => state.previous);
  const swapToPrevious = usePlayerStore((state) => state.swapToPrevious);

  const [categories, setCategories] = React.useState<CategoryListItem[]>([]);
  const [totalChannels, setTotalChannels] = React.useState(0);
  const [activeCategory, setActiveCategory] = React.useState<string>(ALL_CATEGORIES);
  const [channels, setChannels] = React.useState<ChannelListItem[]>([]);
  const [loadingCategories, setLoadingCategories] = React.useState(true);
  const [loadingChannels, setLoadingChannels] = React.useState(true);
  const [streamUrl, setStreamUrl] = React.useState<string | null>(null);
  const [fallbackTsUrl, setFallbackTsUrl] = React.useState<string | null>(null);
  const [panelOpen, setPanelOpen] = React.useState(true);
  const [protocolFix, setProtocolFix] = React.useState(0);
  const [playerPlaying, setPlayerPlaying] = React.useState(false);
  const epg = useEpg(sourcesLoaded);

  useLiveWatch(current, profile?.id ?? null, playerPlaying);

  const sourceKey = sourceIds.join("|");

  const currentSource = current
    ? (sources.find((source) => source.id === current.sourceId) ?? null)
    : null;

  const canSwitchToHttp =
    canUseInsecureStreams() && (currentSource?.streamProtocol ?? "auto") !== "http";

  const rewriteUrl = React.useMemo(() => {
    if (!currentSource) return undefined;
    if (effectiveProtocol(currentSource, currentPlaybackContext()) !== "http") return undefined;
    return (value: string) => rewriteScheme(value, "http");
  }, [currentSource]);

  React.useEffect(() => {
    if (!sourcesLoaded) return;
    let cancelled = false;

    void (async () => {
      setLoadingCategories(true);
      const [list, total] = await Promise.all([
        listCategories(sourceIds, "live", {
          includeAdult: showAdult,
          hiddenIds: profile?.hiddenCategoryIds ?? [],
        }),
        countLiveChannels(sourceIds),
      ]);
      if (cancelled) return;
      setCategories(list);
      setTotalChannels(total);
      setLoadingCategories(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, sourcesLoaded, showAdult, profile?.id]);

  React.useEffect(() => {
    if (!sourcesLoaded) return;
    let cancelled = false;

    void (async () => {
      setLoadingChannels(true);
      const list = await listLiveChannels({
        sourceIds,
        categoryRawId: activeCategory === ALL_CATEGORIES ? null : activeCategory,
      });
      if (cancelled) return;
      setChannels(list);
      setLoadingChannels(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, sourcesLoaded, activeCategory]);

  React.useEffect(() => {
    let cancelled = false;
    if (!current) {
      setStreamUrl(null);
      setFallbackTsUrl(null);
      return;
    }

    void (async () => {
      const [primary, ts] = await Promise.all([
        resolveChannelStream(current.id, preferredFormat),
        resolveChannelStream(current.id, "ts"),
      ]);
      if (cancelled) return;
      setStreamUrl(primary?.url ?? null);
      setFallbackTsUrl(ts?.url && ts.url !== primary?.url ? ts.url : null);
    })();

    return () => {
      cancelled = true;
    };
  }, [current, preferredFormat, protocolFix]);

  const switchSourceToHttp = React.useCallback(async () => {
    if (!current) return;
    await updateSource(current.sourceId, { streamProtocol: "http" });
    await refreshSources();
    setProtocolFix((value) => value + 1);
    toast.success("Yayın protokolü HTTP olarak ayarlandı");
  }, [current, refreshSources]);

  const consumeChannel = useNavigationStore((state) => state.consumeChannel);
  const pendingChannelId = useNavigationStore((state) => state.pendingChannelId);

  React.useEffect(() => {
    if (!pendingChannelId) return;
    if (activeCategory !== ALL_CATEGORIES) {
      setActiveCategory(ALL_CATEGORIES);
      return;
    }
    const target = channels.find((channel) => channel.id === pendingChannelId);
    if (!target) return;
    consumeChannel();
    playChannel(target);
  }, [pendingChannelId, channels, activeCategory, consumeChannel, playChannel]);

  const playRelative = React.useCallback(
    (delta: number) => {
      if (channels.length === 0) return;
      const index = channels.findIndex((channel) => channel.id === current?.id);
      const target =
        channels[index === -1 ? 0 : (index + delta + channels.length) % channels.length];
      if (target) playChannel(target);
    },
    [channels, current?.id, playChannel],
  );

  const numberEntry = useChannelNumberEntry(channels.length > 0, (channelNumber) => {
    const target = channels.find((channel) => channel.number === channelNumber);
    if (!target) return false;
    playChannel(target);
    return true;
  });

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      if (event.key !== "Backspace" || numberEntry.digits) return;
      if (!previousChannel) return;
      event.preventDefault();
      swapToPrevious();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previousChannel, swapToPrevious, numberEntry.digits]);

  if (sourcesLoaded && sources.length === 0) {
    return (
      <AppShell>
        <EmptyState
          icon={<ListVideo />}
          title="Henüz playlist eklenmedi"
          description="Canlı TV'yi kullanmak için önce bir M3U veya Xtream kaynağı ekleyin."
          action={
            <Link href="/playlists">
              <Button>Playlist ekle</Button>
            </Link>
          }
          className="min-h-[60vh]"
        />
      </AppShell>
    );
  }

  return (
    <AppShell bleed>
      <div className="flex h-full flex-col">
        <header className="border-border/70 flex h-14 shrink-0 items-center gap-3 border-b px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setPanelOpen((open) => !open)}
            aria-label={panelOpen ? "Paneli gizle" : "Paneli göster"}
            className="hidden lg:inline-flex"
          >
            {panelOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          </Button>

          <Radio className="text-primary size-4" />
          <h1 className="text-foreground text-sm font-semibold tracking-tight">Canlı TV</h1>

          {current ? (
            <span className="text-muted-foreground ml-auto min-w-0 truncate text-sm">
              {current.name}
            </span>
          ) : null}
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div
            className={cn(
              "border-border/70 flex min-h-0 shrink-0",
              "order-2 h-[52vh] flex-row border-t lg:order-1 lg:h-auto lg:border-r lg:border-t-0",
              panelOpen
                ? "lg:w-[24rem] xl:w-[30rem] 2xl:w-[34rem]"
                : "lg:w-0 lg:overflow-hidden lg:border-r-0",
            )}
          >
            <CategoryPanel
              categories={categories}
              totalCount={totalChannels}
              activeRawId={activeCategory}
              onSelect={setActiveCategory}
              loading={loadingCategories}
              className="border-border/70 xl:w-sidebar-sm w-1/2 border-r lg:w-[11rem]"
            />
            <ChannelList
              channels={channels}
              activeId={current?.id ?? null}
              onSelect={playChannel}
              epgByChannelId={epg.byChannelId}
              loading={loadingChannels}
              className="w-1/2 flex-1"
            />
          </div>

          <div className="order-1 flex min-h-0 flex-1 flex-col gap-3 p-3 lg:order-2 lg:p-5">
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <VideoPlayer
                url={streamUrl}
                title={current?.name ?? "Kanal seçilmedi"}
                logo={current?.logo ?? null}
                canSwitchToHttp={canSwitchToHttp}
                onSwitchToHttp={switchSourceToHttp}
                rewriteUrl={rewriteUrl}
                fallbackTsUrl={fallbackTsUrl}
                onPrevious={channels.length > 1 ? () => playRelative(-1) : undefined}
                onNext={channels.length > 1 ? () => playRelative(1) : undefined}
                previousLabel="Önceki kanal"
                nextLabel="Sonraki kanal"
                mediaSubtitle={epg.byChannelId.get(current?.id ?? "")?.now?.title ?? null}
                onPlayingChange={setPlayerPlaying}
                overlay={
                  <ChannelNumberEntry digits={numberEntry.digits} notFound={numberEntry.notFound} />
                }
                className="h-full w-auto max-w-full"
              />
            </div>

            {current ? (
              <div className="flex shrink-0 items-start justify-between gap-4">
                <NowPlaying
                  channelName={current.name}
                  nowNext={epg.byChannelId.get(current.id)}
                  guideLoaded={epg.loaded && !epg.empty}
                  className="min-w-0 flex-1"
                />
                <FavoriteButton itemId={current.id} kind="live" className="shrink-0" />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
