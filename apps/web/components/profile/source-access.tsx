"use client";

import * as React from "react";
import { Check, ListVideo } from "lucide-react";
import type { Profile } from "@iptv/core";
import { updateProfile } from "@iptv/db";
import { cn } from "@iptv/ui";
import { toast } from "sonner";

import { usePlaylistStore } from "@/stores/playlist-store";
import { useProfileStore } from "@/stores/profile-store";

export function SourceAccess({ profile }: { profile: Profile }) {
  const sources = usePlaylistStore((state) => state.sources);
  const refreshProfiles = useProfileStore((state) => state.refresh);
  const [busy, setBusy] = React.useState(false);

  const allowed = profile.allowedSourceIds ?? [];
  const unrestricted = allowed.length === 0;

  const apply = React.useCallback(
    async (next: string[]) => {
      setBusy(true);
      try {
        await updateProfile(profile.id, { allowedSourceIds: next });
        await refreshProfiles();
      } catch {
        toast.error("Erişim ayarı kaydedilemedi");
      } finally {
        setBusy(false);
      }
    },
    [profile.id, refreshProfiles],
  );

  const toggle = (sourceId: string) => {
    /**
     * Turning one off while unrestricted has to enumerate the rest, because an
     * empty list means "everything" — writing a single removal into it would
     * read as "nothing allowed" on the next load.
     */
    const base = unrestricted ? sources.map((source) => source.id) : allowed;
    const next = base.includes(sourceId)
      ? base.filter((id) => id !== sourceId)
      : [...base, sourceId];

    /**
     * Refuse to clear the last one. An empty list is stored as "unrestricted",
     * so turning the final source off would silently switch every source back
     * on — the opposite of what the click asked for.
     */
    if (next.length === 0) {
      toast.error("En az bir playlist seçili kalmalı");
      return;
    }

    // Back to unrestricted rather than listing every source explicitly, so a
    // playlist added later is visible without revisiting this screen.
    void apply(next.length === sources.length ? [] : next);
  };

  if (sources.length < 2) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        <ListVideo className="size-3.5" />
        Erişebileceği playlistler
      </p>

      <div className="flex flex-col gap-1">
        {sources.map((source) => {
          const active = unrestricted || allowed.includes(source.id);
          return (
            <button
              key={source.id}
              type="button"
              disabled={busy}
              onClick={() => toggle(source.id)}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-left",
                "transition-colors duration-fast ease-brand",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
                "disabled:cursor-not-allowed disabled:opacity-55",
                active
                  ? "border-brand-500/40 bg-brand-500/10"
                  : "border-border/70 bg-surface-2/50",
              )}
            >
              <span
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded border",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input",
                )}
              >
                {active ? <Check className="size-3" /> : null}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                {source.name}
              </span>
              {!source.enabled ? (
                <span className="shrink-0 text-2xs text-muted-foreground">pasif</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="text-2xs text-muted-foreground">
        {unrestricted
          ? "Tümü seçili — sonradan eklenen playlistler de bu profile açık olur."
          : `${allowed.length} playlist seçili. Diğerleri bu profilde görünmez.`}
      </p>
    </div>
  );
}
