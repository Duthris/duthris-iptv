"use client";

import * as React from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Play,
  RotateCcw,
  SkipForward,
  Star,
} from "lucide-react";
import type { Episode, SeriesItem } from "@iptv/core";
import { tmdbImageAtSize, tmdbImageUrl } from "@iptv/core";
import { getSeriesItem, listHistory, recordWatch } from "@iptv/db";
import { Badge, Button, Skeleton, Spinner, cn } from "@iptv/ui";

import { CastStrip } from "@/components/library/cast-strip";
import { DetailOverlay } from "@/components/library/detail-overlay";
import {
  UnsupportedContainerNotice,
  isBrowserPlayableContainer,
} from "@/components/library/container-notice";
import { VideoPlayer } from "@/components/live/video-player";
import { FavoriteButton } from "@/components/library/favorite-button";
import { DownloadButton } from "@/components/library/download-button";
import { localPlaybackUrl, useDownloads } from "@/lib/downloads";
import { NextEpisodePrompt } from "@/components/library/next-episode-prompt";
import { ensureEpisodes, groupBySeason, type SeasonGroup } from "@/lib/series-episodes";
import { episodeStreamTemplate, resolveEpisodeStreamUrl } from "@/lib/resolve-stream";
import { handOff } from "@/lib/external-player";
import { TrailerButton } from "@/components/library/trailer-button";
import { useActiveProfile } from "@/stores/profile-store";
import { useTmdbDetails } from "@/lib/use-tmdb";
import { formatDuration } from "@/lib/format";

export interface SeriesDetailProps {
  seriesId: string | null;
  onClose: () => void;
}

interface EpisodeProgress {
  ratio: number;
  positionSecs: number;
  completed: boolean;
}

const MIN_RESUME_SECS = 30;

const AUTOPLAY_SECS = 5;

export function SeriesDetail({ seriesId, onClose }: SeriesDetailProps) {
  const profile = useActiveProfile();

  const [series, setSeries] = React.useState<SeriesItem | null>(null);
  const [seasons, setSeasons] = React.useState<SeasonGroup[]>([]);
  const [activeSeason, setActiveSeason] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [playing, setPlaying] = React.useState<Episode | null>(null);
  const [streamUrl, setStreamUrl] = React.useState<string | null>(null);
  const [resumeAt, setResumeAt] = React.useState<number | null>(null);
  const [watched, setWatched] = React.useState<Map<string, EpisodeProgress>>(new Map());
  const [coverFailed, setCoverFailed] = React.useState(false);
  const downloads = useDownloads();

  React.useEffect(() => {
    if (!seriesId) return;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setPlaying(null);
    setStreamUrl(null);
    setCoverFailed(false);

    void (async () => {
      try {
        const record = await getSeriesItem(seriesId);
        if (cancelled) return;
        setSeries(record ?? null);

        const episodes = await ensureEpisodes(seriesId);
        if (cancelled) return;

        const grouped = groupBySeason(episodes);
        setSeasons(grouped);
        setActiveSeason(grouped[0]?.season ?? null);

        if (profile) {
          const history = await listHistory(profile.id, 200);
          if (cancelled) return;
          setWatched(
            new Map(
              history
                .filter((entry) => entry.parentId === seriesId)
                .map((entry): [string, EpisodeProgress] => [
                  entry.itemId,
                  {
                    ratio: entry.completed
                      ? 1
                      : entry.durationSecs && entry.positionSecs
                        ? entry.positionSecs / entry.durationSecs
                        : 0,
                    positionSecs: entry.positionSecs ?? 0,
                    completed: entry.completed,
                  },
                ]),
            ),
          );
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Bölümler alınamadı");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [seriesId, profile]);

  const currentSeason = seasons.find((group) => group.season === activeSeason) ?? seasons[0];

  async function playEpisode(episode: Episode, fromStart = false) {
    // A finished download plays from disk: no provider connection, no ffmpeg,
    // and it works with the network off.
    const offline = downloads.byItem.get(episode.id);
    const local = offline?.status === "done" ? await localPlaybackUrl(offline) : null;

    const url = local ?? (await resolveEpisodeStreamUrl(episode.id))?.url ?? null;
    if (!url) return;

    const progress = watched.get(episode.id);
    const canResume =
      !fromStart &&
      progress !== undefined &&
      !progress.completed &&
      progress.positionSecs > MIN_RESUME_SECS;

    setCountdown(null);
    setResumeAt(canResume ? progress.positionSecs : null);
    setStreamUrl(url);
    setPlaying(episode);
  }

  const loadProgress = React.useCallback(async () => {
    if (!profile || !seriesId) return;
    const history = await listHistory(profile.id, 200);
    setWatched(
      new Map(
        history
          .filter((entry) => entry.parentId === seriesId)
          .map((entry): [string, EpisodeProgress] => [
            entry.itemId,
            {
              ratio: entry.completed
                ? 1
                : entry.durationSecs && entry.positionSecs
                  ? entry.positionSecs / entry.durationSecs
                  : 0,
              positionSecs: entry.positionSecs ?? 0,
              completed: entry.completed,
            },
          ]),
      ),
    );
  }, [profile, seriesId]);

  const closePlayer = React.useCallback(() => {
    setPlaying(null);
    setResumeAt(null);
    void loadProgress();
  }, [loadProgress]);

  const { nextEpisode, previousEpisode } = React.useMemo(() => {
    if (!playing) return { nextEpisode: null, previousEpisode: null };
    const flat = seasons.flatMap((group) => group.episodes);
    const index = flat.findIndex((episode) => episode.id === playing.id);
    if (index < 0) return { nextEpisode: null, previousEpisode: null };
    return {
      nextEpisode: flat[index + 1] ?? null,
      previousEpisode: index > 0 ? (flat[index - 1] ?? null) : null,
    };
  }, [playing, seasons]);

  const [countdown, setCountdown] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (countdown === null) return;

    if (countdown <= 0) {
      setCountdown(null);
      if (nextEpisode) void playEpisode(nextEpisode);
      return;
    }

    const timer = setTimeout(() => setCountdown((value) => (value ?? 1) - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown, nextEpisode]);

  const handleEnded = React.useCallback(
    async (durationSecs: number) => {
      if (profile && playing && series && durationSecs > 0) {
        await recordWatch({
          profileId: profile.id,
          itemId: playing.id,
          kind: "series",
          parentId: series.id,
          title: `${series.name} · S${playing.season}B${playing.episode}`,
          poster: playing.cover ?? series.cover,
          positionSecs: durationSecs,
          durationSecs,
        });
      }

      await loadProgress();
      if (nextEpisode) setCountdown(AUTOPLAY_SECS);
    },
    [profile, playing, series, loadProgress, nextEpisode],
  );

  const { details: seriesTmdb } = useTmdbDetails(
    series ? { itemId: series.id, kind: "tv", title: series.name, year: series.year } : null,
  );

  const seriesView = React.useMemo(() => {
    if (!series) return null;
    return {
      poster:
        tmdbImageAtSize(series.cover, "w780") ??
        tmdbImageUrl(seriesTmdb?.posterPath, "w780") ??
        series.cover,
      backdrop:
        tmdbImageAtSize(series.backdrop, "w1280") ??
        tmdbImageUrl(seriesTmdb?.backdropPath, "w1280") ??
        series.cover,
      plot: series.plot ?? seriesTmdb?.overview ?? null,
      genre: series.genre ?? (seriesTmdb?.genres.length ? seriesTmdb.genres.join(", ") : null),
      rating: series.rating && series.rating > 0 ? series.rating : (seriesTmdb?.rating ?? null),
      year: series.year ?? seriesTmdb?.year ?? null,
      tagline: seriesTmdb?.tagline ?? null,
      cast: seriesTmdb?.cast ?? [],
    };
  }, [series, seriesTmdb]);

  const skipToNext = React.useCallback(() => {
    setCountdown(null);
    if (nextEpisode) void playEpisode(nextEpisode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextEpisode]);

  const handleProgress = React.useCallback(
    (position: number, duration: number) => {
      if (!profile || !playing || !series) return;
      void recordWatch({
        profileId: profile.id,
        itemId: playing.id,
        kind: "series",
        parentId: series.id,
        title: `${series.name} · S${playing.season}B${playing.episode}`,
        poster: playing.cover ?? series.cover,
        positionSecs: position,
        durationSecs: duration,
      });
    },
    [profile, playing, series],
  );

  return (
    <DetailOverlay
      open={Boolean(seriesId)}
      onClose={onClose}
      backdrop={seriesView?.backdrop ?? series?.cover ?? null}
    >
      {loading && !series ? (
        <div className="flex flex-col gap-4 p-6 sm:flex-row">
          <Skeleton className="aspect-[2/3] w-full shrink-0 rounded-lg sm:w-48" />
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      ) : !series ? (
        <div className="text-muted-foreground p-6 text-sm">Dizi bulunamadı.</div>
      ) : playing ? (
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <VideoPlayer
            url={streamUrl}
            title={`${series.name} · S${playing.season}B${playing.episode}`}
            logo={playing.cover ?? series.cover}
            live={false}
            startPositionSecs={resumeAt}
            onOpenExternally={() => {
              // Stop here first — the subscription allows one connection.
              const startSecs = resumeAt ?? 0;
              const episode = playing;
              const title = `${series.name} · S${episode.season}B${episode.episode}`;
              setPlaying(null);
              setStreamUrl(null);

              void episodeStreamTemplate(episode.id).then((template) =>
                handOff({ template, title, startSecs }),
              );
            }}
            onProgress={handleProgress}
            onEnded={(duration) => void handleEnded(duration)}
            mediaSubtitle={series.name}
            subtitleSearch={{
              title: series.name,
              year: series.year,
              tmdbId: seriesTmdb?.tmdbId ?? null,
              season: playing.season,
              episode: playing.episode,
            }}
            onPrevious={
              previousEpisode
                ? () => {
                    setCountdown(null);
                    void playEpisode(previousEpisode);
                  }
                : undefined
            }
            onNext={nextEpisode ? skipToNext : undefined}
            previousLabel="Önceki bölüm"
            nextLabel="Sonraki bölüm"
            overlay={
              countdown !== null && nextEpisode ? (
                <NextEpisodePrompt
                  title={nextEpisode.title}
                  subtitle={`${nextEpisode.season}. Sezon · ${nextEpisode.episode}. Bölüm`}
                  poster={nextEpisode.cover ?? series.cover}
                  seconds={countdown}
                  onPlayNow={skipToNext}
                  onCancel={() => setCountdown(null)}
                />
              ) : null
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-md text-foreground font-semibold tracking-tight">
                {playing.title}
              </h2>
              <p className="text-muted-foreground text-xs">
                {series.name} · {playing.season}. Sezon {playing.episode}. Bölüm
                {resumeAt ? ` · ${formatDuration(resumeAt)} konumundan devam` : ""}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {resumeAt ? (
                <Button variant="outline" size="sm" onClick={() => void playEpisode(playing, true)}>
                  <RotateCcw /> Baştan başlat
                </Button>
              ) : null}
              {nextEpisode ? (
                <Button size="sm" onClick={() => void playEpisode(nextEpisode)}>
                  <SkipForward /> Sonraki bölüm
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={closePlayer}>
                Bölüm listesine dön
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="w-full shrink-0 sm:w-48">
              <div className="border-border/70 bg-surface-2 aspect-[2/3] overflow-hidden rounded-lg border">
                {seriesView?.poster && !coverFailed ? (
                  <img
                    src={seriesView.poster}
                    alt=""
                    onError={() => setCoverFailed(true)}
                    className="size-full object-cover"
                  />
                ) : (
                  <div className="text-muted-foreground grid size-full place-items-center p-4 text-center text-xs">
                    {series.name}
                  </div>
                )}
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-col gap-2 pr-8">
                <h2 className="text-foreground text-xl font-semibold leading-tight tracking-tight">
                  {series.name}
                </h2>
                {seriesView?.tagline ? (
                  <p className="text-muted-foreground text-xs italic">{seriesView.tagline}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  {seriesView?.year ? (
                    <Badge variant="outline">
                      <CalendarDays /> {seriesView.year}
                    </Badge>
                  ) : null}
                  {seriesView?.rating && seriesView.rating > 0 ? (
                    <Badge variant="warning">
                      <Star /> {seriesView.rating.toFixed(1)}
                    </Badge>
                  ) : null}
                  {seasons.length > 0 ? (
                    <Badge variant="brand">{seasons.length} sezon</Badge>
                  ) : null}
                </div>
                {seriesView?.genre ? (
                  <p className="text-muted-foreground text-xs">{seriesView.genre}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <FavoriteButton itemId={series.id} kind="series" />
                <TrailerButton trailerKey={seriesTmdb?.trailerKey ?? null} title={series.name} />
              </div>

              {seriesView?.plot ? (
                <p className="text-muted-foreground text-sm leading-relaxed">{seriesView.plot}</p>
              ) : null}

              {seriesView ? <CastStrip people={seriesView.cast} /> : null}
            </div>
          </div>

          {error ? (
            <div className="border-destructive/25 bg-destructive/[0.07] flex items-start gap-3 rounded-lg border p-4">
              <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
              <p className="text-foreground text-sm">{error}</p>
            </div>
          ) : loading ? (
            <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
              <Spinner /> Bölümler alınıyor…
            </div>
          ) : seasons.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">
              Bu dizi için bölüm bilgisi bulunamadı.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {seasons.length > 1 ? (
                <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                  {seasons.map((group) => (
                    <button
                      key={group.season}
                      type="button"
                      onClick={() => setActiveSeason(group.season)}
                      className={cn(
                        "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium",
                        "duration-fast ease-brand transition-colors",
                        "focus-visible:ring-ring/70 focus-visible:outline-none focus-visible:ring-2",
                        group.season === currentSeason?.season
                          ? "bg-accent/70 text-foreground"
                          : "text-muted-foreground hover:bg-accent/35 hover:text-foreground",
                      )}
                    >
                      {group.season}. Sezon
                    </button>
                  ))}
                </div>
              ) : null}

              <ul className="flex flex-col gap-1">
                {currentSeason?.episodes.map((episode) => {
                  const playable = isBrowserPlayableContainer(episode.containerExt);
                  const progress = watched.get(episode.id) ?? {
                    ratio: 0,
                    positionSecs: 0,
                    completed: false,
                  };

                  return (
                    <li
                      key={episode.id}
                      className={cn(
                        "flex items-center rounded-md",
                        "duration-fast ease-brand transition-colors",
                        playable ? "hover:bg-accent/40" : "opacity-55",
                      )}
                    >
                      <button
                        type="button"
                        disabled={!playable}
                        onClick={() => void playEpisode(episode)}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2.5 text-left",
                          "focus-visible:ring-ring/70 focus-visible:outline-none focus-visible:ring-2",
                          playable ? null : "cursor-not-allowed",
                        )}
                      >
                        <span className="tabular text-muted-foreground w-8 shrink-0 text-center text-xs">
                          {episode.episode}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="text-foreground block truncate text-sm">
                            {episode.title}
                          </span>
                          {episode.durationSecs ? (
                            <span className="tabular text-2xs text-muted-foreground">
                              {formatDuration(episode.durationSecs)}
                            </span>
                          ) : null}
                        </span>

                        {progress.completed || progress.ratio >= 0.92 ? (
                          <Check className="text-success size-4 shrink-0" />
                        ) : progress.ratio > 0 ? (
                          <span
                            title={`${formatDuration(progress.positionSecs)} izlendi`}
                            className="bg-surface-3 h-1 w-10 shrink-0 overflow-hidden rounded-full"
                          >
                            <span
                              className="bg-primary block h-full rounded-full"
                              style={{ width: `${progress.ratio * 100}%` }}
                            />
                          </span>
                        ) : playable ? (
                          <Play className="text-muted-foreground size-3.5 shrink-0" />
                        ) : (
                          <Badge variant="outline">
                            {(episode.containerExt ?? "?").toUpperCase()}
                          </Badge>
                        )}
                      </button>

                      <DownloadButton
                        compact
                        kind="episode"
                        itemId={episode.id}
                        title={`${series.name} · S${episode.season}B${episode.episode}`}
                        poster={episode.cover ?? series.cover}
                        resolveUrl={async () =>
                          (await resolveEpisodeStreamUrl(episode.id))?.url ?? null
                        }
                        className="mr-1.5"
                      />
                    </li>
                  );
                })}
              </ul>

              {currentSeason?.episodes.every(
                (episode) => !isBrowserPlayableContainer(episode.containerExt),
              ) ? (
                <UnsupportedContainerNotice
                  container={currentSeason.episodes[0]?.containerExt ?? null}
                />
              ) : null}
            </div>
          )}
        </div>
      )}
    </DetailOverlay>
  );
}
