import type { ContentKind } from "./types.js";
import { normalizeForSearch } from "./text.js";

const PATH_SERIES_RE = /\/series\//i;
const PATH_MOVIE_RE = /\/(movie|movies|vod)\//i;
const PATH_LIVE_RE = /\/live\//i;

const VOD_EXT_RE = /\.(mkv|mp4|avi|mov|m4v|flv|wmv|mpg|mpeg|webm|divx)(\?|$)/i;
const LIVE_EXT_RE = /\.(m3u8|ts|mpegts|mpd)(\?|$)/i;

/**
 * Containers a browser plays as-is; everything else needs ffmpeg, which only
 * the desktop build carries.
 */
const DIRECT_PLAY_CONTAINERS = new Set(["mp4", "m4v", "webm", "mov"]);

export function isDirectPlayContainer(container: string | null | undefined): boolean {
  // An unknown container counts as playable: refusing on no evidence would
  // hide titles that turn out to be fine.
  if (!container) return true;
  return DIRECT_PLAY_CONTAINERS.has(container.replace(/^\./, "").toLowerCase());
}

const GROUP_SERIES_WORDS = ["dizi", "diziler", "series", "serie", "serien", "tv show", "tvshow"];

const GROUP_VOD_WORDS = [
  "film",
  "filmler",
  "movie",
  "movies",
  "vod",
  "cinema",
  "sinema",
  "kino",
  "peliculas",
];

function hasFileExtension(url: string): boolean {
  const withoutQuery = url.split("?")[0] ?? url;
  const lastSlash = withoutQuery.lastIndexOf("/");
  const lastSegment = lastSlash === -1 ? withoutQuery : withoutQuery.slice(lastSlash + 1);
  return /\.[A-Za-z0-9]{2,5}$/.test(lastSegment);
}

export function classifyEntry(url: string, groupTitle: string, duration: number): ContentKind {
  if (PATH_SERIES_RE.test(url)) return "series";
  if (PATH_MOVIE_RE.test(url)) return "vod";
  if (PATH_LIVE_RE.test(url)) return "live";

  const group = normalizeForSearch(groupTitle);
  const groupSaysSeries = GROUP_SERIES_WORDS.some((word) => group.includes(word));
  const groupSaysVod = GROUP_VOD_WORDS.some((word) => group.includes(word));

  if (VOD_EXT_RE.test(url)) {
    return groupSaysSeries ? "series" : "vod";
  }

  if (LIVE_EXT_RE.test(url)) {
    if (groupSaysSeries && duration > 0) return "series";
    if (groupSaysVod && duration > 0) return "vod";
    return "live";
  }

  if (!hasFileExtension(url)) return "live";

  if (groupSaysSeries) return "series";
  if (groupSaysVod) return "vod";

  return "live";
}

export interface EpisodeTag {
  seriesName: string;
  season: number;
  episode: number;
  episodeTitle: string;
}

const EPISODE_PATTERNS: RegExp[] = [
  /^(.*?)[\s._[(-]*s(?:eason)?\s*(\d{1,3})\s*[\s._x-]*e(?:p|pisode)?\s*(\d{1,4})[\s._\])-]*(.*)$/i,

  /^(.*?)[\s._[(-]+(\d{1,3})\s*x\s*(\d{1,4})[\s._\])-]*(.*)$/i,

  /^(.*?)[\s._[(-]*sezon\s*(\d{1,3})\s*[\s._-]*b(?:ö|o)l(?:ü|u)m\s*(\d{1,4})[\s._\])-]*(.*)$/i,
];

export function parseEpisodeTag(title: string): EpisodeTag | null {
  for (const pattern of EPISODE_PATTERNS) {
    const match = pattern.exec(title);
    if (!match) continue;

    const rawName = (match[1] ?? "").replace(/[\s._|-]+$/, "").trim();
    const season = Number.parseInt(match[2] ?? "", 10);
    const episode = Number.parseInt(match[3] ?? "", 10);
    if (!rawName || !Number.isFinite(season) || !Number.isFinite(episode)) continue;

    const trailing = (match[4] ?? "").replace(/^[\s._|:-]+/, "").trim();

    return {
      seriesName: rawName,
      season,
      episode,
      episodeTitle: trailing || `${season}. Sezon ${episode}. Bölüm`,
    };
  }
  return null;
}
