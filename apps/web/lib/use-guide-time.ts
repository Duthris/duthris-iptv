"use client";

import * as React from "react";

import { useSettingsStore } from "@/stores/settings-store";

export const GUIDE_TIME_ZONES = [
  { value: "Europe/Istanbul", label: "İstanbul (TRT)" },
  { value: "Europe/London", label: "Londra" },
  { value: "Europe/Berlin", label: "Berlin · Amsterdam · Paris" },
  { value: "Europe/Moscow", label: "Moskova" },
  { value: "America/New_York", label: "New York" },
  { value: "America/Los_Angeles", label: "Los Angeles" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "UTC", label: "UTC" },
] as const;

export interface GuideTime {
  shiftMs: number;

  formatTime: (timestamp: number) => string;

  formatDate: (timestamp: number) => string;

  startOfDay: (offsetDays: number) => number;
  timeZone: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDayInZone(offsetDays: number, timeZone: string | null): number {
  const target = new Date(Date.now() + offsetDays * DAY_MS);

  if (!timeZone) {
    target.setHours(0, 0, 0, 0);
    return target.getTime();
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(target);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const intoDay = get("hour") * 3_600_000 + get("minute") * 60_000 + get("second") * 1000;

  return target.getTime() - intoDay - (target.getTime() % 1000);
}

export function useGuideTime(): GuideTime {
  const timeZone = useSettingsStore((state) => state.guideTimeZone);
  const shiftMinutes = useSettingsStore((state) => state.guideShiftMinutes);

  return React.useMemo(() => {
    const options: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      ...(timeZone ? { timeZone } : {}),
    };
    const timeFormatter = new Intl.DateTimeFormat("tr-TR", options);
    const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
      day: "numeric",
      month: "long",
      weekday: "short",
      ...(timeZone ? { timeZone } : {}),
    });

    return {
      shiftMs: shiftMinutes * 60_000,
      formatTime: (timestamp: number) => timeFormatter.format(timestamp),
      formatDate: (timestamp: number) => dateFormatter.format(timestamp),
      startOfDay: (offsetDays: number) => startOfDayInZone(offsetDays, timeZone),
      timeZone,
    };
  }, [timeZone, shiftMinutes]);
}
