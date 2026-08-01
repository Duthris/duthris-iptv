"use client";

import { create } from "zustand";

export interface SleepTimerState {
  endsAt: number | null;

  fired: boolean;
  start: (minutes: number) => void;
  extend: (minutes: number) => void;
  cancel: () => void;
  markFired: () => void;
}

export const useSleepTimerStore = create<SleepTimerState>()((set, get) => ({
  endsAt: null,
  fired: false,

  start: (minutes) => set({ endsAt: Date.now() + minutes * 60_000, fired: false }),

  extend: (minutes) => {
    const current = get().endsAt;

    const base = current && current > Date.now() ? current : Date.now();
    set({ endsAt: base + minutes * 60_000, fired: false });
  },

  cancel: () => set({ endsAt: null, fired: false }),
  markFired: () => set({ endsAt: null, fired: true }),
}));

export function sleepTimerRemaining(endsAt: number | null, now: number): number | null {
  if (endsAt === null) return null;
  return Math.max(0, Math.round((endsAt - now) / 1000));
}
