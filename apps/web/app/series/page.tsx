"use client";

import * as React from "react";
import Link from "next/link";
import { ListVideo, Search, Tv } from "lucide-react";
import type { CategoryListItem, PosterListItem } from "@iptv/db";
import { countSeriesItems, listCategories, listSeriesItems } from "@iptv/db";
import { Button, EmptyState, Input, cn } from "@iptv/ui";

import { AppShell } from "@/components/app-shell";
import { ALL_CATEGORIES, CategoryPanel } from "@/components/live/category-panel";
import { PosterGrid } from "@/components/library/poster-grid";
import { SeriesDetail } from "@/components/library/series-detail";
import { LibraryControls } from "@/components/library/library-controls";
import {
  DEFAULT_FILTERS,
  applyLibraryView,
  type LibraryFilters,
  type SortMode,
} from "@/lib/library-sort";
import { useNavigationStore } from "@/stores/navigation-store";
import { useActiveSourceIds, usePlaylistStore } from "@/stores/playlist-store";
import { useActiveProfile } from "@/stores/profile-store";
import { useSettingsStore } from "@/stores/settings-store";
import { formatCount } from "@/lib/format";

export default function SeriesPage() {
  const sourcesLoaded = usePlaylistStore((state) => state.loaded);
  const sources = usePlaylistStore((state) => state.sources);
  const sourceIds = useActiveSourceIds();
  const profile = useActiveProfile();
  const showAdult = useSettingsStore((state) => state.showAdultCategories);

  const [categories, setCategories] = React.useState<CategoryListItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [activeCategory, setActiveCategory] = React.useState<string>(ALL_CATEGORIES);
  const [items, setItems] = React.useState<PosterListItem[]>([]);
  const [loadingCategories, setLoadingCategories] = React.useState(true);
  const [loadingItems, setLoadingItems] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const consumeSeries = useNavigationStore((state) => state.consumeSeries);
  React.useEffect(() => {
    const pending = consumeSeries();
    if (pending) setSelectedId(pending);
  }, [consumeSeries]);
  const [sort, setSort] = React.useState<SortMode>("provider");
  const [filters, setFilters] = React.useState<LibraryFilters>(DEFAULT_FILTERS);
  const [controlsOpen, setControlsOpen] = React.useState(false);

  const sourceKey = sourceIds.join("|");

  React.useEffect(() => {
    if (!sourcesLoaded) return;
    let cancelled = false;

    void (async () => {
      setLoadingCategories(true);
      const [list, count] = await Promise.all([
        listCategories(sourceIds, "series", {
          includeAdult: showAdult,
          hiddenIds: profile?.hiddenCategoryIds ?? [],
        }),
        countSeriesItems(sourceIds),
      ]);
      if (cancelled) return;
      setCategories(list);
      setTotal(count);
      setLoadingCategories(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, sourcesLoaded, showAdult, profile?.id]);

  React.useEffect(() => {
    if (!sourcesLoaded) return;
    let cancelled = false;

    void (async () => {
      setLoadingItems(true);
      const list = await listSeriesItems({
        sourceIds,
        categoryRawId: activeCategory === ALL_CATEGORIES ? null : activeCategory,
      });
      if (cancelled) return;
      setItems(list);
      setLoadingItems(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, sourcesLoaded, activeCategory]);

  const filtered = React.useMemo(
    () => applyLibraryView(items, { query, sort, filters }),
    [items, query, sort, filters],
  );

  if (sourcesLoaded && sources.length === 0) {
    return (
      <AppShell>
        <EmptyState
          icon={<ListVideo />}
          title="Henüz playlist eklenmedi"
          description="Dizi kütüphanesini görmek için önce bir kaynak ekleyin."
          action={
            <Link href="/playlists">
              <Button>Playlist ekle</Button>
            </Link>
          }
          className="min-h-[60vh]"
        />
      </AppShell>
    );
  }

  return (
    <AppShell bleed>
      <div className="flex h-full flex-col">
        <header className="border-border/70 flex h-14 shrink-0 items-center gap-3 border-b px-4 lg:px-6">
          <Tv className="text-primary size-4" />
          <h1 className="text-foreground text-sm font-semibold tracking-tight">Diziler</h1>
          <span className="tabular text-2xs text-muted-foreground hidden sm:inline">
            {formatCount(filtered.length)}
            {query ? " sonuç" : " dizi"}
          </span>

          <div className="ml-auto w-full max-w-xs">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Dizi ara…"
              icon={<Search />}
              type="search"
              aria-label="Dizi ara"
              className="h-9"
            />
          </div>
        </header>

        <div className="border-border/70 shrink-0 border-b px-4 py-2.5 lg:px-6">
          <LibraryControls
            sort={sort}
            onSortChange={setSort}
            filters={filters}
            onFiltersChange={setFilters}
            open={controlsOpen}
            onToggle={() => setControlsOpen((value) => !value)}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <CategoryPanel
            categories={categories}
            totalCount={total}
            activeRawId={activeCategory}
            onSelect={setActiveCategory}
            loading={loadingCategories}
            className={cn(
              "border-border/70 shrink-0",
              "lg:w-sidebar-sm order-2 h-56 border-t lg:order-1 lg:h-auto lg:border-r lg:border-t-0",
            )}
          />

          <PosterGrid
            items={filtered}
            loading={loadingItems}
            onSelect={(item) => setSelectedId(item.id)}
            emptyTitle={query ? "Sonuç bulunamadı" : "Bu kategoride dizi yok"}
            emptyDescription={query ? "Farklı bir arama deneyin." : undefined}
            className="order-1 lg:order-2"
          />
        </div>
      </div>

      <SeriesDetail seriesId={selectedId} onClose={() => setSelectedId(null)} />
    </AppShell>
  );
}
