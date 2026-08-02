import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { app } from "electron";

export function ffmpegPath(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const resolved = require("ffmpeg-static") as string | null;
  if (!resolved) throw new Error("ffmpeg bulunamadı");

  return app.isPackaged ? resolved.replace("app.asar", "app.asar.unpacked") : resolved;
}

const USER_AGENT = "VLC/3.0.20 LibVLC/3.0.20";

export interface StreamTrack {
  index: number;

  typeIndex: number;
  codec: string;

  language: string | null;

  title: string | null;

  layout: string | null;
  default: boolean;
  forced: boolean;
}

export interface MediaInfo {
  videoCodec: string | null;
  audioCodec: string | null;
  durationSecs: number | null;
  hasVideo: boolean;
  audioTracks: StreamTrack[];
  subtitleTracks: StreamTrack[];
}

const BROWSER_VIDEO = new Set(["h264", "av1", "vp9"]);

const BROWSER_AUDIO = new Set(["aac", "mp3"]);

const DURATION_RE = /Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/;

const STREAM_RE =
  /^\s*Stream #\d+:(\d+)(?:\[[^\]]*\])?(?:\(([A-Za-z]{2,3})\))?:\s*(Video|Audio|Subtitle):\s*([A-Za-z0-9_]+)(.*)$/;

const METADATA_TITLE_RE = /^\s{4,}title\s*:\s*(.+?)\s*$/;

const AUDIO_LAYOUT_RE = /,\s*(mono|stereo|[0-9]\.[0-9](?:\([^)]*\))?|quad|downmix)\b/;

function parseStreams(output: string): {
  audio: StreamTrack[];
  subtitle: StreamTrack[];
  video: StreamTrack[];
} {
  const audio: StreamTrack[] = [];
  const subtitle: StreamTrack[] = [];
  const video: StreamTrack[] = [];
  let current: StreamTrack | null = null;

  for (const line of output.split(/\r?\n/)) {
    const match = STREAM_RE.exec(line);

    if (match) {
      const [, indexText, language, kind, codec, rest = ""] = match;
      const bucket = kind === "Audio" ? audio : kind === "Subtitle" ? subtitle : video;

      current = {
        index: Number(indexText),
        typeIndex: bucket.length,
        codec: (codec ?? "").toLowerCase(),
        language: language ? language.toLowerCase() : null,
        title: null,
        layout: kind === "Audio" ? (AUDIO_LAYOUT_RE.exec(rest)?.[1] ?? null) : null,
        default: /\(default\)/.test(rest),
        forced: /\(forced\)/.test(rest),
      };

      bucket.push(current);
      continue;
    }

    if (current) {
      const title = METADATA_TITLE_RE.exec(line);
      if (title?.[1]) {
        current.title = title[1];
        continue;
      }

      if (line.trim() && !line.startsWith("    ")) current = null;
    }
  }

  return { audio, subtitle, video };
}

export function probe(url: string, timeoutMs = 20_000): Promise<MediaInfo> {
  return new Promise((resolve) => {
    const child = spawn(ffmpegPath(), ["-hide_banner", "-user_agent", USER_AGENT, "-i", url]);

    let output = "";
    const timer = setTimeout(() => child.kill(), timeoutMs);

    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    const finish = () => {
      clearTimeout(timer);
      const duration = DURATION_RE.exec(output);
      const { audio, subtitle, video } = parseStreams(output);

      resolve({
        videoCodec: video[0]?.codec ?? null,
        audioCodec: audio[0]?.codec ?? null,
        durationSecs: duration
          ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3])
          : null,
        hasVideo: video.length > 0,
        audioTracks: audio,
        subtitleTracks: subtitle,
      });
    };

    child.on("close", finish);
    child.on("error", finish);
  });
}

const TEXT_SUBTITLE = new Set(["subrip", "srt", "ass", "ssa", "mov_text", "webvtt", "text"]);

export function isTextSubtitle(codec: string): boolean {
  return TEXT_SUBTITLE.has(codec.toLowerCase());
}

export interface TranscodePlan {
  videoAction: "copy" | "encode";
  audioAction: "copy" | "encode";
  info: MediaInfo;

  audioIndex: number | null;

  subtitleIndex: number | null;

  subtitleTypeIndex: number | null;

  burnSubtitle: boolean;
}

export function planFor(
  info: MediaInfo,
  audioIndex: number | null = null,
  subtitleIndex: number | null = null,
): TranscodePlan {
  const audio =
    (audioIndex !== null ? info.audioTracks.find((t) => t.index === audioIndex) : null) ??
    info.audioTracks[0] ??
    null;

  const subtitle =
    subtitleIndex !== null
      ? (info.subtitleTracks.find((t) => t.index === subtitleIndex) ?? null)
      : null;

  const burnSubtitle = subtitle !== null && !isTextSubtitle(subtitle.codec);
  const videoPlayable = Boolean(info.videoCodec && BROWSER_VIDEO.has(info.videoCodec));

  return {
    videoAction: videoPlayable && !burnSubtitle ? "copy" : "encode",
    audioAction: audio && BROWSER_AUDIO.has(audio.codec) ? "copy" : "encode",
    info,
    audioIndex: audio?.index ?? null,
    subtitleIndex: subtitle?.index ?? null,
    subtitleTypeIndex: subtitle?.typeIndex ?? null,
    burnSubtitle,
  };
}

const ENCODER_CANDIDATES = ["h264_nvenc", "h264_qsv", "h264_amf", "libx264"] as const;

let cachedEncoder: string | null = null;

function testEncoder(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(ffmpegPath(), [
      "-hide_banner",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=640x360:rate=25",
      "-frames:v",
      "5",
      "-c:v",
      name,
      "-f",
      "null",
      "-",
    ]);
    const timer = setTimeout(() => child.kill(), 15_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

export async function detectVideoEncoder(): Promise<string> {
  if (cachedEncoder) return cachedEncoder;

  for (const candidate of ENCODER_CANDIDATES) {
    if (await testEncoder(candidate)) {
      cachedEncoder = candidate;
      console.info(`[transcode] video kodlayıcı: ${candidate}`);
      return candidate;
    }
  }

  cachedEncoder = "libx264";
  return cachedEncoder;
}

function videoEncodeArgs(encoder: string): string[] {
  switch (encoder) {
    case "h264_nvenc":
      return ["-c:v", "h264_nvenc", "-preset", "p4", "-rc", "vbr", "-cq", "24", "-b:v", "0"];
    case "h264_qsv":
      return ["-c:v", "h264_qsv", "-global_quality", "24"];
    case "h264_amf":
      return [
        "-c:v",
        "h264_amf",
        "-quality",
        "balanced",
        "-rc",
        "cqp",
        "-qp_i",
        "24",
        "-qp_p",
        "26",
      ];
    default:
      return ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23"];
  }
}

function buildArgs(url: string, plan: TranscodePlan, startSecs: number, encoder: string): string[] {
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-user_agent",
    USER_AGENT,

    "-reconnect",
    "1",
    "-reconnect_streamed",
    "1",
    "-reconnect_delay_max",
    "5",
  ];

  if (startSecs > 0) args.push("-ss", String(Math.max(0, Math.floor(startSecs))));

  args.push("-i", url);

  if (plan.burnSubtitle && plan.subtitleTypeIndex !== null) {
    args.push(
      "-filter_complex",
      `[0:v:0][0:s:${plan.subtitleTypeIndex}]overlay[vout]`,
      "-map",
      "[vout]",
    );
  } else if (plan.info.hasVideo) {
    args.push("-map", "0:v:0?");
  }

  if (plan.audioIndex !== null) {
    args.push("-map", `0:${plan.audioIndex}?`);
  } else {
    args.push("-map", "0:a:0?");
  }

  if (plan.videoAction === "copy") {
    args.push("-c:v", "copy");
  } else {
    args.push(...videoEncodeArgs(encoder));

    args.push("-pix_fmt", "yuv420p");
  }

  if (plan.audioAction === "copy") {
    args.push("-c:a", "copy");
  } else {
    args.push("-c:a", "aac", "-b:a", "192k", "-ac", "2");

    args.push("-af", "aresample=async=1:first_pts=0");
  }

  args.push(
    "-sn", // subtitles cannot be muxed into fMP4 this way

    "-avoid_negative_ts",
    "make_zero",

    "-max_interleave_delta",
    "0",
    "-f",
    "mp4",

    "-movflags",
    "frag_keyframe+empty_moov+default_base_moof+omit_tfhd_offset",
    "pipe:1",
  );

  if (!plan.burnSubtitle && plan.subtitleIndex !== null) {
    args.push("-map", `0:${plan.subtitleIndex}?`, "-c:s", "webvtt", "-f", "webvtt", "pipe:3");
  }

  return args;
}

interface Session {
  id: string;
  url: string;
  info: MediaInfo;
  child: ChildProcess | null;

  vtt: string;

  vttGeneration: number;
}

const sessions = new Map<string, Session>();

/**
 * Injected rather than imported, because the download module already imports
 * this one and a cycle between them would be worse than a setter.
 */
let resolveLocalFile: (id: string) => string | null = () => null;

export function setLocalFileResolver(resolver: (id: string) => string | null): void {
  resolveLocalFile = resolver;
}

export function localFileUrl(id: string): string {
  return `http://127.0.0.1:${port}/local/${id}?token=${token}`;
}

let server: Server | null = null;
let port = 0;
let token = "";

function stopChild(session: Session): void {
  if (!session.child) return;
  session.child.kill("SIGKILL");
  session.child = null;
}

export async function startTranscodeServer(): Promise<void> {
  if (server) return;

  token = randomBytes(24).toString("hex");

  server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (url.searchParams.get("token") !== token) {
      response.writeHead(403).end();
      return;
    }

    /**
     * A completed download, played straight from disk.
     *
     * Range requests are honoured because the media element issues them to
     * seek; answering the whole file every time would make scrubbing a large
     * film unusable.
     */
    if (url.pathname.startsWith("/local/")) {
      const file = resolveLocalFile(url.pathname.replace(/^\/local\//, ""));
      if (!file) {
        response.writeHead(404).end();
        return;
      }

      const total = statSync(file).size;
      const range = /bytes=(\d*)-(\d*)/.exec(request.headers.range ?? "");
      const start = range?.[1] ? Number(range[1]) : 0;
      const end = range?.[2] ? Number(range[2]) : total - 1;

      if (start >= total || end >= total || start > end) {
        response.writeHead(416, { "Content-Range": `bytes */${total}` }).end();
        return;
      }

      response.writeHead(range ? 206 : 200, {
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        ...(range ? { "Content-Range": `bytes ${start}-${end}/${total}` } : {}),
      });

      createReadStream(file, { start, end }).pipe(response);
      return;
    }

    if (url.pathname.startsWith("/subs/")) {
      const session = sessions.get(url.pathname.replace(/^\/subs\//, ""));
      if (!session) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, {
        "Content-Type": "text/vtt; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Subtitle-Generation": String(session.vttGeneration),
      });
      response.end(session.vtt || "WEBVTT\n\n");
      return;
    }

    const sessionId = url.pathname.replace(/^\/stream\//, "");
    const session = sessions.get(sessionId);
    if (!session) {
      response.writeHead(404).end();
      return;
    }

    const startSecs = Number(url.searchParams.get("t") ?? "0") || 0;
    const audioParam = url.searchParams.get("a");
    const subtitleParam = url.searchParams.get("s");
    const audioIndex = audioParam !== null && audioParam !== "" ? Number(audioParam) : null;
    const subtitleIndex =
      subtitleParam !== null && subtitleParam !== "" ? Number(subtitleParam) : null;

    const plan = planFor(
      session.info,
      Number.isFinite(audioIndex) ? audioIndex : null,
      Number.isFinite(subtitleIndex) ? subtitleIndex : null,
    );

    stopChild(session);

    const wantsTextSubtitle = !plan.burnSubtitle && plan.subtitleIndex !== null;
    session.vtt = "";
    session.vttGeneration += 1;
    const generation = session.vttGeneration;

    const child = spawn(
      ffmpegPath(),
      buildArgs(session.url, plan, startSecs, cachedEncoder ?? "libx264"),

      {
        stdio: wantsTextSubtitle ? ["ignore", "pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
      },
    );
    session.child = child;

    response.writeHead(200, {
      "Content-Type": "video/mp4",
      "Cache-Control": "no-store",
      Connection: "close",
    });

    child.stdout?.pipe(response);

    if (wantsTextSubtitle) {
      const subtitleStream = child.stdio[3] as NodeJS.ReadableStream | undefined;

      subtitleStream?.on("data", (chunk: Buffer) => {
        if (session.vttGeneration !== generation) return;
        session.vtt += chunk.toString("utf8");
      });
    }

    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) console.warn(`[ffmpeg:${sessionId}] ${text.slice(0, 300)}`);
    });

    const cleanup = () => {
      if (session.child === child) stopChild(session);
    };

    request.on("close", cleanup);
    child.on("close", () => response.end());
  });

  await new Promise<void>((resolve) => {
    server?.listen(0, "127.0.0.1", () => {
      const address = server?.address();
      port = typeof address === "object" && address ? address.port : 0;
      resolve();
    });
  });
}

export interface TrackInfo {
  index: number;
  codec: string;
  language: string | null;
  title: string | null;
  layout: string | null;
  default: boolean;
  forced: boolean;

  textBased: boolean;
}

export interface TranscodeSessionInfo {
  url: string;

  subtitleUrl: string;
  videoAction: "copy" | "encode";
  audioAction: "copy" | "encode";
  videoCodec: string | null;
  audioCodec: string | null;
  durationSecs: number | null;
  audioTracks: TrackInfo[];
  subtitleTracks: TrackInfo[];
}

function toTrackInfo(track: StreamTrack, isSubtitle: boolean): TrackInfo {
  return {
    index: track.index,
    codec: track.codec,
    language: track.language,
    title: track.title,
    layout: track.layout,
    default: track.default,
    forced: track.forced,
    textBased: isSubtitle ? isTextSubtitle(track.codec) : true,
  };
}

export async function createTranscodeSession(sourceUrl: string): Promise<TranscodeSessionInfo> {
  await startTranscodeServer();

  const [info] = await Promise.all([probe(sourceUrl), detectVideoEncoder()]);
  const plan = planFor(info);
  const id = randomBytes(8).toString("hex");

  sessions.set(id, { id, url: sourceUrl, info, child: null, vtt: "", vttGeneration: 0 });

  return {
    url: `http://127.0.0.1:${port}/stream/${id}?token=${token}`,
    subtitleUrl: `http://127.0.0.1:${port}/subs/${id}?token=${token}`,
    videoAction: plan.videoAction,
    audioAction: plan.audioAction,
    videoCodec: info.videoCodec,
    audioCodec: info.audioCodec,
    durationSecs: info.durationSecs,
    audioTracks: info.audioTracks.map((track) => toTrackInfo(track, false)),
    subtitleTracks: info.subtitleTracks.map((track) => toTrackInfo(track, true)),
  };
}

export function stopTranscodeSession(sessionUrl: string): void {
  const id = /\/stream\/([a-f0-9]+)/.exec(sessionUrl)?.[1];
  if (!id) return;
  const session = sessions.get(id);
  if (!session) return;
  stopChild(session);
  sessions.delete(id);
}

export function shutdownTranscodeServer(): void {
  for (const session of sessions.values()) stopChild(session);
  sessions.clear();
  server?.close();
  server = null;
}
