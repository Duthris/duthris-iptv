import { decodeXmlEntities } from "./text.js";
import type { EpgChannel, EpgProgram, ProgressCallback } from "./types.js";

export interface ParseXmltvOptions {
  epgSourceId: string;
  onProgress?: ProgressCallback;

  windowStart?: number;

  windowEnd?: number;
  progressEvery?: number;
}

export interface ParsedXmltv {
  channels: EpgChannel[];
  programs: EpgProgram[];

  skippedOutOfWindow: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PROGRESS_EVERY = 5000;

export function parseXmltvDate(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length < 8) return null;

  const digits = trimmed.slice(0, 14).replace(/\D/g, "");
  if (digits.length < 8) return null;

  const year = Number.parseInt(digits.slice(0, 4), 10);
  const month = Number.parseInt(digits.slice(4, 6), 10);
  const day = Number.parseInt(digits.slice(6, 8), 10);
  const hour = digits.length >= 10 ? Number.parseInt(digits.slice(8, 10), 10) : 0;
  const minute = digits.length >= 12 ? Number.parseInt(digits.slice(10, 12), 10) : 0;
  const second = digits.length >= 14 ? Number.parseInt(digits.slice(12, 14), 10) : 0;

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  let offsetMinutes = 0;
  const offsetMatch = /([+-])(\d{2})(\d{2})\s*$/.exec(trimmed);
  if (offsetMatch) {
    const sign = offsetMatch[1] === "-" ? -1 : 1;
    const hours = Number.parseInt(offsetMatch[2] ?? "0", 10);
    const minutes = Number.parseInt(offsetMatch[3] ?? "0", 10);
    offsetMinutes = sign * (hours * 60 + minutes);
  }

  return Date.UTC(year, month - 1, day, hour, minute, second) - offsetMinutes * 60_000;
}

const TAG_ATTR_RE = /([A-Za-z0-9_:-]+)\s*=\s*"([^"]*)"/g;

function parseTagAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  TAG_ATTR_RE.lastIndex = 0;
  let match = TAG_ATTR_RE.exec(source);
  while (match !== null) {
    const key = match[1];
    const value = match[2];
    if (key && value !== undefined) attrs[key.toLowerCase()] = value;
    match = TAG_ATTR_RE.exec(source);
  }
  return attrs;
}

function firstTag(block: string, tag: string): { text: string; lang: string | null } | null {
  const open = block.indexOf(`<${tag}`);
  if (open === -1) return null;

  const openEnd = block.indexOf(">", open);
  if (openEnd === -1) return null;

  if (block.charAt(openEnd - 1) === "/") {
    return { text: "", lang: null };
  }

  const close = block.indexOf(`</${tag}>`, openEnd);
  if (close === -1) return null;

  const attrs = parseTagAttrs(block.slice(open, openEnd));
  const raw = block.slice(openEnd + 1, close);
  const text = decodeXmlEntities(raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")).trim();

  return { text, lang: attrs["lang"] ?? null };
}

function firstTagAttr(block: string, tag: string, attr: string): string | null {
  const open = block.indexOf(`<${tag}`);
  if (open === -1) return null;
  const openEnd = block.indexOf(">", open);
  if (openEnd === -1) return null;
  return parseTagAttrs(block.slice(open, openEnd))[attr] ?? null;
}

function parseChannels(xml: string, epgSourceId: string): EpgChannel[] {
  const channels: EpgChannel[] = [];
  const seen = new Set<string>();

  let pos = 0;
  for (;;) {
    const start = xml.indexOf("<channel ", pos);
    if (start === -1) break;

    const tagEnd = xml.indexOf(">", start);
    if (tagEnd === -1) break;

    const close = xml.indexOf("</channel>", tagEnd);
    if (close === -1) break;

    const attrs = parseTagAttrs(xml.slice(start, tagEnd));
    const inner = xml.slice(tagEnd + 1, close);
    pos = close + 10;

    const rawId = attrs["id"];

    if (!rawId || !rawId.trim() || rawId.trim() === "0") continue;

    const channelKey = rawId.trim().toLowerCase();
    if (seen.has(channelKey)) continue;
    seen.add(channelKey);

    const displayNames: string[] = [];
    const nameRe = /<display-name[^>]*>([\s\S]*?)<\/display-name>/g;
    let nameMatch = nameRe.exec(inner);
    while (nameMatch !== null) {
      const text = decodeXmlEntities(
        (nameMatch[1] ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"),
      ).trim();
      if (text) displayNames.push(text);
      nameMatch = nameRe.exec(inner);
    }

    channels.push({
      id: `${epgSourceId}:${channelKey}`,
      epgSourceId,
      channelKey,
      displayNames,
      icon: firstTagAttr(inner, "icon", "src"),
    });
  }

  return channels;
}

export function parseXMLTV(xml: string, options: ParseXmltvOptions): ParsedXmltv {
  const {
    epgSourceId,
    onProgress,
    progressEvery = DEFAULT_PROGRESS_EVERY,
    windowStart = Date.now() - DAY_MS,
    windowEnd = Date.now() + 7 * DAY_MS,
  } = options;

  const channels = parseChannels(xml, epgSourceId);
  const programs: EpgProgram[] = [];
  const seenIds = new Set<string>();

  let skippedOutOfWindow = 0;
  let processed = 0;
  let pos = 0;
  const total = xml.length;

  for (;;) {
    const start = xml.indexOf("<programme", pos);
    if (start === -1) break;

    const tagEnd = xml.indexOf(">", start);
    if (tagEnd === -1) break;

    const selfClosing = xml.charAt(tagEnd - 1) === "/";
    const attrs = parseTagAttrs(xml.slice(start, tagEnd));

    let inner = "";
    if (selfClosing) {
      pos = tagEnd + 1;
    } else {
      const close = xml.indexOf("</programme>", tagEnd);
      if (close === -1) break;
      inner = xml.slice(tagEnd + 1, close);
      pos = close + 12;
    }

    processed++;
    if (onProgress && processed % progressEvery === 0) {
      onProgress({
        phase: "parse",
        ratio: total > 0 ? pos / total : null,
        processed,
        total: null,
        label: `${programs.length.toLocaleString("tr-TR")} program işlendi`,
      });
    }

    const rawChannel = attrs["channel"];
    const rawStart = attrs["start"];
    if (!rawChannel || !rawStart) continue;

    const startMs = parseXmltvDate(rawStart);
    if (startMs === null) continue;

    const stopRaw = attrs["stop"];
    const stopMs = stopRaw ? parseXmltvDate(stopRaw) : null;

    const resolvedStop = stopMs !== null && stopMs > startMs ? stopMs : startMs + 60 * 60 * 1000;

    if (resolvedStop < windowStart || startMs > windowEnd) {
      skippedOutOfWindow++;
      continue;
    }

    const channelKey = rawChannel.trim().toLowerCase();
    const id = `${epgSourceId}:${channelKey}:${startMs}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const title = firstTag(inner, "title");
    const desc = firstTag(inner, "desc");
    const category = firstTag(inner, "category");

    programs.push({
      id,
      epgSourceId,
      channelKey,
      start: startMs,
      stop: resolvedStop,
      title: title?.text || "Bilinmeyen program",
      desc: desc?.text || null,
      category: category?.text || null,
      icon: firstTagAttr(inner, "icon", "src"),
      lang: title?.lang ?? null,
    });
  }

  const known = new Set(channels.map((channel) => channel.channelKey));
  for (const program of programs) {
    if (known.has(program.channelKey)) continue;
    known.add(program.channelKey);
    channels.push({
      id: `${epgSourceId}:${program.channelKey}`,
      epgSourceId,
      channelKey: program.channelKey,

      displayNames: [program.channelKey],
      icon: null,
    });
  }

  return { channels, programs, skippedOutOfWindow };
}
