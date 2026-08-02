"use client";

export interface SubtitleCue {
  start: number;
  end: number;

  text: string;
}

const TIMESTAMP =
  /(?:(\d{1,3}):)?(\d{1,3}):(\d{2})[.,](\d{1,3})\s*-->\s*(?:(\d{1,3}):)?(\d{1,3}):(\d{2})[.,](\d{1,3})/;

function toSeconds(h: string | undefined, m: string, s: string, ms: string): number {
  return Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, "0")) / 1000;
}

function cleanText(raw: string): string {
  return raw
    .replace(/\{\\[^}]*\}/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

const ASS_TIME = /^(\d+):(\d{2}):(\d{2})[.,](\d{1,3})$/;

function assTimeToSeconds(raw: string): number | null {
  const match = ASS_TIME.exec(raw.trim());
  if (!match) return null;

  const [, h = "0", m = "0", s = "0", fraction = "0"] = match;
  // ASS counts hundredths, so padding to three digits is what turns "5" into
  // 50 ms and "50" into 500 ms.
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(fraction.padEnd(3, "0")) / 1000;
}

/**
 * SubStation Alpha, which shares nothing with SRT beyond being subtitles.
 *
 * Field order is declared per file by the Format line rather than fixed, so it
 * is read instead of assumed. Text is always last and may itself contain
 * commas, which is why it is rejoined rather than split off.
 */
function parseAss(input: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const lines = input.split("\n");

  let startIndex = 1;
  let endIndex = 2;
  let textIndex = 9;
  let inEvents = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("[")) {
      inEvents = /^\[events\]/i.test(trimmed);
      continue;
    }
    if (!inEvents) continue;

    if (/^format\s*:/i.test(trimmed)) {
      const names = trimmed
        .slice(trimmed.indexOf(":") + 1)
        .split(",")
        .map((name) => name.trim().toLowerCase());

      const start = names.indexOf("start");
      const end = names.indexOf("end");
      const text = names.indexOf("text");
      if (start !== -1) startIndex = start;
      if (end !== -1) endIndex = end;
      if (text !== -1) textIndex = text;
      continue;
    }

    if (!/^dialogue\s*:/i.test(trimmed)) continue;

    const fields = trimmed.slice(trimmed.indexOf(":") + 1).split(",");
    if (fields.length <= textIndex) continue;

    const start = assTimeToSeconds(fields[startIndex] ?? "");
    const end = assTimeToSeconds(fields[endIndex] ?? "");
    if (start === null || end === null || !(end > start)) continue;

    const raw = fields
      .slice(textIndex)
      .join(",")
      .replace(/\\N/g, "\n")
      .replace(/\\n/gi, "\n")
      .replace(/\\h/g, " ");

    const text = cleanText(raw);
    if (!text) continue;

    cues.push({ start, end, text });
  }

  cues.sort((a, b) => a.start - b.start);
  return cues;
}

export function parseSubtitles(input: string): SubtitleCue[] {
  if (/^\s*\[script info\]/i.test(input) || /^\s*dialogue\s*:/im.test(input)) {
    return parseAss(input);
  }

  const cues: SubtitleCue[] = [];

  const blocks = input
    .replace(/\r\n/g, "\n")
    .replace(/^﻿/, "")
    .split(/\n{2,}/);

  for (const block of blocks) {
    const lines = block.split("\n");
    const timingIndex = lines.findIndex((line) => TIMESTAMP.test(line));
    if (timingIndex === -1) continue;

    const match = TIMESTAMP.exec(lines[timingIndex] ?? "");
    if (!match) continue;

    const [, h1, m1 = "0", s1 = "0", ms1 = "0", h2, m2 = "0", s2 = "0", ms2 = "0"] = match;

    const text = cleanText(lines.slice(timingIndex + 1).join("\n"));
    if (!text) continue;

    const start = toSeconds(h1, m1, s1, ms1);
    const end = toSeconds(h2, m2, s2, ms2);

    if (!(end > start)) continue;

    cues.push({ start, end, text });
  }

  cues.sort((a, b) => a.start - b.start);
  return cues;
}

export function findCueAt(cues: SubtitleCue[], time: number): SubtitleCue | null {
  for (const cue of cues) {
    if (time < cue.start) break;
    if (time <= cue.end) return cue;
  }
  return null;
}
