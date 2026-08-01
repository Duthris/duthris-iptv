"use client";

import {
  createId,
  type ParseProgress,
  type SourceStats,
  type SourceSubscription,
  type StreamEndpoints,
  type StreamFormat,
} from "@iptv/core";
import {
  createSource,
  deleteSource,
  markSourceError,
  markSourceSuccess,
  readCredential,
  updateSource,
  type CreateSourceInput,
} from "@iptv/db";

import type { EpgImportResult, ImportJob, ImportRequest, ImportResponse } from "./protocol";

export interface ImportCallbacks {
  onProgress?: (progress: ParseProgress) => void;
  onSourceCreated?: (sourceId: string) => void;
}

export interface ImportResult {
  sourceId: string;
  stats: SourceStats;
  warnings: string[];
}

function createWorker(): Worker {
  return new Worker(new URL("./parse.worker.ts", import.meta.url), {
    type: "module",
    name: "iptv-import",
  });
}

function runImport(
  request: ImportJob,
  callbacks: ImportCallbacks,
): Promise<{
  stats: SourceStats;
  warnings: string[];
  epgUrl: string | null;
  streamEndpoints: StreamEndpoints | null;
  subscription: SourceSubscription | null;
}> {
  return new Promise((resolve, reject) => {
    const requestId = createId("imp");
    const worker = createWorker();

    const cleanup = () => {
      worker.terminate();
    };

    worker.addEventListener("message", (event: MessageEvent<ImportResponse>) => {
      const message = event.data;
      if (message.requestId !== requestId) return;

      switch (message.type) {
        case "progress":
          callbacks.onProgress?.(message.progress);
          break;
        case "done":
          cleanup();
          resolve({
            stats: message.stats,
            warnings: message.warnings,
            epgUrl: message.epgUrl,
            streamEndpoints: message.streamEndpoints,
            subscription: message.subscription ?? null,
          });
          break;
        case "error":
          cleanup();
          reject(new Error(message.message));
          break;
      }
    });

    worker.addEventListener("error", (event) => {
      cleanup();
      reject(new Error(event.message || "İçe aktarma işlemi beklenmedik şekilde durdu"));
    });

    worker.postMessage({ ...request, requestId } as ImportRequest);
  });
}

async function withSource(
  input: CreateSourceInput,
  build: (sourceId: string) => ImportJob,
  callbacks: ImportCallbacks,
): Promise<ImportResult> {
  const source = await createSource(input);
  callbacks.onSourceCreated?.(source.id);

  try {
    const { stats, warnings, epgUrl, streamEndpoints, subscription } = await runImport(
      build(source.id),
      callbacks,
    );
    await markSourceSuccess(source.id, stats, streamEndpoints, subscription);
    if (epgUrl && !source.epgUrl) await updateSource(source.id, { epgUrl });
    return { sourceId: source.id, stats, warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";

    await deleteSource(source.id).catch(() => markSourceError(source.id, message));
    throw new Error(message);
  }
}

export function importM3UFile(
  input: { name: string; content: string },
  callbacks: ImportCallbacks = {},
): Promise<ImportResult> {
  return withSource(
    { name: input.name, kind: "m3u-file", url: "" },
    (sourceId) => ({ type: "import-m3u-text", sourceId, text: input.content }),
    callbacks,
  );
}

export function importM3UUrl(
  input: { name: string; url: string },
  callbacks: ImportCallbacks = {},
): Promise<ImportResult> {
  return withSource(
    { name: input.name, kind: "m3u-url", url: input.url },
    (sourceId) => ({ type: "import-m3u-url", sourceId, url: input.url }),
    callbacks,
  );
}

export function importXtream(
  input: {
    name: string;
    baseUrl: string;
    username: string;
    password: string;
    preferredFormat?: StreamFormat;
  },
  callbacks: ImportCallbacks = {},
): Promise<ImportResult> {
  const preferredFormat = input.preferredFormat ?? "m3u8";

  return withSource(
    {
      name: input.name,
      kind: "xtream",
      url: input.baseUrl,
      username: input.username,
      password: input.password,
      preferredFormat,
    },
    (sourceId) => ({
      type: "import-xtream",
      sourceId,
      baseUrl: input.baseUrl,
      username: input.username,
      password: input.password,
      preferredFormat,
    }),
    callbacks,
  );
}

export function importEpg(
  sourceId: string,
  epgUrl: string,
  callbacks: ImportCallbacks = {},
): Promise<EpgImportResult> {
  return new Promise((resolve, reject) => {
    const requestId = createId("epg");
    const worker = createWorker();

    worker.addEventListener("message", (event: MessageEvent<ImportResponse>) => {
      const message = event.data;
      if (message.requestId !== requestId) return;

      if (message.type === "progress") {
        callbacks.onProgress?.(message.progress);
        return;
      }
      if (message.type === "epg-done") {
        worker.terminate();
        resolve(message.result);
        return;
      }
      if (message.type === "error") {
        worker.terminate();
        reject(new Error(message.message));
      }
    });

    worker.addEventListener("error", (event) => {
      worker.terminate();
      reject(new Error(event.message || "EPG alınamadı"));
    });

    worker.postMessage({ type: "import-epg", requestId, sourceId, epgUrl } as ImportRequest);
  });
}

export async function refreshSource(
  sourceId: string,
  callbacks: ImportCallbacks = {},
): Promise<ImportResult> {
  const { getSource } = await import("@iptv/db");
  const source = await getSource(sourceId);
  if (!source) throw new Error("Kaynak bulunamadı");

  let request: ImportJob;

  if (source.kind === "xtream") {
    const password = await readCredential(source.credentialRef);
    if (!source.username || !password) {
      throw new Error("Kaynağın giriş bilgileri eksik — playlist'i yeniden ekleyin");
    }
    request = {
      type: "import-xtream",
      sourceId,
      baseUrl: source.url,
      username: source.username,
      password,
      preferredFormat: source.preferredFormat,
    };
  } else if (source.kind === "m3u-url") {
    request = { type: "import-m3u-url", sourceId, url: source.url };
  } else {
    throw new Error("Dosyadan eklenen playlist'ler yenilenemez — dosyayı yeniden yükleyin");
  }

  try {
    const { stats, warnings, streamEndpoints, subscription } = await runImport(request, callbacks);
    await markSourceSuccess(sourceId, stats, streamEndpoints, subscription);
    return { sourceId, stats, warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    await markSourceError(sourceId, message);
    throw new Error(message);
  }
}
