"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Clapperboard, Heart, Radio, Tv } from "lucide-react";
import type { ContentKind } from "@iptv/core";
import { getLiveChannel } from "@iptv/db";
import { Skeleton, cn } from "@iptv/ui";
import { toast } from "sonner";

import { loadFavorites, type LibraryEntry } from "@/lib/library";
import { initialsOf } from "@/lib/format";
import { useNavigationStore } from "@/stores/navigation-store";
import { usePlayerStore } from "@/stores/player-store";

/**
 * Favourites on the home screen, split by what they are.
 *
 * One mixed row would bury a channel among posters of a different shape; three
 * rows keep each kind scannable. A kind with nothing in it is dropped rather
 * than shown empty, so the screen only ever carries what is actually there.
 */

/** Enough to fill the row on a wide screen; the rest live in the library. */
const PER_ROW = 12;

function PosterTile({ entry, onOpen }: { entry: LibraryEntry; onOpen: () => void }) {
  const [failed, setFailed] = React.useState(false);

  return (
    <button
      type="button"
      onClick={onOpen}
      title={entry.name}
      className={cn(
        "group/tile flex w-28 shrink-0 flex-col gap-1.5 rounded-lg p-1.5 text-left",
        "duration-base ease-brand transition-all",
        "hover:bg-accent/40 hover:-translate-y-0.5",
        "focus-visible:ring-ring/70 focus-visible:outline-none focus-visible:ring-2",
      )}
    >
      {entry.poster && !failed ? (
        <img
          src={entry.poster}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="border-border/70 bg-surface-2 aspect-[2/3] w-full rounded-md border object-cover"
        />
      ) : (
        <span className="border-border/70 bg-surface-2 text-muted-foreground grid aspect-[2/3] w-full place-items-center rounded-md border text-sm font-semibold">
          {initialsOf(entry.name)}
        </span>
      )}

      <span className="line-clamp-2-safe text-2xs text-muted-foreground group-hover/tile:text-foreground leading-tight">
        {entry.name}
      </span>
    </button>
  );
}

function LogoTile({ entry, onOpen }: { entry: LibraryEntry; onOpen: () => void }) {
  const [failed, setFailed] = React.useState(false);

  return (
    <button
      type="button"
      onClick={onOpen}
      title={entry.name}
      className={cn(
        "group/tile flex w-24 shrink-0 flex-col items-center gap-2 rounded-lg p-2",
        "duration-base ease-brand transition-all",
        "hover:bg-accent/40 hover:-translate-y-0.5",
        "focus-visible:ring-ring/70 focus-visible:outline-none focus-visible:ring-2",
      )}
    >
      {entry.poster && !failed ? (
        <img
          src={entry.poster}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="border-border/70 bg-surface-2 size-14 rounded-lg border object-contain p-1.5"
        />
      ) : (
        <span className="border-border/70 bg-surface-2 text-muted-foreground grid size-14 place-items-center rounded-lg border text-sm font-semibold">
          {initialsOf(entry.name)}
        </span>
      )}

      <span className="line-clamp-2-safe text-2xs text-muted-foreground group-hover/tile:text-foreground w-full text-center leading-tight">
        {entry.name}
      </span>
    </button>
  );
}

function Row({
  icon,
  title,
  entries,
  poster,
  onOpen,
  onSeeAll,
}: {
  icon: React.ReactNode;
  title: string;
  entries: LibraryEntry[];
  poster: boolean;
  onOpen: (entry: LibraryEntry) => void;
  onSeeAll: () => void;
}) {
  if (entries.length === 0) return null;

  const Tile = poster ? PosterTile : LogoTile;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-2xs text-muted-foreground flex items-center gap-1.5 font-medium uppercase tracking-wide">
          <span className="[&_svg]:size-3.5">{icon}</span>
          {title}
          <span className="tabular text-muted-foreground/60">{entries.length}</span>
        </h3>

        {entries.length > PER_ROW ? (
          <button
            type="button"
            onClick={onSeeAll}
            className={cn(
              "text-2xs text-muted-foreground hover:text-foreground flex items-center gap-0.5",
              "duration-fast ease-brand transition-colors",
              "focus-visible:ring-ring/70 rounded focus-visible:outline-none focus-visible:ring-2",
            )}
          >
            Tümü <ChevronRight className="size-3" />
          </button>
        ) : null}
      </div>

      <div className="flex gap-1 overflow-x-auto overscroll-x-contain pb-1">
        {entries.slice(0, PER_ROW).map((entry) => (
          <Tile key={entry.id} entry={entry} onOpen={() => onOpen(entry)} />
        ))}
      </div>
    </section>
  );
}

export function FavoriteShortcuts({ profileId }: { profileId: string | null }) {
  const router = useRouter();
  const playChannel = usePlayerStore((state) => state.playChannel);
  const openMovie = useNavigationStore((state) => state.openMovie);
  const openSeries = useNavigationStore((state) => state.openSeries);
  const openLibraryTab = useNavigationStore((state) => state.openLibraryTab);

  const [entries, setEntries] = React.useState<LibraryEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!profileId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      const rows = await loadFavorites(profileId);
      if (cancelled) return;

      // A favourite whose item has gone from the catalog is noise here; the
      // library still lists it so it can be cleaned up deliberately.
      setEntries(rows.filter((row) => !row.missing));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const byKind = React.useMemo(() => {
    const groups: Record<ContentKind, LibraryEntry[]> = { series: [], vod: [], live: [] };
    for (const entry of entries) groups[entry.kind]?.push(entry);
    return groups;
  }, [entries]);

  const seeAll = React.useCallback(() => {
    openLibraryTab("favorites");
    router.push("/library");
  }, [openLibraryTab, router]);

  const open = React.useCallback(
    async (entry: LibraryEntry) => {
      if (entry.kind === "vod") {
        openMovie(entry.id);
        router.push("/movies");
        return;
      }
      if (entry.kind === "series") {
        openSeries(entry.id);
        router.push("/series");
        return;
      }

      const channel = await getLiveChannel(entry.id);
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
    [openMovie, openSeries, playChannel, router],
  );

  if (loading) {
    return (
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-40 w-28 rounded-lg" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
          <Heart className="text-primary size-4" /> Favorilerin
        </h2>

        <button
          type="button"
          onClick={seeAll}
          className={cn(
            "text-2xs text-muted-foreground hover:text-foreground flex items-center gap-0.5",
            "duration-fast ease-brand transition-colors",
            "focus-visible:ring-ring/70 rounded focus-visible:outline-none focus-visible:ring-2",
          )}
        >
          Kitaplıkta aç <ChevronRight className="size-3" />
        </button>
      </div>

      <Row
        icon={<Tv />}
        title="Diziler"
        entries={byKind.series}
        poster
        onOpen={(entry) => void open(entry)}
        onSeeAll={seeAll}
      />
      <Row
        icon={<Clapperboard />}
        title="Filmler"
        entries={byKind.vod}
        poster
        onOpen={(entry) => void open(entry)}
        onSeeAll={seeAll}
      />
      <Row
        icon={<Radio />}
        title="Canlı kanallar"
        entries={byKind.live}
        poster={false}
        onOpen={(entry) => void open(entry)}
        onSeeAll={seeAll}
      />
    </div>
  );
}
