"use client";

import { create } from "zustand";

interface NavigationState {
  pendingMovieId: string | null;
  pendingSeriesId: string | null;
  pendingChannelId: string | null;

  openMovie: (id: string) => void;
  openSeries: (id: string) => void;
  openChannel: (id: string) => void;

  consumeMovie: () => string | null;
  consumeSeries: () => string | null;
  consumeChannel: () => string | null;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  pendingMovieId: null,
  pendingSeriesId: null,
  pendingChannelId: null,

  openMovie: (id) => set({ pendingMovieId: id }),
  openSeries: (id) => set({ pendingSeriesId: id }),
  openChannel: (id) => set({ pendingChannelId: id }),

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
  consumeChannel: () => {
    const id = get().pendingChannelId;
    if (id) set({ pendingChannelId: null });
    return id;
  },
}));
