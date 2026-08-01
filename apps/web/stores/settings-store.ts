"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StreamFormat } from "@iptv/core";

export type GridDensity = "comfortable" | "compact";

export type AspectRatioMode = "auto" | "fill" | "zoom" | "16:9" | "4:3";

export type SubtitleSize = "small" | "medium" | "large" | "xlarge";

export interface SubtitleStyle {
  size: SubtitleSize;

  background: boolean;
  color: string;
}

export interface SettingsState {
  preferredFormat: StreamFormat;
  autoplay: boolean;
  volume: number;
  muted: boolean;

  showAdultCategories: boolean;
  density: GridDensity;

  showChannelLogos: boolean;

  autoRefreshHours: number;

  aspectRatio: AspectRatioMode;

  playbackRate: number;
  subtitleStyle: SubtitleStyle;

  preferredAudioLang: string | null;
  preferredSubtitleLang: string | null;

  keepScreenAwake: boolean;

  tmdbToken: string;

  tmdbEnabled: boolean;

  guideTimeZone: string | null;

  guideShiftMinutes: number;

  fontScale: number;

  gridColumns: number;

  highContrast: boolean;

  setPreferredFormat: (format: StreamFormat) => void;
  setAutoplay: (value: boolean) => void;
  setVolume: (value: number) => void;
  setMuted: (value: boolean) => void;
  setShowAdultCategories: (value: boolean) => void;
  setDensity: (value: GridDensity) => void;
  setShowChannelLogos: (value: boolean) => void;
  setAutoRefreshHours: (value: number) => void;
  setAspectRatio: (value: AspectRatioMode) => void;
  setPlaybackRate: (value: number) => void;
  setSubtitleStyle: (value: Partial<SubtitleStyle>) => void;
  setPreferredAudioLang: (value: string | null) => void;
  setPreferredSubtitleLang: (value: string | null) => void;
  setKeepScreenAwake: (value: boolean) => void;
  setTmdbToken: (value: string) => void;
  setTmdbEnabled: (value: boolean) => void;
  setGuideTimeZone: (value: string | null) => void;
  setGuideShiftMinutes: (value: number) => void;
  setFontScale: (value: number) => void;
  setGridColumns: (value: number) => void;
  setHighContrast: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      preferredFormat: "m3u8",
      autoplay: true,
      volume: 0.85,
      muted: false,
      showAdultCategories: false,
      density: "comfortable",
      showChannelLogos: true,

      autoRefreshHours: 24,

      aspectRatio: "auto",
      playbackRate: 1,
      subtitleStyle: { size: "medium", background: true, color: "#ffffff" },
      preferredAudioLang: null,
      preferredSubtitleLang: null,
      keepScreenAwake: true,
      tmdbToken: "",
      tmdbEnabled: true,
      guideTimeZone: null,
      guideShiftMinutes: 0,
      fontScale: 1,
      gridColumns: 0,
      highContrast: false,

      setPreferredFormat: (preferredFormat) => set({ preferredFormat }),
      setAutoplay: (autoplay) => set({ autoplay }),
      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),
      setMuted: (muted) => set({ muted }),
      setShowAdultCategories: (showAdultCategories) => set({ showAdultCategories }),
      setDensity: (density) => set({ density }),
      setShowChannelLogos: (showChannelLogos) => set({ showChannelLogos }),
      setAutoRefreshHours: (autoRefreshHours) => set({ autoRefreshHours }),
      setAspectRatio: (aspectRatio) => set({ aspectRatio }),

      setPlaybackRate: (value) => set({ playbackRate: Math.min(4, Math.max(0.25, value)) }),
      setSubtitleStyle: (value) =>
        set((state) => ({ subtitleStyle: { ...state.subtitleStyle, ...value } })),
      setPreferredAudioLang: (preferredAudioLang) => set({ preferredAudioLang }),
      setPreferredSubtitleLang: (preferredSubtitleLang) => set({ preferredSubtitleLang }),
      setKeepScreenAwake: (keepScreenAwake) => set({ keepScreenAwake }),
      setTmdbToken: (tmdbToken) => set({ tmdbToken: tmdbToken.trim() }),
      setTmdbEnabled: (tmdbEnabled) => set({ tmdbEnabled }),
      setGuideTimeZone: (guideTimeZone) => set({ guideTimeZone }),

      setGuideShiftMinutes: (value) =>
        set({ guideShiftMinutes: Math.min(1440, Math.max(-1440, Math.round(value))) }),

      setFontScale: (value) => set({ fontScale: Math.min(1.3, Math.max(0.85, value)) }),
      setGridColumns: (value) => set({ gridColumns: Math.min(8, Math.max(0, Math.round(value))) }),
      setHighContrast: (highContrast) => set({ highContrast }),
    }),
    {
      name: "iptv.settings",

      version: 2,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
