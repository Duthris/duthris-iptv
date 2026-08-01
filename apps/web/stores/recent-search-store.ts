"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const MAX_ENTRIES = 8;

interface RecentSearchState {
  queries: string[];
  remember: (query: string) => void;
  clear: () => void;
}

export const useRecentSearchStore = create<RecentSearchState>()(
  persist(
    (set) => ({
      queries: [],

      remember: (query) => {
        const trimmed = query.trim();
        if (trimmed.length < 2) return;
        set((state) => ({
          queries: [
            trimmed,
            ...state.queries.filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase()),
          ].slice(0, MAX_ENTRIES),
        }));
      },

      clear: () => set({ queries: [] }),
    }),
    { name: "iptv.recent-searches", storage: createJSONStorage(() => localStorage) },
  ),
);
