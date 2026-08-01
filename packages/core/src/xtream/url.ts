import type { StreamEndpoints, StreamFormat } from "../types.js";

export interface XtreamCredentials {
  baseUrl: string;
  username: string;
  password: string;
}

export class XtreamUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XtreamUrlError";
  }
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function parseXtreamCredentials(
  input: string,
  overrides: { username?: string; password?: string } = {},
): XtreamCredentials {
  const trimmed = input.trim();
  if (!trimmed) throw new XtreamUrlError("Sunucu adresi boş olamaz");

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new XtreamUrlError("Geçersiz sunucu adresi");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new XtreamUrlError("Yalnızca http/https adresleri desteklenir");
  }

  const username = overrides.username?.trim() || parsed.searchParams.get("username") || "";
  const password = overrides.password?.trim() || parsed.searchParams.get("password") || "";

  if (!username || !password) {
    throw new XtreamUrlError("Kullanıcı adı ve parola gerekli");
  }

  return {
    baseUrl: stripTrailingSlash(parsed.origin),
    username,
    password,
  };
}

export function looksLikeXtreamUrl(input: string): boolean {
  const lowered = input.toLowerCase();
  if (!lowered.includes("username=") || !lowered.includes("password=")) return false;
  return lowered.includes("get.php") || lowered.includes("player_api.php");
}

export function buildStreamEndpoints(
  credentials: XtreamCredentials,
  serverInfo?: {
    url?: string | undefined;
    port?: string | number | null | undefined;
    https_port?: string | number | null | undefined;
  },
): StreamEndpoints {
  let host: string;
  try {
    host = new URL(credentials.baseUrl).hostname;
  } catch {
    host = credentials.baseUrl;
  }

  const reported = serverInfo?.url?.trim();
  if (reported) {
    host = reported
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "");
  }

  const toPort = (value: unknown): string | null => {
    const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
    return Number.isFinite(parsed) && parsed > 0 && parsed < 65536 ? String(parsed) : null;
  };

  const httpPort = toPort(serverInfo?.port);
  const httpsPort = toPort(serverInfo?.https_port);

  return {
    http: httpPort ? `http://${host}:${httpPort}` : null,
    https: httpsPort ? `https://${host}:${httpsPort}` : null,
  };
}

export function buildApiUrl(
  credentials: XtreamCredentials,
  action?: string,
  params: Record<string, string | number> = {},
): string {
  const url = new URL(`${credentials.baseUrl}/player_api.php`);
  url.searchParams.set("username", credentials.username);
  url.searchParams.set("password", credentials.password);
  if (action) url.searchParams.set("action", action);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export function buildXmltvUrl(credentials: XtreamCredentials): string {
  const url = new URL(`${credentials.baseUrl}/xmltv.php`);
  url.searchParams.set("username", credentials.username);
  url.searchParams.set("password", credentials.password);
  return url.toString();
}

export function buildLiveStreamUrl(
  credentials: XtreamCredentials,
  streamId: number | string,
  format: StreamFormat = "m3u8",
): string {
  const { baseUrl, username, password } = credentials;
  return `${baseUrl}/live/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${streamId}.${format}`;
}

export function buildVodStreamUrl(
  credentials: XtreamCredentials,
  streamId: number | string,
  containerExt: string | null,
): string {
  const { baseUrl, username, password } = credentials;
  const ext = (containerExt ?? "mp4").replace(/^\./, "");
  return `${baseUrl}/movie/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${streamId}.${ext}`;
}

export function buildSeriesStreamUrl(
  credentials: XtreamCredentials,
  episodeId: number | string,
  containerExt: string | null,
): string {
  const { baseUrl, username, password } = credentials;
  const ext = (containerExt ?? "mp4").replace(/^\./, "");
  return `${baseUrl}/series/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${episodeId}.${ext}`;
}

export function buildTimeshiftUrl(
  credentials: XtreamCredentials,
  streamId: number | string,
  startAt: Date,
  durationMinutes: number,
): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const start =
    `${startAt.getFullYear()}-${pad(startAt.getMonth() + 1)}-${pad(startAt.getDate())}` +
    `:${pad(startAt.getHours())}-${pad(startAt.getMinutes())}`;

  const url = new URL(`${credentials.baseUrl}/streaming/timeshift.php`);
  url.searchParams.set("username", credentials.username);
  url.searchParams.set("password", credentials.password);
  url.searchParams.set("stream", String(streamId));
  url.searchParams.set("start", start);
  url.searchParams.set("duration", String(Math.max(1, Math.round(durationMinutes))));
  return url.toString();
}

export function maskCredentialsInUrl(url: string): string {
  return url.replace(/(password=)[^&]*/gi, "$1***").replace(/(\/[^/]+\/)[^/]+(\/\d+\.)/, "$1***$2");
}
