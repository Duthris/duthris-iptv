"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock, Flame } from "lucide-react";
import type { WatchHistoryEntry } from "@iptv/core";
import { getLiveChannel, listFrequentChannels, listRecentChannels } from "@iptv/db";
import { Skeleton, cn } from "@iptv/ui";
import { toast } from "sonner";

import { initialsOf } from "@/lib/format";
import { usePlayerStore } from "@/stores/player-store";

function ChannelTile({
  entry,
  onOpen,
}: {
  entry: WatchHistoryEntry;
  onOpen: (entry: WatchHistoryEntry) => void;
}) {
  const [failed, setFailed] = React.useState(false);

  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      title={entry.title}
      className={cn(
        "group/tile flex w-24 shrink-0 flex-col items-center gap-2 rounded-lg p-2",
        "transition-all duration-base ease-brand",
        "hover:-translate-y-0.5 hover:bg-accent/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
      )}
    >
      {entry.poster && !failed ? (
        <img
          src={entry.poster}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="size-14 rounded-lg border border-border/70 bg-surface-2 object-contain p-1.5"
        />
      ) : (
        <span className="grid size-14 place-items-center rounded-lg border border-border/70 bg-surface-2 text-sm font-semibold text-muted-foreground">
          {initialsOf(entry.title)}
        </span>
      )}
      <span className="line-clamp-2-safe w-full text-center text-2xs leading-tight text-muted-foreground group-hover/tile:text-foreground">
        {entry.title}
      </span>
    </button>
  );
}

function Row({
  icon,
  title,
  entries,
  onOpen,
}: {
  icon: React.ReactNode;
  title: string;
  entries: WatchHistoryEntry[];
  onOpen: (entry: WatchHistoryEntry) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="[&_svg]:size-3.5">{icon}</span>
        {title}
      </h2>
      <div className="flex gap-1 overflow-x-auto overscroll-x-contain pb-1">
        {entries.map((entry) => (
          <ChannelTile key={entry.id} entry={entry} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

export function ChannelShortcuts({ profileId }: { profileId: string | null }) {
  const router = useRouter();
  const playChannel = usePlayerStore((state) => state.playChannel);

  const [frequent, setFrequent] = React.useState<WatchHistoryEntry[]>([]);
  const [recent, setRecent] = React.useState<WatchHistoryEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!profileId) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      const [top, last] = await Promise.all([
        listFrequentChannels(profileId, 8),
        listRecentChannels(profileId, 8),
      ]);
      if (cancelled) return;

      const topIds = new Set(top.map((entry) => entry.itemId));
      setFrequent(top);
      setRecent(last.filter((entry) => !topIds.has(entry.itemId)));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const open = React.useCallback(
    async (entry: WatchHistoryEntry) => {
      const channel = await getLiveChannel(entry.itemId);
      if (!channel) {
        toast.error("Kanal artık kaynakta yok");
        return;
      }
      playChannel({
        id: channel.id,
        sourceId: channel.sourceId,
        name: channel.name,
        logo: channel.logo,
        number: channel.number,
        tvgId: channel.tvgId,
        hasArchive: channel.hasArchive,
      });
      router.push("/live");
    },
    [playChannel, router],
  );

  if (loading) {
    return (
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (frequent.length === 0 && recent.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      <Row
        icon={<Flame />}
        title="Sık izlediklerin"
        entries={frequent}
        onOpen={(entry) => void open(entry)}
      />
      <Row
        icon={<Clock />}
        title="Son izlenenler"
        entries={recent}
        onOpen={(entry) => void open(entry)}
      />
    </div>
  );
}
