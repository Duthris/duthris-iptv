"use client";

import { create } from "zustand";
import type { ChannelListItem } from "@iptv/db";

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "error";

interface PlayerState {
  current: ChannelListItem | null;

  previous: ChannelListItem | null;
  status: PlayerStatus;
  errorMessage: string | null;

  streamUrl: string | null;

  playChannel: (channel: ChannelListItem) => void;
  setStatus: (status: PlayerStatus) => void;
  setError: (message: string | null) => void;
  setStreamUrl: (url: string | null) => void;
  swapToPrevious: () => void;
  stop: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  current: null,
  previous: null,
  status: "idle",
  errorMessage: null,
  streamUrl: null,

  playChannel: (channel) => {
    const { current } = get();
    if (current?.id === channel.id) return;
    set({
      previous: current,
      current: channel,
      status: "loading",
      errorMessage: null,
      streamUrl: null,
    });
  },

  setStatus: (status) => set({ status }),
  setError: (errorMessage) => set({ errorMessage, status: errorMessage ? "error" : get().status }),
  setStreamUrl: (streamUrl) => set({ streamUrl }),

  swapToPrevious: () => {
    const { previous, current } = get();
    if (!previous) return;
    set({ current: previous, previous: current, status: "loading", errorMessage: null });
  },

  stop: () => set({ current: null, status: "idle", errorMessage: null, streamUrl: null }),
}));
