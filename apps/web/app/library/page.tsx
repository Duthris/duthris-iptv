"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Clock, Download, Heart, History, Library, Trash2 } from "lucide-react";
import { clearHistory, getEpisode, getLiveChannel } from "@iptv/db";
import { Badge, Button, EmptyState, Skeleton, cn } from "@iptv/ui";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { MovieDetail } from "@/components/library/movie-detail";
import { SeriesDetail } from "@/components/library/series-detail";
import { WatchStatsPanel } from "@/components/library/watch-stats";
import { DownloadsPanel } from "@/components/library/downloads-panel";
import { SegmentedControl } from "@/components/playlist/segmented-control";
import { loadContinueWatching, loadFavorites, loadHistory, type LibraryEntry } from "@/lib/library";
import { useActiveProfile } from "@/stores/profile-store";
import { usePlayerStore } from "@/stores/player-store";
import { formatCount, formatDuration, initialsOf } from "@/lib/format";

type Tab = "continue" | "favorites" | "history" | "stats" | "downloads";

const TABS = [
  { value: "continue" as const, label: "İzlemeye devam et", icon: Clock },
  { value: "favorites" as const, label: "Favoriler", icon: Heart },
  { value: "history" as const, label: "Geçmiş", icon: History },
  { value: "stats" as const, label: "İstatistikler", icon: BarChart3 },
  { value: "downloads" as const, label: "İndirilenler", icon: Download },
];

const KIND_LABEL: Record<LibraryEntry["kind"], string> = {
  live: "Kanal",
  vod: "Film",
  series: "Dizi",
};

function EntryRow({
  entry,
  onOpen,
}: {
  entry: LibraryEntry;
  onOpen: (entry: LibraryEntry) => void;
}) {
  const [posterFailed, setPosterFailed] = React.useState(false);

  return (
    <button
      type="button"
      onClick={() => onOpen(entry)}
      disabled={entry.missing}
      className={cn(
        "border-border/70 bg-card flex w-full items-center gap-3.5 rounded-lg border p-3 text-left",
        "duration-base ease-brand transition-all",
        entry.missing
          ? "cursor-not-allowed opacity-55"
          : "hover:border-brand-500/40 hover:shadow-glow-sm hover:-translate-y-px",
        "focus-visible:ring-ring/70 focus-visible:outline-none focus-visible:ring-2",
      )}
    >
      {entry.poster && !posterFailed ? (
        <img
          src={entry.poster}
          alt=""
          loading="lazy"
          onError={() => setPosterFailed(true)}
          className={cn(
            "bg-surface-3 shrink-0 rounded-md object-cover",
            entry.kind === "live" ? "size-11 object-contain" : "h-16 w-11",
          )}
        />
      ) : (
        <span
          className={cn(
            "bg-surface-3 text-2xs text-muted-foreground grid shrink-0 place-items-center rounded-md font-semibold",
            entry.kind === "live" ? "size-11" : "h-16 w-11",
          )}
        >
          {initialsOf(entry.name)}
        </span>
      )}

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="text-foreground min-w-0 truncate text-sm font-medium">{entry.name}</span>
          <Badge variant="outline">{KIND_LABEL[entry.kind]}</Badge>
        </span>

        {entry.progress !== null && entry.progress > 0 ? (
          <span className="flex items-center gap-2">
            <span className="bg-surface-3 h-1 w-24 overflow-hidden rounded-full">
              <span
                className="bg-primary block h-full rounded-full"
                style={{ width: `${Math.min(100, entry.progress * 100)}%` }}
              />
            </span>
            {entry.positionSecs ? (
              <span className="tabular text-2xs text-muted-foreground">
                {formatDuration(entry.positionSecs)}
              </span>
            ) : null}
          </span>
        ) : entry.missing ? (
          <span className="text-2xs text-muted-foreground">Bu içerik kaynakta artık yok</span>
        ) : null}
      </span>
    </button>
  );
}

export default function LibraryPage() {
  const router = useRouter();
  const profile = useActiveProfile();
  const playChannel = usePlayerStore((state) => state.playChannel);

  const [tab, setTab] = React.useState<Tab>("continue");
  const [entries, setEntries] = React.useState<LibraryEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [movieId, setMovieId] = React.useState<string | null>(null);
  const [seriesId, setSeriesId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!profile) return;
    if (tab === "stats" || tab === "downloads") {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data =
      tab === "favorites"
        ? await loadFavorites(profile.id)
        : tab === "history"
          ? await loadHistory(profile.id)
          : await loadContinueWatching(profile.id);
    setEntries(data);
    setLoading(false);
  }, [profile, tab]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function openEntry(entry: LibraryEntry) {
    if (entry.kind === "vod") {
      setMovieId(entry.id);
      return;
    }
    if (entry.kind === "series") {
      setSeriesId(entry.parentId ?? entry.id);
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
  }

  const emptyCopy: Record<
    Exclude<Tab, "stats" | "downloads">,
    { title: string; description: string; links: Array<{ href: string; label: string }> }
  > = {
    continue: {
      title: "Yarım kalan içerik yok",
      description: "Bir film veya bölüm izlemeye başladığında kaldığın yer burada görünür.",
      links: [
        { href: "/movies", label: "Filmler" },
        { href: "/series", label: "Diziler" },
      ],
    },
    favorites: {
      title: "Henüz favori yok",
      description: "Kanal, film ve dizilerdeki kalp simgesine dokunarak favorilerine ekle.",
      links: [
        { href: "/live", label: "Canlı TV" },
        { href: "/movies", label: "Filmler" },
        { href: "/series", label: "Diziler" },
      ],
    },
    history: {
      title: "Geçmiş boş",
      description: "İzlediğin film ve bölümler burada listelenir.",
      links: [
        { href: "/movies", label: "Filmler" },
        { href: "/series", label: "Diziler" },
      ],
    },
  };

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">Kitaplığım</h1>
            <p className="text-muted-foreground text-sm">
              {profile ? `${profile.name} profiline ait` : "Profil yükleniyor"} favoriler ve izleme
              geçmişi.
            </p>
          </div>

          {tab === "history" && entries.length > 0 && profile ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={async () => {
                await clearHistory(profile.id);
                await load();
                toast.success("Geçmiş temizlendi");
              }}
            >
              <Trash2 /> Geçmişi temizle
            </Button>
          ) : null}
        </header>

        <SegmentedControl
          options={TABS}
          value={tab}
          onChange={setTab}
          aria-label="Kitaplık bölümü"
        />

        {tab === "downloads" ? (
          <DownloadsPanel
            onOpen={(entry) => {
              if (entry.kind === "vod") {
                setMovieId(entry.itemId);
                return;
              }
              // An episode download is keyed by the episode, but the detail
              // overlay opens a series; the parent has to be looked up.
              void getEpisode(entry.itemId).then((episode) => {
                if (episode) setSeriesId(episode.seriesItemId);
                else toast.error("Bu bölümün dizisi kitaplıkta bulunamadı");
              });
            }}
          />
        ) : tab === "stats" ? (
          <WatchStatsPanel profileId={profile?.id ?? null} />
        ) : loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-[88px] rounded-lg" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<Library />}
            title={emptyCopy[tab].title}
            description={emptyCopy[tab].description}
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                {emptyCopy[tab].links.map((link, index) => (
                  <Link key={link.href} href={link.href}>
                    <Button variant={index === 0 ? "primary" : "outline"}>{link.label}</Button>
                  </Link>
                ))}
              </div>
            }
          />
        ) : (
          <>
            <p className="tabular text-2xs text-muted-foreground">
              {formatCount(entries.length)} kayıt
            </p>
            <div className="flex flex-col gap-2.5">
              {entries.map((entry) => (
                <EntryRow key={`${entry.kind}:${entry.id}`} entry={entry} onOpen={openEntry} />
              ))}
            </div>
          </>
        )}
      </div>

      <MovieDetail
        movieId={movieId}
        onClose={() => {
          setMovieId(null);
          void load();
        }}
      />
      <SeriesDetail
        seriesId={seriesId}
        onClose={() => {
          setSeriesId(null);
          void load();
        }}
      />
    </AppShell>
  );
}
