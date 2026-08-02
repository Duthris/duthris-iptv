import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { app, BrowserWindow } from "electron";

import { IPC, type DownloadEntry, type StartDownloadRequest } from "../shared/ipc.js";
import { ffmpegPath, probe, planFor, detectVideoEncoder } from "./transcode.js";

/**
 * Offline copies.
 *
 * The source is converted to a plain MP4 rather than saved as-is: two thirds of
 * this catalog is MKV, which the player could not open without ffmpeg running,
 * and paying that cost once at download time means the offline copy plays with
 * nothing else involved. Video is copied whenever the browser can decode it, so
 * the usual cost is the audio track alone.
 *
 * Metadata lives in a JSON file beside each download. The filesystem is the
 * source of truth — a database row describing a file that is no longer there
 * would be worse than no record at all.
 */
const active = new Map<string, ChildProcess>();

/**
 * In-flight entries, kept in memory.
 *
 * Progress is not written to the sidecar on every tick — that would be a disk
 * write several times a second for hours. So a listing has to read the live
 * value from here, or a screen opened mid-download would show 0% until the
 * next progress event happened to arrive.
 */
const live = new Map<string, DownloadEntry>();

let getWindow: () => BrowserWindow | null = () => null;

function root(): string {
  return join(app.getPath("userData"), "downloads");
}

function paths(id: string) {
  return { media: join(root(), `${id}.mp4`), meta: join(root(), `${id}.json`) };
}

function emit(entry: DownloadEntry): void {
  getWindow()?.webContents.send(IPC.downloadEvent, entry);
}

async function writeMeta(entry: DownloadEntry): Promise<void> {
  await writeFile(paths(entry.id).meta, JSON.stringify(entry), "utf8");
}

export async function listDownloads(): Promise<DownloadEntry[]> {
  await mkdir(root(), { recursive: true });
  const files = await readdir(root());
  const entries: DownloadEntry[] = [];

  for (const name of files) {
    if (!name.endsWith(".json")) continue;
    try {
      const stored = JSON.parse(await readFile(join(root(), name), "utf8")) as DownloadEntry;

      // A running download knows its own progress; the sidecar does not.
      const running = live.get(stored.id);
      if (running) {
        entries.push({ ...running });
        continue;
      }

      const entry = stored;
      const { media } = paths(entry.id);

      if (entry.status === "done") {
        // A completed entry whose file has gone is not a download any more.
        if (!existsSync(media)) continue;
        entry.bytes = statSync(media).size;
      } else if (!active.has(entry.id)) {
        // Interrupted by a crash or a quit; nothing is resuming it.
        entry.status = "failed";
        entry.error = entry.error ?? "İndirme yarıda kesildi";
      }

      entries.push(entry);
    } catch {
      // Unreadable sidecar; skip rather than fail the whole listing.
    }
  }

  return entries.sort((a, b) => b.startedAt - a.startedAt);
}

/** `size=  12345kB time=00:01:23.45 bitrate=...` on ffmpeg's progress lines. */
const TIME_RE = /time=(\d+):(\d+):(\d+)\.(\d+)/;

export async function startDownload(request: StartDownloadRequest): Promise<DownloadEntry> {
  await mkdir(root(), { recursive: true });

  const info = await probe(request.url);
  const plan = planFor(info);
  const encoder = await detectVideoEncoder();
  const { media } = paths(request.id);

  const entry: DownloadEntry = {
    id: request.id,
    title: request.title,
    poster: request.poster ?? null,
    kind: request.kind,
    itemId: request.itemId,
    status: "downloading",
    progress: 0,
    durationSecs: info.durationSecs,
    bytes: 0,
    startedAt: Date.now(),
    error: null,
  };
  await writeMeta(entry);
  live.set(entry.id, entry);
  emit(entry);

  const args = [
    "-hide_banner",
    "-loglevel", "error",
    "-stats",
    "-user_agent", "VLC/3.0.20 LibVLC/3.0.20",
    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_delay_max", "5",
    "-i", request.url,
    "-map", "0:v:0?",
    "-map", "0:a:0?",
    ...(plan.videoAction === "copy"
      ? ["-c:v", "copy"]
      : [...(encoder === "libx264" ? ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23"] : ["-c:v", encoder]), "-pix_fmt", "yuv420p"]),
    ...(plan.audioAction === "copy" ? ["-c:a", "copy"] : ["-c:a", "aac", "-b:a", "192k", "-ac", "2"]),
    // A regular MP4, not fragmented: this file is played from disk, not streamed.
    "-movflags", "+faststart",
    "-y",
    media,
  ];

  let child: ReturnType<typeof spawn>;
  try {
    child = spawn(ffmpegPath(), args);
  } catch (error) {
    // Missing or unreadable ffmpeg: report it on the entry instead of letting
    // it surface as an unhandled exception in the main process.
    entry.status = "failed";
    entry.error = error instanceof Error ? error.message : "ffmpeg başlatılamadı";
    void writeMeta(entry);
    emit(entry);
    return entry;
  }

  active.set(request.id, child);

  // spawn reports a missing binary asynchronously; without this listener the
  // ENOENT becomes an uncaught exception and Electron shows a crash dialog.
  child.on("error", (error: Error) => {
    active.delete(request.id);
    entry.status = "failed";
    entry.error = error.message;
    void writeMeta(entry);
    emit(entry);
  });

  child.stderr?.on("data", (chunk: Buffer) => {
    const match = TIME_RE.exec(chunk.toString());
    if (!match || !info.durationSecs) return;

    const seconds =
      Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(`0.${match[4]}`);
    const next = Math.min(1, seconds / info.durationSecs);

    // Only report meaningful movement; ffmpeg prints several lines a second.
    if (next - entry.progress < 0.01) return;
    entry.progress = next;
    emit(entry);
  });

  child.on("close", (code, signal) => {
    active.delete(request.id);
    live.delete(request.id);

    // A spawn error already recorded the useful message; close fires after it
    // with a bare exit code that would only make things vaguer.
    if (entry.status === "failed" && entry.error) return;

    if (entry.status === "cancelled") {
      // The sidecar went at cancel time; the half-written file could not until
      // ffmpeg let go of it, which has just happened.
      void rm(media, { force: true });
      emit(entry);
      return;
    }

    if (code === 0 && existsSync(media)) {
      entry.status = "done";
      entry.progress = 1;
      entry.bytes = statSync(media).size;
    } else {
      entry.status = "failed";
      // A killed process reports a signal and a null code, so naming the code
      // alone would print "ffmpeg null ile sonlandı".
      entry.error = signal
        ? `ffmpeg ${signal} ile durduruldu`
        : `ffmpeg ${code} ile sonlandı`;
    }
    void writeMeta(entry);
    emit(entry);
  });

  return entry;
}

/**
 * Giving up on a download leaves no trace.
 *
 * The user asked for it to stop, so a leftover "failed" row would be noise.
 * The sidecar goes now — a refresh right after this call has to see it gone —
 * and the close handler removes the partial file once ffmpeg releases it.
 */
export function cancelDownload(id: string): void {
  const child = active.get(id);
  if (!child) return;

  const entry = live.get(id);
  if (entry) entry.status = "cancelled";

  void rm(paths(id).meta, { force: true });
  child.kill("SIGKILL");
  active.delete(id);
}

export async function removeDownload(id: string): Promise<void> {
  cancelDownload(id);
  const { media, meta } = paths(id);
  await rm(media, { force: true });
  await rm(meta, { force: true });
}

export function downloadMediaPath(id: string): string | null {
  const { media } = paths(id);
  return existsSync(media) ? media : null;
}

export function registerDownloadWindow(windowGetter: () => BrowserWindow | null): void {
  getWindow = windowGetter;
}

/** Kills anything in flight so a quit does not leave an ffmpeg behind. */
export function shutdownDownloads(): void {
  for (const child of active.values()) child.kill("SIGKILL");
  active.clear();
}
