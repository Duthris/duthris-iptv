"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock, Flame, X } from "lucide-react";
import type { WatchHistoryEntry } from "@iptv/core";
import {
  forgetWatchEntry,
  getLiveChannel,
  listFrequentChannels,
  listRecentChannels,
} from "@iptv/db";
import { Skeleton, cn } from "@iptv/ui";
import { toast } from "sonner";

import { initialsOf } from "@/lib/format";
import { usePlayerStore } from "@/stores/player-store";

function ChannelTile({
  entry,
  onOpen,
  onRemove,
}: {
  entry: WatchHistoryEntry;
  onOpen: (entry: WatchHistoryEntry) => void;
  onRemove?: (entry: WatchHistoryEntry) => void;
}) {
  const [failed, setFailed] = React.useState(false);

  return (
    <div className="group/tile relative shrink-0">
      {onRemove ? (
        <button
          type="button"
          aria-label={`${entry.title} kanalını listeden kaldır`}
          title="Listeden kaldır"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(entry);
          }}
          className={cn(
            "absolute right-0.5 top-0.5 z-10 grid size-5 place-items-center rounded-full",
            "bg-surface-3/90 text-muted-foreground backdrop-blur-sm",
            "hover:bg-destructive hover:text-destructive-foreground",
            // Hidden until wanted, and never in the way of a tap: it grows out
            // of the corner rather than appearing on top of the artwork.
            "scale-75 opacity-0 transition-all duration-base ease-brand-out",
            "group-hover/tile:scale-100 group-hover/tile:opacity-100",
            "focus-visible:scale-100 focus-visible:opacity-100",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
          )}
        >
          <X className="size-3" />
        </button>
      ) : null}

      <button
        type="button"
        onClick={() => onOpen(entry)}
        title={entry.title}
        className={cn(
          "flex w-24 flex-col items-center gap-2 rounded-lg p-2",
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
    </div>
  );
}

function Row({
  icon,
  title,
  entries,
  onOpen,
  onRemove,
}: {
  icon: React.ReactNode;
  title: string;
  entries: WatchHistoryEntry[];
  onOpen: (entry: WatchHistoryEntry) => void;
  onRemove?: (entry: WatchHistoryEntry) => void;
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
          <ChannelTile key={entry.id} entry={entry} onOpen={onOpen} onRemove={onRemove} />
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

  const remove = React.useCallback(
    async (entry: WatchHistoryEntry) => {
      if (!profileId) return;

      // Dropped from both rows at once: the same entry feeds them, so leaving
      // it in one would look like the removal half worked.
      setFrequent((rows) => rows.filter((row) => row.id !== entry.id));
      setRecent((rows) => rows.filter((row) => row.id !== entry.id));

      await forgetWatchEntry(profileId, entry.itemId);
      toast.success(`${entry.title} listeden kaldırıldı`);
    },
    [profileId],
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
        onRemove={(entry) => void remove(entry)}
      />
      <Row
        icon={<Clock />}
        title="Son izlenenler"
        entries={recent}
        onOpen={(entry) => void open(entry)}
        onRemove={(entry) => void remove(entry)}
      />
    </div>
  );
}
