"use client";

import {
  TmdbClient,
  cleanTitleForSearch,
  withRequestQueue,
  type TmdbDetails,
  type TmdbKind,
} from "@iptv/core";
import { readTmdbCache, writeTmdbCache } from "@iptv/db";

import { getHttpClient } from "@/lib/http";
import { useSettingsStore } from "@/stores/settings-store";

const BUILD_TIME_TOKEN = process.env["NEXT_PUBLIC_TMDB_TOKEN"] ?? "";

export function resolveTmdbToken(): string | null {
  const { tmdbToken, tmdbEnabled } = useSettingsStore.getState();
  if (!tmdbEnabled) return null;
  const token = tmdbToken.trim() || BUILD_TIME_TOKEN.trim();
  return token || null;
}

export function isTmdbConfigured(): boolean {
  return resolveTmdbToken() !== null;
}

export function hasBuildTimeTmdbToken(): boolean {
  return BUILD_TIME_TOKEN.trim() !== "";
}

let cachedClient: { token: string; client: TmdbClient } | null = null;

function getClient(token: string): TmdbClient {
  if (cachedClient?.token === token) return cachedClient.client;
  const client = new TmdbClient({
    token,
    http: withRequestQueue(getHttpClient(), { minIntervalMs: 120, maxRetries: 2 }),
  });
  cachedClient = { token, client };
  return client;
}

export interface EnrichInput {
  itemId: string;
  kind: TmdbKind;
  title: string;
  year: number | null;

  tmdbId?: number | null;
}

export async function enrich(input: EnrichInput): Promise<TmdbDetails | null> {
  const cached = await readTmdbCache(input.kind, input.itemId);
  if (cached) return cached.details;

  const token = resolveTmdbToken();
  if (!token) return null;

  try {
    const details = await getClient(token).lookup(input.kind, {
      tmdbId: input.tmdbId ?? null,
      title: cleanTitleForSearch(input.title),
      year: input.year,
    });

    await writeTmdbCache(input.kind, input.itemId, details);
    return details;
  } catch {
    return null;
  }
}
