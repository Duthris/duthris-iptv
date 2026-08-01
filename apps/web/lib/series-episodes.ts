"use client";

import { XtreamClient, parseXtreamCredentials, withRequestQueue, type Episode } from "@iptv/core";
import { getSeriesItem, getSource, listEpisodes, readCredential, saveEpisodes } from "@iptv/db";

import { getHttpClient } from "./http";

const pending = new Map<string, Promise<Episode[]>>();

export async function ensureEpisodes(
  seriesItemId: string,
  options: { forceRefresh?: boolean } = {},
): Promise<Episode[]> {
  if (!options.forceRefresh) {
    const cached = await listEpisodes(seriesItemId);
    if (cached.length > 0) return cached;

    const running = pending.get(seriesItemId);
    if (running) return running;
  }

  const task = fetchEpisodes(seriesItemId);
  pending.set(seriesItemId, task);

  try {
    return await task;
  } finally {
    pending.delete(seriesItemId);
  }
}

async function fetchEpisodes(seriesItemId: string): Promise<Episode[]> {
  const series = await getSeriesItem(seriesItemId);
  if (!series || series.seriesId === null) return [];

  const source = await getSource(series.sourceId);
  if (!source || source.kind !== "xtream" || !source.username) return [];

  const password = await readCredential(source.credentialRef);
  if (!password) {
    throw new Error("Kaynağın giriş bilgileri okunamadı");
  }

  const credentials = parseXtreamCredentials(source.url, {
    username: source.username,
    password,
  });

  const client = new XtreamClient(withRequestQueue(getHttpClient()), credentials);
  const episodes = await client.getSeriesEpisodes(series.seriesId, seriesItemId, series.sourceId);

  await saveEpisodes(seriesItemId, episodes);
  return episodes;
}

export interface SeasonGroup {
  season: number;
  episodes: Episode[];
}

export function groupBySeason(episodes: Episode[]): SeasonGroup[] {
  const map = new Map<number, Episode[]>();
  for (const episode of episodes) {
    const list = map.get(episode.season);
    if (list) list.push(episode);
    else map.set(episode.season, [episode]);
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([season, list]) => ({
      season,
      episodes: list.sort((a, b) => a.episode - b.episode),
    }));
}
