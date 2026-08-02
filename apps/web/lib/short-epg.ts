"use client";

import type { ShortEpgProgramme } from "@iptv/core";
import { getLiveChannel, getSource, type NowNext } from "@iptv/db";

import { createXtreamClient } from "@/lib/xtream-runtime";

/**
 * Now and next from the panel, for channels the XMLTV guide does not cover.
 *
 * Only 994 of the 17.005 channels on the measured account carry an EPG id, so
 * the rest show nothing at all in the guide. The panel will still answer for a
 * single channel, which is enough to fill in what is on the one being watched.
 *
 * Fetched on demand and cached for the session, because each call goes through
 * the same queue as everything else and the account allows one connection.
 */
const TTL_MS = 15 * 60 * 1000;

interface CacheEntry {
  value: NowNext | null;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<NowNext | null>>();

function toNowNext(programmes: ShortEpgProgramme[], channelKey: string): NowNext | null {
  const at = Date.now();
  let now: ShortEpgProgramme | null = null;
  let next: ShortEpgProgramme | null = null;

  for (const programme of programmes) {
    if (programme.start <= at && programme.stop > at) now = programme;
    else if (programme.start > at && (!next || programme.start < next.start)) next = programme;
  }

  if (!now && !next) return null;

  const toProgram = (programme: ShortEpgProgramme, suffix: string) => ({
    id: `short:${channelKey}:${suffix}`,
    epgSourceId: "xtream-short",
    channelKey,
    start: programme.start,
    stop: programme.stop,
    title: programme.title,
    desc: programme.desc,
    category: null,
    icon: null,
    lang: null,
  });

  return {
    now: now ? toProgram(now, "now") : null,
    next: next ? toProgram(next, "next") : null,
  };
}

async function fetchShortEpg(channelId: string): Promise<NowNext | null> {
  const channel = await getLiveChannel(channelId);
  if (!channel || channel.streamId === null) return null;

  const source = await getSource(channel.sourceId);
  if (!source || source.kind !== "xtream" || !source.username) return null;

  // No disk cache here: what is on now changes by the minute. The in-memory
  // TTL above is the only caching this call wants.
  const client = await createXtreamClient(source);
  if (!client) return null;

  const programmes = await client.getChannelProgrammes(channel.streamId, 4);
  return toNowNext(programmes, channelId);
}

/** Never rejects; a missing guide is not worth an error on the player screen. */
export async function loadShortEpg(channelId: string): Promise<NowNext | null> {
  const cached = cache.get(channelId);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.value;

  const inFlight = pending.get(channelId);
  if (inFlight) return inFlight;

  const task = fetchShortEpg(channelId)
    .catch(() => null)
    .then((value) => {
      cache.set(channelId, { value, fetchedAt: Date.now() });
      pending.delete(channelId);
      return value;
    });

  pending.set(channelId, task);
  return task;
}
