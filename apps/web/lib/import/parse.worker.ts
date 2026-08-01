import {
  XtreamClient,
  createHttpClient,
  matchChannelsToEpg,
  parseM3U,
  parseXMLTV,
  withRequestQueue,
  type ParseProgress,
  type ParsedPlaylist,
  type SourceStats,
} from "@iptv/core";
import {
  getMappingsByChannelId,
  listLiveChannels,
  replaceCatalog,
  replaceEpg,
  saveMappings,
} from "@iptv/db";

import type { ImportRequest, ImportResponse } from "./protocol";

const ctx = self as unknown as DedicatedWorkerGlobalScope;

const PROXY_PATH = "/api/proxy";

const http = createHttpClient({
  proxyUrlFor: (url) => `${PROXY_PATH}?url=${encodeURIComponent(url)}`,
});

const xtreamHttp = withRequestQueue(http, { minIntervalMs: 900, maxRetries: 3 });

function reply(message: ImportResponse): void {
  ctx.postMessage(message);
}

function progressReporter(requestId: string) {
  let lastSentAt = 0;
  return (progress: ParseProgress) => {
    const now = Date.now();
    if (now - lastSentAt < 50 && progress.ratio !== 1) return;
    lastSentAt = now;
    reply({ type: "progress", requestId, progress });
  };
}

function statsFor(playlist: ParsedPlaylist): SourceStats {
  return {
    liveCount: playlist.live.length,
    vodCount: playlist.vod.length,
    seriesCount: playlist.series.length,
    categoryCount: playlist.categories.length,
    epgProgramCount: 0,
  };
}

async function handleM3UText(requestId: string, sourceId: string, text: string): Promise<void> {
  const onProgress = progressReporter(requestId);

  onProgress({
    phase: "parse",
    ratio: 0,
    processed: 0,
    total: null,
    label: "Playlist okunuyor",
  });

  const playlist = parseM3U(text, { sourceId, onProgress });
  await replaceCatalog(sourceId, playlist, { onProgress });

  reply({
    type: "done",
    requestId,
    stats: statsFor(playlist),
    warnings: [],
    epgUrl: playlist.epgUrl,
    streamEndpoints: null,
  });
}

async function handleM3UUrl(requestId: string, sourceId: string, url: string): Promise<void> {
  const onProgress = progressReporter(requestId);

  const text = await http.text(url, {
    onProgress: (loaded, total) => {
      onProgress({
        phase: "download",
        ratio: total ? loaded / total : null,
        processed: loaded,
        total,
        label: total
          ? `İndiriliyor — ${(loaded / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB`
          : `İndiriliyor — ${(loaded / 1024 / 1024).toFixed(1)} MB`,
      });
    },
  });

  if (!text.includes("#EXTINF") && !text.includes("#EXTM3U")) {
    throw new Error(
      "Adres bir M3U playlist'i döndürmedi. Bağlantının doğru ve aboneliğin aktif olduğundan emin olun.",
    );
  }

  await handleM3UText(requestId, sourceId, text);
}

async function handleXtream(request: Extract<ImportRequest, { type: "import-xtream" }>) {
  const { requestId, sourceId, baseUrl, username, password } = request;
  const onProgress = progressReporter(requestId);

  const client = new XtreamClient(xtreamHttp, { baseUrl, username, password });

  onProgress({
    phase: "download",
    ratio: null,
    processed: 0,
    total: null,
    label: "Sunucuya bağlanılıyor",
  });

  const account = await client.authenticate();

  const { playlist, stats, warnings } = await client.fetchCatalog(sourceId, { onProgress });
  await replaceCatalog(sourceId, playlist, { onProgress });

  if (account.maxConnections === 1 && account.activeConnections >= 1) {
    warnings.push(
      "Hesabınız tek eşzamanlı bağlantıya izin veriyor ve şu anda başka bir cihaz bağlı görünüyor.",
    );
  }

  reply({
    type: "done",
    requestId,
    stats,
    warnings,
    epgUrl: playlist.epgUrl,
    streamEndpoints: account.endpoints,
    subscription: {
      status: account.status,
      isTrial: account.isTrial,
      expiresAt: account.expiresAt,
      maxConnections: account.maxConnections,
      activeConnections: account.activeConnections,
      checkedAt: Date.now(),
    },
  });
}

async function handleEpg(requestId: string, sourceId: string, epgUrl: string): Promise<void> {
  const onProgress = progressReporter(requestId);

  const xml = await http.text(epgUrl, {
    onProgress: (loaded, total) => {
      onProgress({
        phase: "download",
        ratio: total ? loaded / total : null,
        processed: loaded,
        total,
        label: `EPG indiriliyor — ${(loaded / 1024 / 1024).toFixed(1)} MB`,
      });
    },
  });

  if (!xml.includes("<programme") && !xml.includes("<tv")) {
    throw new Error("Adres bir XMLTV rehberi döndürmedi.");
  }

  const parsed = parseXMLTV(xml, { epgSourceId: sourceId, onProgress });
  await replaceEpg(sourceId, parsed, onProgress);

  onProgress({
    phase: "normalize",
    ratio: null,
    processed: 0,
    total: null,
    label: "Kanallar rehberle eşleştiriliyor",
  });

  const existing = await getMappingsByChannelId();
  const manual: Record<string, string> = {};
  for (const [channelId, channelKey] of existing) manual[channelId] = channelKey;

  const channels = await listLiveChannels({ sourceIds: [sourceId] });
  const report = matchChannelsToEpg(
    channels.map((channel) => ({
      id: channel.id,
      tvgId: channel.tvgId,
      name: channel.name,
    })),
    parsed.channels,
    manual,
  );

  await saveMappings(report.mappings.map((mapping) => ({ ...mapping, epgSourceId: sourceId })));

  reply({
    type: "epg-done",
    requestId,
    result: {
      programCount: parsed.programs.length,
      epgChannelCount: parsed.channels.length,
      matchedChannels: report.matched,
      unmatchedChannels: report.unmatched,
    },
  });
}

ctx.addEventListener("message", (event: MessageEvent<ImportRequest>) => {
  const request = event.data;

  void (async () => {
    try {
      switch (request.type) {
        case "import-m3u-text":
          await handleM3UText(request.requestId, request.sourceId, request.text);
          break;
        case "import-m3u-url":
          await handleM3UUrl(request.requestId, request.sourceId, request.url);
          break;
        case "import-xtream":
          await handleXtream(request);
          break;
        case "import-epg":
          await handleEpg(request.requestId, request.sourceId, request.epgUrl);
          break;
        default:
          throw new Error("Bilinmeyen istek türü");
      }
    } catch (error) {
      reply({
        type: "error",
        requestId: request.requestId,
        message: error instanceof Error ? error.message : "Bilinmeyen hata",
      });
    }
  })();
});
