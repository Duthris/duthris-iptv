import { app, dialog } from "electron";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * A rolling log of what the main process did.
 *
 * Console output is not reachable from a packaged Windows build — the process
 * has no console attached — so anything worth diagnosing later has to be
 * written down. Kept to a single file that is truncated when it grows past a
 * sensible size, since this exists for "what happened just now", not history.
 */
const MAX_BYTES = 512 * 1024;

let logPath: string | null = null;
let queue: Promise<void> = Promise.resolve();

function file(): string {
  if (!logPath) logPath = join(app.getPath("userData"), "logs", "main.log");
  return logPath;
}

export async function initLogs(): Promise<void> {
  const target = file();
  await mkdir(join(target, ".."), { recursive: true });

  // Start each run with a marker so a support file shows session boundaries.
  record(`--- ${app.getName()} ${app.getVersion()} started ${new Date().toISOString()} ---`);
}

/**
 * Appends a line. Writes are chained rather than awaited by callers: logging
 * must never be able to delay or fail the thing it is describing.
 */
export function record(message: string): void {
  const line = `${new Date().toISOString()} ${message}\n`;
  queue = queue
    .then(async () => {
      const target = file();
      if (existsSync(target)) {
        const contents = await readFile(target, "utf8");
        if (contents.length > MAX_BYTES) {
          const { writeFile } = await import("node:fs/promises");
          await writeFile(target, contents.slice(-MAX_BYTES / 2), "utf8");
        }
      }
      await appendFile(target, line, "utf8");
    })
    .catch(() => undefined);
}

export function logDirectory(): string {
  return join(app.getPath("userData"), "logs");
}

/** Copies the log somewhere the user chooses. Returns the path, or null. */
export async function exportLogs(): Promise<string | null> {
  const target = file();
  if (!existsSync(target)) return null;

  const stamp = new Date().toISOString().slice(0, 10);
  const result = await dialog.showSaveDialog({
    title: "Günlükleri kaydet",
    defaultPath: `duthris-iptv-gunluk-${stamp}.log`,
    filters: [{ name: "Günlük", extensions: ["log", "txt"] }],
  });

  if (result.canceled || !result.filePath) return null;

  const { copyFile } = await import("node:fs/promises");
  await copyFile(target, result.filePath);
  return result.filePath;
}
