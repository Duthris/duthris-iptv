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

export function parseSubtitles(input: string): SubtitleCue[] {
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
