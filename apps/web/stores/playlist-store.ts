"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ParseProgress, PlaylistSource } from "@iptv/core";
import { listSources } from "@iptv/db";

import { useActiveProfile } from "@/stores/profile-store";

export interface ImportState {
  sourceId: string | null;
  sourceName: string;
  progress: ParseProgress | null;
  error: string | null;
  warnings: string[];
  running: boolean;
}

const idleImport: ImportState = {
  sourceId: null,
  sourceName: "",
  progress: null,
  error: null,
  warnings: [],
  running: false,
};

interface PlaylistState {
  sources: PlaylistSource[];
  loaded: boolean;

  selectedSourceId: string | null;
  importState: ImportState;

  refresh: () => Promise<void>;
  setSelectedSource: (id: string | null) => void;

  startImport: (sourceName: string) => void;
  setImportSourceId: (sourceId: string) => void;
  setImportProgress: (progress: ParseProgress) => void;
  finishImport: (warnings?: string[]) => void;
  failImport: (error: string) => void;
  resetImport: () => void;
}

export const usePlaylistStore = create<PlaylistState>()(
  persist(
    (set) => ({
      sources: [],
      loaded: false,
      selectedSourceId: null,
      importState: idleImport,

      refresh: async () => {
        const sources = await listSources();
        set((state) => ({
          sources,
          loaded: true,

          selectedSourceId: sources.some((source) => source.id === state.selectedSourceId)
            ? state.selectedSourceId
            : null,
        }));
      },

      setSelectedSource: (selectedSourceId) => set({ selectedSourceId }),

      startImport: (sourceName) =>
        set({
          importState: { ...idleImport, sourceName, running: true },
        }),

      setImportSourceId: (sourceId) =>
        set((state) => ({ importState: { ...state.importState, sourceId } })),

      setImportProgress: (progress) =>
        set((state) => ({ importState: { ...state.importState, progress } })),

      finishImport: (warnings = []) =>
        set((state) => ({
          importState: { ...state.importState, running: false, warnings, error: null },
        })),

      failImport: (error) =>
        set((state) => ({ importState: { ...state.importState, running: false, error } })),

      resetImport: () => set({ importState: idleImport }),
    }),
    {
      name: "iptv.playlist",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ selectedSourceId: state.selectedSourceId }),
    },
  ),
);

/**
 * Sources the current profile may read from.
 *
 * Three filters stack, narrowest last: the source has to be enabled, allowed
 * for the active profile, and — when one is pinned in the UI — the selected
 * one. An empty `allowedSourceIds` means no restriction rather than no access,
 * which is what keeps existing profiles working after the field was added.
 */
export function useActiveSourceIds(): string[] {
  const { sources, selectedSourceId } = usePlaylistStore();
  const profile = useActiveProfile();

  const allowed = profile?.allowedSourceIds ?? [];
  const visible = sources.filter(
    (source) =>
      source.enabled && (allowed.length === 0 || allowed.includes(source.id)),
  );

  if (selectedSourceId) {
    return visible.some((source) => source.id === selectedSourceId) ? [selectedSourceId] : [];
  }
  return visible.map((source) => source.id);
}
