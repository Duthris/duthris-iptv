import type { Episode, LiveChannel, PlaylistSource, StreamFormat, VodItem } from "./types.js";
import {
  buildLiveStreamUrl,
  buildSeriesStreamUrl,
  buildVodStreamUrl,
  type XtreamCredentials,
} from "./xtream/url.js";

export type StreamKind = "hls" | "mpegts" | "progressive" | "dash" | "unknown";

export interface ResolvedStream {
  url: string;
  kind: StreamKind;

  insecure: boolean;
}

export interface PlaybackContext {
  pageIsSecure: boolean;
  isDesktop: boolean;
}

export interface SourceRuntime {
  source: PlaylistSource;
  credentials: XtreamCredentials | null;
  context: PlaybackContext;
}

const HLS_RE = /\.m3u8(\?|$)/i;
const DASH_RE = /\.mpd(\?|$)/i;
const TS_RE = /\.(ts|mpegts)(\?|$)/i;
const PROGRESSIVE_RE = /\.(mp4|mkv|avi|mov|m4v|webm|flv|wmv|mpg|mpeg|divx)(\?|$)/i;

export function detectStreamKind(url: string): StreamKind {
  if (HLS_RE.test(url)) return "hls";
  if (DASH_RE.test(url)) return "dash";
  if (TS_RE.test(url)) return "mpegts";
  if (PROGRESSIVE_RE.test(url)) return "progressive";
  return "unknown";
}

function describe(url: string): ResolvedStream {
  return {
    url,
    kind: detectStreamKind(url),
    insecure: url.toLowerCase().startsWith("http://"),
  };
}

export function effectiveProtocol(
  source: PlaylistSource,
  context: PlaybackContext,
): "http" | "https" {
  const preference = source.streamProtocol ?? "auto";
  if (preference !== "auto") return preference;
  return context.pageIsSecure && !context.isDesktop ? "https" : "http";
}

export function resolveStreamBaseUrl(source: PlaylistSource, context: PlaybackContext): string {
  const endpoints = source.streamEndpoints;
  const protocol = effectiveProtocol(source, context);

  if (protocol === "http") return endpoints?.http ?? rewriteScheme(source.url, "http");
  return endpoints?.https ?? rewriteScheme(source.url, "https");
}

export function rewriteScheme(url: string, protocol: "http" | "https"): string {
  try {
    const parsed = new URL(url);
    const current = parsed.protocol === "https:" ? "https" : "http";
    if (current === protocol) return url;

    const hadNoPort = parsed.port === "";
    parsed.protocol = `${protocol}:`;
    if (protocol === "http") {
      if (parsed.port === "443" || hadNoPort) parsed.port = "8080";
    } else if (parsed.port === "8080") {
      parsed.port = "443";
    }

    return parsed.toString().replace(/\/$/, url.endsWith("/") ? "/" : "");
  } catch {
    return url;
  }
}

function applyProtocol(url: string, runtime: SourceRuntime): string {
  return rewriteScheme(url, effectiveProtocol(runtime.source, runtime.context));
}

export function resolveLiveStream(
  channel: LiveChannel,
  runtime: SourceRuntime,
  format?: StreamFormat,
): ResolvedStream | null {
  if (channel.url) return describe(applyProtocol(channel.url, runtime));

  if (runtime.credentials && channel.streamId !== null) {
    const preferred = format ?? runtime.source.preferredFormat;
    const credentials: XtreamCredentials = {
      ...runtime.credentials,
      baseUrl: resolveStreamBaseUrl(runtime.source, runtime.context),
    };
    return describe(buildLiveStreamUrl(credentials, channel.streamId, preferred));
  }

  return null;
}

export function resolveVodStream(item: VodItem, runtime: SourceRuntime): ResolvedStream | null {
  if (item.url) return describe(applyProtocol(item.url, runtime));

  if (runtime.credentials && item.streamId !== null) {
    const credentials: XtreamCredentials = {
      ...runtime.credentials,
      baseUrl: resolveStreamBaseUrl(runtime.source, runtime.context),
    };
    return describe(buildVodStreamUrl(credentials, item.streamId, item.containerExt));
  }

  return null;
}

export function resolveEpisodeStream(
  episode: Episode,
  runtime: SourceRuntime,
): ResolvedStream | null {
  if (episode.url) return describe(applyProtocol(episode.url, runtime));

  if (runtime.credentials && episode.streamId !== null) {
    const credentials: XtreamCredentials = {
      ...runtime.credentials,
      baseUrl: resolveStreamBaseUrl(runtime.source, runtime.context),
    };
    return describe(buildSeriesStreamUrl(credentials, episode.streamId, episode.containerExt));
  }

  return null;
}

export interface PlaybackCapabilityCheck {
  playable: boolean;
  reason: "mixed-content" | "unsupported-container" | null;
  message: string | null;
}

export function checkPlaybackCapability(
  stream: ResolvedStream,
  context: PlaybackContext,
): PlaybackCapabilityCheck {
  if (!context.isDesktop && context.pageIsSecure && stream.insecure) {
    return {
      playable: false,
      reason: "mixed-content",
      message:
        "Bu yayın güvensiz (http) bir adresten geliyor. Tarayıcı, güvenli bir sayfadan " +
        "güvensiz yayın oynatılmasına izin vermez. Windows uygulamasında sorunsuz açılır.",
    };
  }

  if (!context.isDesktop && stream.kind === "progressive") {
    const isUnsupported = /\.(mkv|avi|flv|wmv|divx|mpg|mpeg)(\?|$)/i.test(stream.url);
    if (isUnsupported) {
      return {
        playable: false,
        reason: "unsupported-container",
        message:
          "Bu içeriğin kapsayıcı biçimi (mkv/avi gibi) tarayıcıda desteklenmiyor. " +
          "Windows uygulamasında oynatılabilir.",
      };
    }
  }

  return { playable: true, reason: null, message: null };
}
