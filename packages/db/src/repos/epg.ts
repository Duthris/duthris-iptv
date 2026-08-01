import type { EpgProgram, ParsedXmltv, ProgressCallback } from "@iptv/core";
import { getDb, type EpgMapping } from "../schema.js";

const CHUNK_SIZE = 2000;

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function replaceEpg(
  epgSourceId: string,
  parsed: ParsedXmltv,
  onProgress?: ProgressCallback,
): Promise<void> {
  const db = getDb();

  await Promise.all([
    db.epgChannels.where("epgSourceId").equals(epgSourceId).delete(),
    db.epgPrograms.where("epgSourceId").equals(epgSourceId).delete(),
  ]);

  await db.epgChannels.bulkPut(parsed.channels);

  const total = parsed.programs.length;
  for (let i = 0; i < total; i += CHUNK_SIZE) {
    await db.epgPrograms.bulkPut(parsed.programs.slice(i, i + CHUNK_SIZE));
    onProgress?.({
      phase: "store",
      ratio: total > 0 ? Math.min(i + CHUNK_SIZE, total) / total : null,
      processed: Math.min(i + CHUNK_SIZE, total),
      total,
      label: "EPG kaydediliyor",
    });
    await yieldToEventLoop();
  }
}

export async function listEpgChannels(epgSourceId: string) {
  return getDb().epgChannels.where("epgSourceId").equals(epgSourceId).toArray();
}

export async function saveMappings(mappings: EpgMapping[]): Promise<void> {
  await getDb().epgMappings.bulkPut(mappings);
}

export async function getMappingsByChannelId(): Promise<Map<string, string>> {
  const rows = await getDb().epgMappings.toArray();
  return new Map(rows.map((row) => [row.channelId, row.channelKey]));
}

export async function setManualMapping(
  channelId: string,
  channelKey: string,
  epgSourceId: string,
): Promise<void> {
  await getDb().epgMappings.put({ channelId, channelKey, epgSourceId, confidence: "manual" });
}

export async function getNowNext(
  channelKey: string,
  at = Date.now(),
): Promise<{ now: EpgProgram | null; next: EpgProgram | null }> {
  const db = getDb();

  const candidates = await db.epgPrograms
    .where("[channelKey+start]")
    .between([channelKey, at - 12 * 60 * 60 * 1000], [channelKey, at + 12 * 60 * 60 * 1000])
    .toArray();

  candidates.sort((a, b) => a.start - b.start);

  let current: EpgProgram | null = null;
  let upcoming: EpgProgram | null = null;

  for (const program of candidates) {
    if (program.start <= at && program.stop > at) {
      current = program;
    } else if (program.start > at) {
      upcoming = program;
      break;
    }
  }

  return { now: current, next: upcoming };
}

export interface NowNext {
  now: EpgProgram | null;
  next: EpgProgram | null;
}

export async function getNowNextForAll(at = Date.now()): Promise<Map<string, NowNext>> {
  const db = getDb();
  const rows = await db.epgPrograms
    .where("start")
    .between(at - 8 * 60 * 60 * 1000, at + 8 * 60 * 60 * 1000)
    .toArray();

  rows.sort((a, b) => a.start - b.start);

  const result = new Map<string, NowNext>();
  for (const program of rows) {
    const entry = result.get(program.channelKey) ?? { now: null, next: null };

    if (program.start <= at && program.stop > at) {
      entry.now = program;
    } else if (program.start > at && entry.next === null) {
      entry.next = program;
    }

    result.set(program.channelKey, entry);
  }

  return result;
}

export async function getProgramsForChannels(
  channelKeys: string[],
  from: number,
  to: number,
): Promise<Map<string, EpgProgram[]>> {
  if (channelKeys.length === 0) return new Map();

  const wanted = new Set(channelKeys);
  const rows = await getDb()
    .epgPrograms.where("start")
    .between(from - 6 * 60 * 60 * 1000, to)
    .toArray();

  const result = new Map<string, EpgProgram[]>();
  for (const program of rows) {
    if (!wanted.has(program.channelKey)) continue;
    if (program.stop <= from) continue;
    const list = result.get(program.channelKey);
    if (list) list.push(program);
    else result.set(program.channelKey, [program]);
  }

  for (const list of result.values()) list.sort((a, b) => a.start - b.start);
  return result;
}

export async function getProgramsInRange(
  channelKey: string,
  from: number,
  to: number,
): Promise<EpgProgram[]> {
  const rows = await getDb()
    .epgPrograms.where("[channelKey+start]")
    .between([channelKey, from], [channelKey, to])
    .toArray();
  return rows.sort((a, b) => a.start - b.start);
}

export async function countEpgPrograms(epgSourceId: string): Promise<number> {
  return getDb().epgPrograms.where("epgSourceId").equals(epgSourceId).count();
}

export async function pruneOldPrograms(before = Date.now() - 24 * 60 * 60 * 1000): Promise<number> {
  return getDb().epgPrograms.where("start").below(before).delete();
}
