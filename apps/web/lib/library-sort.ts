"use client";

import { normalizeForSearch } from "@iptv/core";
import type { PosterListItem } from "@iptv/db";

import { isBrowserPlayableContainer } from "@/components/library/container-notice";

export type SortMode =
  "provider" | "name-asc" | "name-desc" | "rating-desc" | "year-desc" | "year-asc" | "added-desc";

export const SORT_OPTIONS: ReadonlyArray<{ value: SortMode; label: string }> = [
  { value: "provider", label: "Sağlayıcı sırası" },
  { value: "name-asc", label: "Ada göre (A→Z)" },
  { value: "name-desc", label: "Ada göre (Z→A)" },
  { value: "rating-desc", label: "Puana göre" },
  { value: "year-desc", label: "Yıl (yeni → eski)" },
  { value: "year-asc", label: "Yıl (eski → yeni)" },
  { value: "added-desc", label: "Son eklenenler" },
];

export interface LibraryFilters {
  minRating: number;

  playableOnly: boolean;
}

export const DEFAULT_FILTERS: LibraryFilters = { minRating: 0, playableOnly: false };

function compareNullableDesc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function compareNullableAsc(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
}

export function applyLibraryView(
  items: PosterListItem[],
  options: { query: string; sort: SortMode; filters: LibraryFilters },
): PosterListItem[] {
  const { query, sort, filters } = options;

  let result = items;

  const normalized = normalizeForSearch(query);
  if (normalized) {
    const tokens = normalized.split(" ").filter(Boolean);
    result = result.filter((item) => {
      const haystack = normalizeForSearch(item.name);
      return tokens.every((token) => haystack.includes(token));
    });
  }

  if (filters.minRating > 0) {
    result = result.filter((item) => (item.rating ?? 0) >= filters.minRating);
  }

  if (filters.playableOnly) {
    result = result.filter((item) => isBrowserPlayableContainer(item.containerExt));
  }

  if (sort === "provider") {
    return result === items ? items : result;
  }

  const sorted = [...result];
  switch (sort) {
    case "name-asc":
      sorted.sort((a, b) => a.name.localeCompare(b.name, "tr"));
      break;
    case "name-desc":
      sorted.sort((a, b) => b.name.localeCompare(a.name, "tr"));
      break;
    case "rating-desc":
      sorted.sort((a, b) => compareNullableDesc(a.rating, b.rating));
      break;
    case "year-desc":
      sorted.sort((a, b) => compareNullableDesc(a.year, b.year));
      break;
    case "year-asc":
      sorted.sort((a, b) => compareNullableAsc(a.year, b.year));
      break;
    case "added-desc":
      sorted.sort((a, b) => compareNullableDesc(a.addedAt, b.addedAt));
      break;
  }

  return sorted;
}
