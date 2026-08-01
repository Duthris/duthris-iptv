"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Profile } from "@iptv/core";
import { ensureDefaultProfile, listProfiles } from "@iptv/db";

interface ProfileState {
  profiles: Profile[];
  activeProfileId: string | null;
  loading: boolean;
  loaded: boolean;

  init: () => Promise<void>;
  refresh: () => Promise<void>;
  setActiveProfile: (id: string) => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,
      loading: false,
      loaded: false,

      init: async () => {
        if (get().loading || get().loaded) return;
        set({ loading: true });
        try {
          await ensureDefaultProfile();
          const profiles = await listProfiles();
          const current = get().activeProfileId;

          const stillExists = profiles.some((profile) => profile.id === current);
          set({
            profiles,
            activeProfileId: stillExists ? current : (profiles[0]?.id ?? null),
            loading: false,
            loaded: true,
          });
        } catch {
          set({ loading: false, loaded: true });
        }
      },

      refresh: async () => {
        const profiles = await listProfiles();
        const current = get().activeProfileId;
        const stillExists = profiles.some((profile) => profile.id === current);
        set({ profiles, activeProfileId: stillExists ? current : (profiles[0]?.id ?? null) });
      },

      setActiveProfile: (activeProfileId) => set({ activeProfileId }),
    }),
    {
      name: "iptv.profile",
      version: 1,
      storage: createJSONStorage(() => localStorage),

      partialize: (state) => ({ activeProfileId: state.activeProfileId }),
    },
  ),
);

export function useActiveProfile(): Profile | null {
  const { profiles, activeProfileId } = useProfileStore();
  if (!activeProfileId) return null;
  return profiles.find((profile) => profile.id === activeProfileId) ?? null;
}
