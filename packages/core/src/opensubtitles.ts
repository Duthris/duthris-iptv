import type { FetchOptions, HttpClient } from "./http.js";

const API_BASE = "https://api.opensubtitles.com/api/v1";

/**
 * Builds a query string the way this API insists on.
 *
 * Three rules, all of which the server enforces with a 301 rather than an
 * error, so getting any of them wrong produces a redirect that quietly returns
 * nothing useful if the caller does not follow it:
 *
 *  - parameters sorted alphabetically
 *  - `query` lowercased
 *  - spaces in `query` written as `+`, not `%20`
 *
 * Verified against the live API: every deviation redirected to the normalised
 * form, and only the normalised form answered directly.
 */
function buildQuery(params: Record<string, string | number>): string {
  const keys = Object.keys(params).sort();
  const parts = keys.map((key) => {
    const raw = String(params[key]);
    const value =
      key === "query"
        ? raw.toLowerCase().trim().replace(/\s+/g, "+")
        : encodeURIComponent(raw);
    return `${key}=${value}`;
  });
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

export interface SubtitleCandidate {
  fileId: number;
  fileName: string | null;
  language: string;
  release: string;
  downloadCount: number;
  hearingImpaired: boolean;
  machineTranslated: boolean;
  fps: number | null;
  uploadedAt: string | null;
}

export interface SubtitleSearchInput {
  /** Free-text title. Ignored when a TMDB id is supplied. */
  query?: string;
  /** Far more precise than a title search when it is known. */
  tmdbId?: number | null;
  year?: number | null;
  season?: number | null;
  episode?: number | null;
  /** Comma-separated ISO-639-1 codes, e.g. "tr,en". */
  languages: string;
}

export interface SubtitleDownload {
  link: string;
  fileName: string | null;
  /** Downloads left today; the anonymous allowance is small. */
  remaining: number | null;
  resetsIn: string | null;
}

export class OpenSubtitlesQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenSubtitlesQuotaError";
  }
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function parseCandidates(raw: unknown): SubtitleCandidate[] {
  if (typeof raw !== "object" || raw === null) return [];
  const rows = (raw as { data?: unknown }).data;
  if (!Array.isArray(rows)) return [];

  const results: SubtitleCandidate[] = [];

  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const attributes = (row as { attributes?: unknown }).attributes;
    if (typeof attributes !== "object" || attributes === null) continue;

    const entry = attributes as Record<string, unknown>;
    const files = entry["files"];
    const file = Array.isArray(files) && files.length > 0 ? files[0] : null;
    const fileId = num((file as Record<string, unknown> | null)?.["file_id"]);
    if (fileId === null) continue;

    results.push({
      fileId,
      fileName: str((file as Record<string, unknown>)["file_name"]),
      language: str(entry["language"]) ?? "?",
      release: str(entry["release"]) ?? "—",
      downloadCount: num(entry["download_count"]) ?? 0,
      hearingImpaired: entry["hearing_impaired"] === true,
      machineTranslated: entry["ai_translated"] === true || entry["machine_translated"] === true,
      fps: num(entry["fps"]),
      uploadedAt: str(entry["upload_date"]),
    });
  }

  // Most-downloaded first: on this service that tracks quality closely enough.
  return results.sort((a, b) => b.downloadCount - a.downloadCount);
}

export interface OpenSubtitlesOptions {
  apiKey: string;
  http: HttpClient;
  /** Required by the service; it rejects generic user agents. */
  userAgent: string;
}

export class OpenSubtitlesClient {
  private readonly apiKey: string;
  private readonly http: HttpClient;
  private readonly userAgent: string;

  constructor(options: OpenSubtitlesOptions) {
    this.apiKey = options.apiKey.trim();
    this.http = options.http;
    this.userAgent = options.userAgent;
  }

  private headers(): Record<string, string> {
    return {
      "Api-Key": this.apiKey,
      "User-Agent": this.userAgent,
      Accept: "application/json",
    };
  }

  async search(
    input: SubtitleSearchInput,
    options?: FetchOptions,
  ): Promise<SubtitleCandidate[]> {
    const params: Record<string, string | number> = { languages: input.languages };

    if (input.tmdbId) {
      // Series episodes hang off the parent id, films off their own.
      if (input.season !== null && input.season !== undefined) {
        params["parent_tmdb_id"] = input.tmdbId;
        params["season_number"] = input.season;
        if (input.episode !== null && input.episode !== undefined) {
          params["episode_number"] = input.episode;
        }
      } else {
        params["tmdb_id"] = input.tmdbId;
      }
    } else if (input.query) {
      params["query"] = input.query;
      if (input.year) params["year"] = input.year;
      if (input.season !== null && input.season !== undefined) {
        params["season_number"] = input.season;
      }
      if (input.episode !== null && input.episode !== undefined) {
        params["episode_number"] = input.episode;
      }
    } else {
      return [];
    }

    const raw = await this.http.json<unknown>(`${API_BASE}/subtitles${buildQuery(params)}`, {
      ...options,
      headers: { ...this.headers(), ...options?.headers },
    });

    return parseCandidates(raw);
  }

  /**
   * Turns a file id into a temporary download link.
   *
   * This is the call that consumes quota — the anonymous allowance is 100 a day
   * on a consumer flagged for development and five otherwise, so the caller
   * should download once the user has chosen, never speculatively.
   */
  async requestDownload(fileId: number, options?: FetchOptions): Promise<SubtitleDownload> {
    const raw = await this.http.json<unknown>(`${API_BASE}/download`, {
      ...options,
      method: "POST",
      body: JSON.stringify({ file_id: fileId }),
      headers: { ...this.headers(), "Content-Type": "application/json", ...options?.headers },
    });

    const row = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    const link = str(row["link"]);

    if (!link) {
      throw new OpenSubtitlesQuotaError(
        str(row["message"]) ?? "Altyazı indirme bağlantısı alınamadı; günlük hak dolmuş olabilir.",
      );
    }

    return {
      link,
      fileName: str(row["file_name"]),
      remaining: num(row["remaining"]),
      resetsIn: str(row["reset_time"]),
    };
  }
}
