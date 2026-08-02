"use client";

import { create } from "zustand";

export interface PendingArchive {
  channelId: string;
  startAt: number;
  durationMinutes: number;
  title: string;
}

interface NavigationState {
  pendingMovieId: string | null;
  pendingSeriesId: string | null;
  pendingChannelId: string | null;
  pendingArchive: PendingArchive | null;

  openMovie: (id: string) => void;
  openSeries: (id: string) => void;
  openChannel: (id: string) => void;
  openArchive: (entry: PendingArchive) => void;

  consumeMovie: () => string | null;
  consumeSeries: () => string | null;
  consumeChannel: () => string | null;
  consumeArchive: () => PendingArchive | null;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  pendingMovieId: null,
  pendingSeriesId: null,
  pendingChannelId: null,
  pendingArchive: null,

  openMovie: (id) => set({ pendingMovieId: id }),
  openSeries: (id) => set({ pendingSeriesId: id }),
  openChannel: (id) => set({ pendingChannelId: id }),
  openArchive: (entry) => set({ pendingArchive: entry, pendingChannelId: entry.channelId }),

  consumeMovie: () => {
    const id = get().pendingMovieId;
    if (id) set({ pendingMovieId: null });
    return id;
  },
  consumeSeries: () => {
    const id = get().pendingSeriesId;
    if (id) set({ pendingSeriesId: null });
    return id;
  },
  consumeArchive: () => {
    const entry = get().pendingArchive;
    if (entry) set({ pendingArchive: null });
    return entry;
  },
  consumeChannel: () => {
    const id = get().pendingChannelId;
    if (id) set({ pendingChannelId: null });
    return id;
  },
}));
