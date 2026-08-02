import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

import type { ExternalPlayer, ExternalPlayerKind, OpenExternalRequest } from "../shared/ipc.js";
import { readCredential } from "./credentials.js";
import { record } from "./logs.js";
import { substituteSecret } from "./xtream.js";

/**
 * Handing playback to mpv or VLC.
 *
 * These players decode everything this catalog contains natively — 10-bit
 * HEVC, DTS, every audio track and embedded subtitle — and they seek instantly
 * because nothing is being converted. For the titles our own player struggles
 * with, that is a better answer than a heavier pipeline.
 *
 * The caller must stop its own playback first: the subscription allows a
 * single connection, so two players wanting the same stream means neither
 * gets it.
 */

import { DEFAULT_USER_AGENT } from "../shared/ipc.js";

function candidatePaths(): Array<{ kind: ExternalPlayerKind; path: string }> {
  const programFiles = process.env["ProgramFiles"] ?? "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const localAppData = process.env["LOCALAPPDATA"] ?? "";
  const home = process.env["USERPROFILE"] ?? "";
  const programData = process.env["ProgramData"] ?? "C:\\ProgramData";

  return [
    { kind: "mpv", path: join(programFiles, "mpv", "mpv.exe") },
    { kind: "mpv", path: join(localAppData, "Programs", "mpv", "mpv.exe") },
    // scoop and chocolatey are how mpv usually arrives on Windows; it has no
    // installer of its own.
    { kind: "mpv", path: join(home, "scoop", "apps", "mpv", "current", "mpv.exe") },
    { kind: "mpv", path: join(programData, "chocolatey", "bin", "mpv.exe") },
    { kind: "vlc", path: join(programFiles, "VideoLAN", "VLC", "vlc.exe") },
    { kind: "vlc", path: join(programFilesX86, "VideoLAN", "VLC", "vlc.exe") },
  ];
}

const LABELS: Record<ExternalPlayerKind, string> = { mpv: "mpv", vlc: "VLC" };

export function listExternalPlayers(): ExternalPlayer[] {
  const found: ExternalPlayer[] = [];
  const seen = new Set<string>();

  for (const candidate of candidatePaths()) {
    const key = candidate.path.toLowerCase();
    if (seen.has(key) || !existsSync(candidate.path)) continue;
    seen.add(key);
    found.push({ kind: candidate.kind, name: LABELS[candidate.kind], path: candidate.path });
  }

  return found;
}

/** A path the user picked themselves; the kind decides which flags it gets. */
export function describeExternalPlayer(path: string): ExternalPlayer | null {
  if (!existsSync(path)) return null;

  const lower = path.toLowerCase();
  const kind: ExternalPlayerKind = lower.includes("vlc") ? "vlc" : "mpv";
  return { kind, name: LABELS[kind], path };
}

function argsFor(
  player: ExternalPlayer,
  url: string,
  startSecs: number,
  title: string,
  userAgent: string,
): string[] {
  if (player.kind === "vlc") {
    return [
      `--http-user-agent=${userAgent}`,
      ...(startSecs > 0 ? [`--start-time=${Math.floor(startSecs)}`] : []),
      `--meta-title=${title}`,
      url,
    ];
  }

  return [
    `--user-agent=${userAgent}`,
    ...(startSecs > 0 ? [`--start=${Math.floor(startSecs)}`] : []),
    `--force-media-title=${title}`,
    url,
  ];
}

export function openInExternalPlayer(request: OpenExternalRequest): { ok: boolean; message?: string } {
  const player = describeExternalPlayer(request.playerPath);
  if (!player) return { ok: false, message: "Seçilen oynatıcı bulunamadı" };

  let url = request.urlTemplate;

  if (request.credentialRef) {
    const secret = readCredential(request.credentialRef);
    if (secret === null) return { ok: false, message: "Kaynağın giriş bilgileri okunamadı" };
    url = substituteSecret(url, secret);
  }

  try {
    // Detached so the player outlives this app; without unref a quit here
    // would take the user's film with it.
    const child = spawn(
      player.path,
      argsFor(
        player,
        url,
        request.startSecs ?? 0,
        request.title,
        request.userAgent?.trim() || DEFAULT_USER_AGENT,
      ),
      { detached: true, stdio: "ignore" },
    );

    child.on("error", (error) => record(`[external] başlatılamadı: ${error.message}`));
    child.unref();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Oynatıcı başlatılamadı";
    record(`[external] ${message}`);
    return { ok: false, message };
  }
}
