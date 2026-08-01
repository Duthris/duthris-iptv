import { epgMatchKey } from "./text.js";
import type { EpgChannel, LiveChannel } from "./types.js";

export type MatchConfidence = "exact-id" | "loose-id" | "name" | "manual";

export interface ChannelEpgMapping {
  channelId: string;

  channelKey: string;
  confidence: MatchConfidence;
}

export interface EpgMatchReport {
  mappings: ChannelEpgMapping[];
  matched: number;
  unmatched: number;
  byConfidence: Record<MatchConfidence, number>;

  unmatchedChannelIds: string[];
}

export type MatchableChannel = Pick<LiveChannel, "id" | "tvgId" | "name">;

export function matchChannelsToEpg(
  channels: MatchableChannel[],
  epgChannels: EpgChannel[],
  manualOverrides: Record<string, string> = {},
): EpgMatchReport {
  const byExactId = new Map<string, string>();

  const byLooseId = new Map<string, string>();

  const byName = new Map<string, string>();

  for (const epgChannel of epgChannels) {
    const key = epgChannel.channelKey;
    if (!byExactId.has(key)) byExactId.set(key, key);

    const loose = epgMatchKey(key);
    if (loose && !byLooseId.has(loose)) byLooseId.set(loose, key);

    for (const displayName of epgChannel.displayNames) {
      const nameKey = epgMatchKey(displayName);

      if (nameKey && !byName.has(nameKey)) byName.set(nameKey, key);
    }
  }

  const mappings: ChannelEpgMapping[] = [];
  const unmatchedChannelIds: string[] = [];
  const byConfidence: Record<MatchConfidence, number> = {
    "exact-id": 0,
    "loose-id": 0,
    name: 0,
    manual: 0,
  };

  for (const channel of channels) {
    const manual = manualOverrides[channel.id];
    if (manual) {
      mappings.push({ channelId: channel.id, channelKey: manual, confidence: "manual" });
      byConfidence.manual++;
      continue;
    }

    const tvgId = channel.tvgId?.trim().toLowerCase();

    if (tvgId) {
      const exact = byExactId.get(tvgId);
      if (exact) {
        mappings.push({ channelId: channel.id, channelKey: exact, confidence: "exact-id" });
        byConfidence["exact-id"]++;
        continue;
      }

      const loose = byLooseId.get(epgMatchKey(tvgId));
      if (loose) {
        mappings.push({ channelId: channel.id, channelKey: loose, confidence: "loose-id" });
        byConfidence["loose-id"]++;
        continue;
      }
    }

    const nameKey = epgMatchKey(channel.name);
    const byNameMatch = nameKey ? (byName.get(nameKey) ?? byLooseId.get(nameKey)) : undefined;
    if (byNameMatch) {
      mappings.push({ channelId: channel.id, channelKey: byNameMatch, confidence: "name" });
      byConfidence.name++;
      continue;
    }

    unmatchedChannelIds.push(channel.id);
  }

  return {
    mappings,
    matched: mappings.length,
    unmatched: unmatchedChannelIds.length,
    byConfidence,
    unmatchedChannelIds,
  };
}

export function suggestEpgCandidates(
  channel: MatchableChannel,
  epgChannels: EpgChannel[],
  limit = 8,
): Array<{ channelKey: string; label: string; score: number }> {
  const target = epgMatchKey(channel.name);
  if (!target) return [];

  const scored: Array<{ channelKey: string; label: string; score: number }> = [];

  for (const epgChannel of epgChannels) {
    const label = epgChannel.displayNames[0] ?? epgChannel.channelKey;
    const candidate = epgMatchKey(label) || epgMatchKey(epgChannel.channelKey);
    if (!candidate) continue;

    let score = 0;
    if (candidate === target) {
      score = 100;
    } else if (candidate.includes(target) || target.includes(candidate)) {
      score = 70 - Math.abs(candidate.length - target.length);
    } else {
      let common = 0;
      const max = Math.min(candidate.length, target.length);
      while (common < max && candidate.charAt(common) === target.charAt(common)) common++;
      if (common < 3) continue;
      score = common * 5;
    }

    scored.push({ channelKey: epgChannel.channelKey, label, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
