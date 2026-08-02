import type { FetchOptions, HttpClient } from "./http.js";

const API_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";

export type TmdbImageSize =
  "w92" | "w154" | "w185" | "w342" | "w500" | "w780" | "w1280" | "original";

const TMDB_IMAGE_RE = /^https?:\/\/image\.tmdb\.org\/t\/p\/([^/]+)(\/.+)$/i;

export function isTmdbImageUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && TMDB_IMAGE_RE.test(url);
}

export function tmdbImageAtSize(
  url: string | null | undefined,
  size: TmdbImageSize,
): string | null {
  if (!url) return null;
  const match = TMDB_IMAGE_RE.exec(url);
  if (!match) return url;
  return `${IMAGE_BASE}/${size}${match[2]}`;
}

export function tmdbImageUrl(path: string | null | undefined, size: TmdbImageSize): string | null {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface TmdbPerson {
  name: string;
  character: string | null;
  profilePath: string | null;
}

export interface TmdbDetails {
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  genres: string[];
  rating: number | null;
  voteCount: number | null;
  year: number | null;
  runtimeMins: number | null;
  tagline: string | null;
  cast: TmdbPerson[];
  /** YouTube id of the best trailer, or null when there is none. */
  trailerKey: string | null;
}

export interface TmdbClientOptions {
  token: string;
  http: HttpClient;

  language?: string;
}

interface RawGenre {
  name?: unknown;
}

interface RawCastMember {
  name?: unknown;
  character?: unknown;
  profile_path?: unknown;
}

interface RawDetails {
  id?: unknown;
  title?: unknown;
  name?: unknown;
  original_title?: unknown;
  original_name?: unknown;
  overview?: unknown;
  poster_path?: unknown;
  backdrop_path?: unknown;
  genres?: unknown;
  vote_average?: unknown;
  vote_count?: unknown;
  release_date?: unknown;
  first_air_date?: unknown;
  runtime?: unknown;
  episode_run_time?: unknown;
  tagline?: unknown;
  credits?: unknown;
  videos?: unknown;
}

interface RawSearchResponse {
  results?: unknown;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function yearOf(value: unknown): number | null {
  const text = str(value);
  if (!text) return null;
  const year = Number(text.slice(0, 4));
  return Number.isFinite(year) && year > 1800 ? year : null;
}

/**
 * Picks one trailer out of the pile TMDB returns.
 *
 * A popular title can carry a dozen entries — teasers, clips, featurettes, in
 * several languages. Ranking rather than taking the first keeps the result on
 * the actual trailer, and only YouTube is considered because that is the one
 * site an external browser will certainly play.
 */
function parseTrailerKey(videos: unknown): string | null {
  if (typeof videos !== "object" || videos === null) return null;
  const list = (videos as { results?: unknown }).results;
  if (!Array.isArray(list)) return null;

  let best: { key: string; score: number } | null = null;

  for (const entry of list) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as { key?: unknown; site?: unknown; type?: unknown; official?: unknown };

    const key = str(row.key);
    if (!key || str(row.site)?.toLowerCase() !== "youtube") continue;

    const type = str(row.type)?.toLowerCase();
    const score = (type === "trailer" ? 4 : type === "teaser" ? 2 : 0) + (row.official ? 1 : 0);

    if (!best || score > best.score) best = { key, score };
  }

  return best?.key ?? null;
}

const MAX_CAST = 12;

function parseCast(credits: unknown): TmdbPerson[] {
  if (typeof credits !== "object" || credits === null) return [];
  const list = (credits as { cast?: unknown }).cast;
  if (!Array.isArray(list)) return [];

  const people: TmdbPerson[] = [];
  for (const entry of list.slice(0, MAX_CAST)) {
    if (typeof entry !== "object" || entry === null) continue;
    const member = entry as RawCastMember;
    const name = str(member.name);
    if (!name) continue;
    people.push({
      name,
      character: str(member.character),
      profilePath: str(member.profile_path),
    });
  }
  return people;
}

function parseDetails(raw: RawDetails): TmdbDetails | null {
  const tmdbId = num(raw.id);
  const title = str(raw.title) ?? str(raw.name);
  if (tmdbId === null || !title) return null;

  const genres: string[] = [];
  if (Array.isArray(raw.genres)) {
    for (const entry of raw.genres) {
      if (typeof entry !== "object" || entry === null) continue;
      const name = str((entry as RawGenre).name);
      if (name) genres.push(name);
    }
  }

  const runtime =
    num(raw.runtime) ?? (Array.isArray(raw.episode_run_time) ? num(raw.episode_run_time[0]) : null);

  return {
    tmdbId,
    title,
    originalTitle: str(raw.original_title) ?? str(raw.original_name),
    overview: str(raw.overview),
    posterPath: str(raw.poster_path),
    backdropPath: str(raw.backdrop_path),
    genres,
    rating: num(raw.vote_average),
    voteCount: num(raw.vote_count),
    year: yearOf(raw.release_date) ?? yearOf(raw.first_air_date),
    runtimeMins: runtime,
    tagline: str(raw.tagline),
    cast: parseCast(raw.credits),
    trailerKey: parseTrailerKey(raw.videos),
  };
}

export type TmdbKind = "movie" | "tv";

export class TmdbClient {
  private readonly token: string;
  private readonly http: HttpClient;
  private readonly language: string;

  constructor(options: TmdbClientOptions) {
    this.token = options.token.trim();
    this.http = options.http;
    this.language = options.language ?? "tr-TR";
  }

  private isBearerToken(): boolean {
    return this.token.split(".").length === 3;
  }

  private buildUrl(path: string, params: Record<string, string> = {}): string {
    const url = new URL(`${API_BASE}${path}`);
    url.searchParams.set("language", this.language);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    if (!this.isBearerToken()) url.searchParams.set("api_key", this.token);
    return url.toString();
  }

  private headers(): Record<string, string> {
    return this.isBearerToken()
      ? { Authorization: `Bearer ${this.token}`, Accept: "application/json" }
      : { Accept: "application/json" };
  }

  private request<T>(path: string, params: Record<string, string>, options?: FetchOptions) {
    return this.http.json<T>(this.buildUrl(path, params), {
      ...options,
      headers: { ...this.headers(), ...options?.headers },
    });
  }

  async details(
    kind: TmdbKind,
    tmdbId: number,
    options?: FetchOptions,
  ): Promise<TmdbDetails | null> {
    const raw = await this.request<RawDetails>(
      `/${kind}/${tmdbId}`,

      {
        append_to_response: "credits,videos",
        /**
         * MEASURED: without this the language above filters the trailers too,
         * and most titles have none in Turkish — Inception returns 27 videos
         * with it and zero without. Breaking Bad happens to have a Turkish
         * trailer, so checking a single title would have hidden this.
         * `null` covers entries TMDB files under no language at all.
         */
        include_video_language: "tr,en,null",
      },
      options,
    );
    return parseDetails(raw);
  }

  async search(
    kind: TmdbKind,
    title: string,
    year: number | null,
    options?: FetchOptions,
  ): Promise<number | null> {
    const params: Record<string, string> = { query: title, include_adult: "false" };
    if (year)
      params[kind === "movie" ? "primary_release_year" : "first_air_date_year"] = String(year);

    const raw = await this.request<RawSearchResponse>(`/search/${kind}`, params, options);
    if (!Array.isArray(raw.results)) return null;

    const first = raw.results[0];
    if (typeof first !== "object" || first === null) return null;
    return num((first as { id?: unknown }).id);
  }

  async lookup(
    kind: TmdbKind,
    input: { tmdbId: number | null; title: string; year: number | null },
    options?: FetchOptions,
  ): Promise<TmdbDetails | null> {
    const id = input.tmdbId ?? (await this.search(kind, input.title, input.year, options));
    if (id === null) return null;
    return this.details(kind, id, options);
  }
}

export function cleanTitleForSearch(name: string): string {
  return name
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\((?:19|20)\d{2}\)/g, " ")
    .replace(/\b(4k|uhd|fhd|hd|sd|1080p?|720p?|2160p?)\b/gi, " ")
    .replace(/\b(tr|tur|eng?|multi)[\s-]?(sub|dub|altyaz[iı]l[iı]|dublaj)\b/gi, " ")
    .replace(/\b(altyaz[iı]l[iı]|dublaj|t[uü]rk[cç]e)\b/gi, " ")
    .replace(/[-–—_|]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
