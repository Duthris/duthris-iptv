"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import type { ContentKind } from "@iptv/core";
import { isFavorite, toggleFavorite } from "@iptv/db";
import { Button, cn } from "@iptv/ui";

import { useActiveProfile } from "@/stores/profile-store";

export interface FavoriteButtonProps {
  itemId: string;
  kind: ContentKind;

  compact?: boolean;
  onChange?: (favorited: boolean) => void;
  className?: string;
}

export function FavoriteButton({
  itemId,
  kind,
  compact = false,
  onChange,
  className,
}: FavoriteButtonProps) {
  const profile = useActiveProfile();
  const [favorited, setFavorited] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    void isFavorite(profile.id, itemId).then((value) => {
      if (!cancelled) setFavorited(value);
    });

    return () => {
      cancelled = true;
    };
  }, [profile, itemId]);

  if (!profile) return null;

  const label = favorited ? "Favorilerden çıkar" : "Favorilere ekle";

  async function handleClick() {
    if (busy || !profile) return;
    setBusy(true);

    const next = !favorited;
    setFavorited(next);
    try {
      const stored = await toggleFavorite(profile.id, itemId, kind);
      setFavorited(stored);
      onChange?.(stored);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant={compact ? "ghost" : "outline"}
      size={compact ? "icon-sm" : "md"}
      onClick={handleClick}
      aria-pressed={favorited}
      aria-label={label}
      title={label}
      className={className}
    >
      <Heart
        className={cn(
          "duration-fast transition-colors",
          favorited ? "fill-destructive text-destructive" : "",
        )}
      />
      {compact ? null : favorited ? "Favorilerde" : "Favorilere ekle"}
    </Button>
  );
}
