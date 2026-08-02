"use client";

import type { VodInfo } from "@iptv/core";
import { getSource, getVodItem } from "@iptv/db";

import { CATALOG_MAX_AGE_MS, createXtreamClient } from "@/lib/xtream-runtime";

const cache = new Map<string, VodInfo | null>();
const pending = new Map<string, Promise<VodInfo | null>>();

async function fetchVodInfo(movieId: string): Promise<VodInfo | null> {
  const item = await getVodItem(movieId);
  if (!item || item.streamId === null) return null;

  const source = await getSource(item.sourceId);
  if (!source || source.kind !== "xtream" || !source.username) return null;

  const client = await createXtreamClient(source, { maxAgeMs: CATALOG_MAX_AGE_MS });
  if (!client) return null;

  return client.getVodInfo(item.streamId);
}

export async function loadVodInfo(movieId: string): Promise<VodInfo | null> {
  const cached = cache.get(movieId);
  if (cached !== undefined) return cached;

  const inFlight = pending.get(movieId);
  if (inFlight) return inFlight;

  const task = fetchVodInfo(movieId)
    .catch(() => null)
    .then((info) => {
      cache.set(movieId, info);
      pending.delete(movieId);
      return info;
    });

  pending.set(movieId, task);
  return task;
}
