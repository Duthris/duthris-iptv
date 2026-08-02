"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Reminder {
  /** Channel and start time identify a showing; a title alone would not. */
  id: string;
  channelId: string;
  channelName: string;
  title: string;
  startAt: number;
  leadMinutes: number;
}

interface ReminderState {
  reminders: Reminder[];

  add: (reminder: Reminder) => void;
  remove: (id: string) => void;
  /** Drops showings that have already started; nothing is owed for those. */
  prune: () => void;
}

export function reminderId(channelId: string, startAt: number): string {
  return `${channelId}:${startAt}`;
}

export const useReminderStore = create<ReminderState>()(
  persist(
    (set, get) => ({
      reminders: [],

      add: (reminder) =>
        set({
          reminders: [...get().reminders.filter((row) => row.id !== reminder.id), reminder],
        }),

      remove: (id) => set({ reminders: get().reminders.filter((row) => row.id !== id) }),

      prune: () => {
        const now = Date.now();
        const kept = get().reminders.filter((row) => row.startAt > now);
        if (kept.length !== get().reminders.length) set({ reminders: kept });
      },
    }),
    { name: "iptv-reminders" },
  ),
);
