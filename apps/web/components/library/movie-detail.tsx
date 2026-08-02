"use client";

import * as React from "react";
import { CalendarDays, Clock, Play, Star } from "lucide-react";
import type { VodInfo, VodItem } from "@iptv/core";
import { tmdbImageAtSize, tmdbImageUrl } from "@iptv/core";
import { getVodItem, getWatchProgress, recordWatch } from "@iptv/db";
import { Badge, Button, Skeleton, cn } from "@iptv/ui";

import { CastStrip } from "@/components/library/cast-strip";
import { DownloadButton } from "@/components/library/download-button";
import { localPlaybackUrl, useDownloads } from "@/lib/downloads";
import { DetailOverlay } from "@/components/library/detail-overlay";
import { FavoriteButton } from "@/components/library/favorite-button";
import { loadVodInfo } from "@/lib/vod-info";
import { useTmdbDetails } from "@/lib/use-tmdb";
import { VideoPlayer } from "@/components/live/video-player";
import {
  UnsupportedContainerNotice,
  isBrowserPlayableContainer,
} from "@/components/library/container-notice";
import { movieStreamTemplate, resolveMovieStream } from "@/lib/resolve-stream";
import { handOff } from "@/lib/external-player";
import { useActiveProfile } from "@/stores/profile-store";
import { formatDuration } from "@/lib/format";

export interface MovieDetailProps {
  movieId: string | null;
  onClose: () => void;
}

export function MovieDetail({ movieId, onClose }: MovieDetailProps) {
  const profile = useActiveProfile();
  const [item, setItem] = React.useState<VodItem | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const [streamUrl, setStreamUrl] = React.useState<string | null>(null);
  const [resumeAt, setResumeAt] = React.useState<number | null>(null);
  const [posterFailed, setPosterFailed] = React.useState(false);
  const [vodInfo, setVodInfo] = React.useState<VodInfo | null>(null);
  const downloads = useDownloads();

  React.useEffect(() => {
    if (!movieId) return;
    let cancelled = false;

    setLoading(true);
    setPlaying(false);
    setStreamUrl(null);
    setPosterFailed(false);
    setVodInfo(null);

    void loadVodInfo(movieId).then((info) => {
      if (!cancelled) setVodInfo(info);
    });

    void (async () => {
      const [record, progress] = await Promise.all([
        getVodItem(movieId),
        profile ? getWatchProgress(profile.id, movieId) : Promise.resolve(undefined),
      ]);
      if (cancelled) return;
      setItem(record ?? null);
      setResumeAt(progress?.completed ? null : (progress?.positionSecs ?? null));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [movieId, profile]);

  const { details: tmdb } = useTmdbDetails(
    item ? { itemId: item.id, kind: "movie", title: item.name, year: item.year } : null,
    vodInfo?.tmdbId ?? null,
  );

  const view = React.useMemo(() => {
    if (!item) return null;

    const posterSource = vodInfo?.coverBig ?? item.logo;

    return {
      poster:
        tmdbImageAtSize(posterSource, "w780") ??
        tmdbImageUrl(tmdb?.posterPath, "w780") ??
        posterSource,
      backdrop:
        tmdbImageAtSize(vodInfo?.backdrop, "w1280") ??
        tmdbImageUrl(tmdb?.backdropPath, "w1280") ??
        null,
      plot: item.plot ?? tmdb?.overview ?? null,
      genre: item.genre ?? (tmdb?.genres.length ? tmdb.genres.join(", ") : null),
      rating: item.rating && item.rating > 0 ? item.rating : (tmdb?.rating ?? null),
      year: item.year ?? tmdb?.year ?? null,
      durationSecs:
        item.durationSecs ??
        vodInfo?.durationSecs ??
        (tmdb?.runtimeMins ? tmdb.runtimeMins * 60 : null),
      tagline: tmdb?.tagline ?? null,
      country: vodInfo?.country ?? null,
      cast: tmdb?.cast ?? [],
    };
  }, [item, vodInfo, tmdb]);

  const playable = item ? isBrowserPlayableContainer(item.containerExt) : true;

  async function startPlayback(fromStart: boolean) {
    if (!item) return;

    // A finished download plays from disk: no provider connection, no ffmpeg,
    // and it works with the network off.
    const offline = downloads.byItem.get(item.id);
    if (offline?.status === "done") {
      const local = await localPlaybackUrl(offline);
      if (local) {
        if (fromStart) setResumeAt(null);
        setStreamUrl(local);
        setPlaying(true);
        return;
      }
    }

    const resolved = await resolveMovieStream(item.id);
    if (!resolved) return;
    if (fromStart) setResumeAt(null);
    setStreamUrl(resolved.url);
    setPlaying(true);
  }

  const handleProgress = React.useCallback(
    (position: number, duration: number) => {
      if (!profile || !item) return;
      void recordWatch({
        profileId: profile.id,
        itemId: item.id,
        kind: "vod",
        title: item.name,
        poster: item.logo,
        positionSecs: position,
        durationSecs: duration,
      });
    },
    [profile, item],
  );

  return (
    <DetailOverlay
      open={Boolean(movieId)}
      onClose={onClose}
      backdrop={view?.backdrop ?? item?.logo ?? null}
    >
      {loading || !item ? (
        <div className="flex flex-col gap-4 p-6 sm:flex-row">
          <Skeleton className="aspect-[2/3] w-full shrink-0 rounded-lg sm:w-52" />
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      ) : playing ? (
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <VideoPlayer
            url={streamUrl}
            title={item.name}
            logo={item.logo}
            live={false}
            mediaSubtitle={item.year ? String(item.year) : null}
            subtitleSearch={{
              title: item.name,
              year: item.year,
              tmdbId: vodInfo?.tmdbId ?? tmdb?.tmdbId ?? null,
            }}
            startPositionSecs={resumeAt}
            onOpenExternally={() => {
              // Our own playback stops first: the subscription allows a single
              // connection, so both players would be fighting over it.
              const startSecs = resumeAt ?? 0;
              setPlaying(false);
              setStreamUrl(null);

              void movieStreamTemplate(item.id).then((template) =>
                handOff({ template, title: item.name, startSecs }),
              );
            }}
            onProgress={handleProgress}
            onEnded={(duration) => {
              if (!profile || duration <= 0) return;
              void recordWatch({
                profileId: profile.id,
                itemId: item.id,
                kind: "vod",
                title: item.name,
                poster: item.logo,
                positionSecs: duration,
                durationSecs: duration,
              });
              setResumeAt(null);
            }}
          />
          <h2 className="text-foreground text-lg font-semibold tracking-tight">{item.name}</h2>
        </div>
      ) : (
        <div className="flex flex-col gap-6 p-6 sm:flex-row">
          <div className="w-full shrink-0 sm:w-52">
            <div className="border-border/70 bg-surface-2 aspect-[2/3] overflow-hidden rounded-lg border">
              {view?.poster && !posterFailed ? (
                <img
                  src={view.poster}
                  alt=""
                  onError={() => setPosterFailed(true)}
                  className="size-full object-cover"
                />
              ) : (
                <div className="text-muted-foreground grid size-full place-items-center p-4 text-center text-xs">
                  {item.name}
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-col gap-2 pr-8">
              <h2 className="text-foreground text-xl font-semibold leading-tight tracking-tight">
                {item.name}
              </h2>

              {view?.tagline ? (
                <p className="text-muted-foreground text-xs italic">{view.tagline}</p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                {view?.year ? (
                  <Badge variant="outline">
                    <CalendarDays /> {view.year}
                  </Badge>
                ) : null}
                {view?.rating && view.rating > 0 ? (
                  <Badge variant="warning">
                    <Star /> {view.rating.toFixed(1)}
                  </Badge>
                ) : null}
                {view?.durationSecs ? (
                  <Badge variant="outline">
                    <Clock /> {formatDuration(view.durationSecs)}
                  </Badge>
                ) : null}
                {view?.country ? <Badge variant="outline">{view.country}</Badge> : null}
                {item.containerExt ? (
                  <Badge variant={playable ? "default" : "destructive"}>
                    {item.containerExt.toUpperCase()}
                  </Badge>
                ) : null}
              </div>

              {view?.genre ? <p className="text-muted-foreground text-xs">{view.genre}</p> : null}
            </div>

            {view?.plot ? (
              <p className="text-muted-foreground text-sm leading-relaxed">{view.plot}</p>
            ) : null}

            {item.cast || item.director ? (
              <dl className="flex flex-col gap-1.5 text-xs">
                {item.director ? (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground shrink-0">Yönetmen</dt>
                    <dd className="text-foreground min-w-0 truncate">{item.director}</dd>
                  </div>
                ) : null}
                {item.cast ? (
                  <div className="flex gap-2">
                    <dt className="text-muted-foreground shrink-0">Oyuncular</dt>
                    <dd className="text-foreground min-w-0 truncate">{item.cast}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}

            {view ? <CastStrip people={view.cast} /> : null}

            {playable ? (
              <div className={cn("flex flex-wrap gap-3")}>
                <Button onClick={() => startPlayback(false)}>
                  <Play />
                  {resumeAt && resumeAt > 30 ? `Devam et · ${formatDuration(resumeAt)}` : "Oynat"}
                </Button>
                {resumeAt && resumeAt > 30 ? (
                  <Button variant="outline" onClick={() => startPlayback(true)}>
                    Baştan başlat
                  </Button>
                ) : null}
                <FavoriteButton itemId={item.id} kind="vod" />
                <DownloadButton
                  itemId={item.id}
                  kind="vod"
                  title={item.name}
                  poster={view?.poster ?? item.logo}
                  resolveUrl={async () => (await resolveMovieStream(item.id))?.url ?? null}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <UnsupportedContainerNotice container={item.containerExt} />
                <FavoriteButton itemId={item.id} kind="vod" className="self-start" />
              </div>
            )}
          </div>
        </div>
      )}
    </DetailOverlay>
  );
}
