"use client";

import { ArrowUpDown, SlidersHorizontal } from "lucide-react";
import { Badge, Button, Select, cn } from "@iptv/ui";

import {
  DEFAULT_FILTERS,
  SORT_OPTIONS,
  type LibraryFilters,
  type SortMode,
} from "@/lib/library-sort";
import { isDesktop } from "@/lib/platform";

export interface LibraryControlsProps {
  sort: SortMode;
  onSortChange: (sort: SortMode) => void;
  filters: LibraryFilters;
  onFiltersChange: (filters: LibraryFilters) => void;

  showPlayableFilter?: boolean;
  open: boolean;
  onToggle: () => void;
  className?: string;
}

const RATING_STEPS = [0, 5, 6, 7, 8];

export function LibraryControls({
  sort,
  onSortChange,
  filters,
  onFiltersChange,
  showPlayableFilter = false,
  open,
  onToggle,
  className,
}: LibraryControlsProps) {
  const activeCount = (filters.minRating > 0 ? 1 : 0) + (filters.playableOnly ? 1 : 0);

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-2">
        <Button
          variant={open || activeCount > 0 ? "secondary" : "ghost"}
          size="sm"
          onClick={onToggle}
          aria-expanded={open}
        >
          <SlidersHorizontal />
          Filtrele
          {activeCount > 0 ? <Badge variant="brand">{activeCount}</Badge> : null}
        </Button>

        <Select
          value={sort}
          onChange={(event) => onSortChange(event.target.value as SortMode)}
          aria-label="Sıralama"
          icon={<ArrowUpDown />}
          className="w-52"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>

      {open ? (
        <div className="border-border/70 bg-surface-2/50 mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border p-3.5">
          <div className="flex items-center gap-2">
            <span className="text-foreground text-xs font-medium">En düşük puan</span>
            <div className="flex gap-1">
              {RATING_STEPS.map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, minRating: step })}
                  className={cn(
                    "tabular h-7 min-w-9 rounded-md px-2 text-xs font-medium",
                    "duration-fast ease-brand transition-colors",
                    "focus-visible:ring-ring/70 focus-visible:outline-none focus-visible:ring-2",
                    filters.minRating === step
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface-3 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {step === 0 ? "Hepsi" : `${step}+`}
                </button>
              ))}
            </div>
          </div>

          {showPlayableFilter && !isDesktop() ? (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={filters.playableOnly}
                onChange={(event) =>
                  onFiltersChange({ ...filters, playableOnly: event.target.checked })
                }
                className="size-4 accent-[hsl(var(--primary))]"
              />
              <span className="text-foreground text-xs">
                Yalnızca oynatılabilenler <span className="text-muted-foreground">(MP4)</span>
              </span>
            </label>
          ) : null}

          {activeCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFiltersChange(DEFAULT_FILTERS)}
              className="text-muted-foreground ml-auto"
            >
              Filtreleri temizle
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
