"use client";

import * as React from "react";
import type { TmdbDetails, TmdbKind } from "@iptv/core";

import { enrich, type EnrichInput } from "@/lib/tmdb";

export function useTmdbDetails(
  input: { itemId: string; kind: TmdbKind; title: string; year: number | null } | null,
  tmdbId: number | null = null,
): { details: TmdbDetails | null; loading: boolean } {
  const [details, setDetails] = React.useState<TmdbDetails | null>(null);
  const [loading, setLoading] = React.useState(false);

  const itemId = input?.itemId ?? null;
  const kind = input?.kind ?? null;
  const title = input?.title ?? null;
  const year = input?.year ?? null;

  React.useEffect(() => {
    setDetails(null);

    if (!itemId || !kind || !title) return;

    let cancelled = false;
    setLoading(true);

    const request: EnrichInput = { itemId, kind, title, year, tmdbId };

    void enrich(request)
      .then((found) => {
        if (!cancelled) setDetails(found);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [itemId, kind, title, year, tmdbId]);

  return { details, loading };
}
