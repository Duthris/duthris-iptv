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
  /**
   * Which tab the library screen should land on.
   *
   * Carried here rather than in the URL because the desktop build is a static
   * export, where a query string would need its own Suspense boundary to be
   * read at all.
   */
  pendingLibraryTab: string | null;

  openMovie: (id: string) => void;
  openSeries: (id: string) => void;
  openChannel: (id: string) => void;
  openArchive: (entry: PendingArchive) => void;
  openLibraryTab: (tab: string) => void;

  consumeLibraryTab: () => string | null;
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
  pendingLibraryTab: null,

  openLibraryTab: (tab) => set({ pendingLibraryTab: tab }),
  consumeLibraryTab: () => {
    const tab = get().pendingLibraryTab;
    if (tab) set({ pendingLibraryTab: null });
    return tab;
  },

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
