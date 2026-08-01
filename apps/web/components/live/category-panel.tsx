"use client";

import * as React from "react";
import { LayoutGrid, Search } from "lucide-react";
import type { CategoryListItem } from "@iptv/db";
import { normalizeForSearch } from "@iptv/core";
import { Input, Skeleton, cn } from "@iptv/ui";

import { formatCount } from "@/lib/format";

export const ALL_CATEGORIES = "__all__";

export interface CategoryPanelProps {
  categories: CategoryListItem[];
  totalCount: number;
  activeRawId: string;
  onSelect: (rawId: string) => void;
  loading?: boolean;
  className?: string;
}

export function CategoryPanel({
  categories,
  totalCount,
  activeRawId,
  onSelect,
  loading = false,
  className,
}: CategoryPanelProps) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const normalized = normalizeForSearch(query);
    if (!normalized) return categories;
    return categories.filter(
      (category) => category.name && normalizeForSearch(category.name).includes(normalized),
    );
  }, [categories, query]);

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="border-border/70 border-b p-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Kategori ara…"
          icon={<Search />}
          type="search"
          aria-label="Kategori ara"
        />
      </div>

      {loading ? (
        <div className="flex flex-col gap-2 p-3">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="h-9" />
          ))}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          <CategoryRow
            label="Tüm kanallar"
            count={totalCount}
            active={activeRawId === ALL_CATEGORIES}
            onClick={() => onSelect(ALL_CATEGORIES)}
            icon={<LayoutGrid className="size-3.5" />}
          />

          <div className="bg-border/60 my-2 h-px" />

          {filtered.map((category) => (
            <CategoryRow
              key={category.id}
              label={category.name}
              count={category.itemCount}
              active={activeRawId === category.rawId}
              onClick={() => onSelect(category.rawId)}
            />
          ))}

          {filtered.length === 0 ? (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              Eşleşen kategori yok
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CategoryRow({
  label,
  count,
  active,
  onClick,
  icon,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left",
        "duration-fast ease-brand transition-colors",
        "focus-visible:ring-ring/70 focus-visible:outline-none focus-visible:ring-2",
        active
          ? "bg-accent/70 text-foreground"
          : "text-muted-foreground hover:bg-accent/35 hover:text-foreground",
      )}
    >
      {icon ? <span className={cn("shrink-0", active && "text-primary")}>{icon}</span> : null}
      <span className={cn("min-w-0 flex-1 truncate text-sm", active && "font-medium")}>
        {label}
      </span>
      <span className="tabular text-2xs text-muted-foreground/70 shrink-0">
        {formatCount(count)}
      </span>
    </button>
  );
}
