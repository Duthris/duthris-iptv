"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clapperboard, Clock, Radio, Search, Tv } from "lucide-react";
import { searchCatalog, type SearchResults } from "@iptv/db";
import { Spinner, cn } from "@iptv/ui";

import { initialsOf } from "@/lib/format";
import { useNavigationStore } from "@/stores/navigation-store";
import { useActiveSourceIds } from "@/stores/playlist-store";
import { useRecentSearchStore } from "@/stores/recent-search-store";

const DEBOUNCE_MS = 200;

const LIMIT_PER_KIND = 8;

type ResultKind = "live" | "vod" | "series";

interface FlatResult {
  kind: ResultKind;
  id: string;
  name: string;
  image: string | null;
  meta: string | null;
}

const KIND_LABEL: Record<ResultKind, string> = {
  live: "Canlı TV",
  vod: "Filmler",
  series: "Diziler",
};

const KIND_ICON: Record<ResultKind, React.ComponentType<{ className?: string }>> = {
  live: Radio,
  vod: Clapperboard,
  series: Tv,
};

const EMPTY: SearchResults = { live: [], vod: [], series: [], truncated: false };

function flatten(results: SearchResults): FlatResult[] {
  return [
    ...results.live.map((row) => ({
      kind: "live" as const,
      id: row.id,
      name: row.name,
      image: row.logo,
      meta: row.number !== null ? `Kanal ${row.number}` : null,
    })),
    ...results.series.map((row) => ({
      kind: "series" as const,
      id: row.id,
      name: row.name,
      image: row.cover,
      meta: row.year ? String(row.year) : null,
    })),
    ...results.vod.map((row) => ({
      kind: "vod" as const,
      id: row.id,
      name: row.name,
      image: row.logo,
      meta: row.year ? String(row.year) : null,
    })),
  ];
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const sourceIds = useActiveSourceIds();
  const openMovie = useNavigationStore((state) => state.openMovie);
  const openSeries = useNavigationStore((state) => state.openSeries);
  const openChannel = useNavigationStore((state) => state.openChannel);
  const recent = useRecentSearchStore((state) => state.queries);
  const remember = useRecentSearchStore((state) => state.remember);

  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResults>(EMPTY);
  const [searching, setSearching] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const sourceKey = sourceIds.join("|");

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults(EMPTY);
    setActiveIndex(0);

    const timer = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(timer);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(EMPTY);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);

    const timer = setTimeout(() => {
      void searchCatalog(trimmed, sourceIds, LIMIT_PER_KIND)
        .then((found) => {
          if (cancelled) return;
          setResults(found);
          setActiveIndex(0);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sourceKey, open]);

  const flat = React.useMemo(() => flatten(results), [results]);

  const openResult = React.useCallback(
    (result: FlatResult) => {
      remember(query.trim());
      onClose();

      if (result.kind === "live") {
        openChannel(result.id);
        router.push("/live");
        return;
      }
      if (result.kind === "series") {
        openSeries(result.id);
        router.push("/series");
        return;
      }
      openMovie(result.id);
      router.push("/movies");
    },
    [remember, query, onClose, openChannel, openSeries, openMovie, router],
  );

  React.useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  if (!open) return null;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (flat.length === 0 ? 0 : (index + 1) % flat.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (flat.length === 0 ? 0 : (index - 1 + flat.length) % flat.length));
      return;
    }
    if (event.key === "Enter") {
      const target = flat[activeIndex];
      if (target) {
        event.preventDefault();
        openResult(target);
      }
    }
  };

  const showRecent = query.trim().length < 2 && recent.length > 0;
  const noResults = query.trim().length >= 2 && !searching && flat.length === 0;

  let renderedKind: ResultKind | null = null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ara"
        onKeyDown={handleKeyDown}
        className={cn(
          "flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-xl",
          "border-border/70 bg-surface-1 border shadow-lg",
        )}
      >
        <div className="border-border/70 flex items-center gap-3 border-b px-4">
          <Search className="text-muted-foreground size-4 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Kanal, film veya dizi ara…"
            aria-label="Ara"
            className="text-foreground placeholder:text-muted-foreground h-12 flex-1 bg-transparent text-sm outline-none"
          />
          {searching ? <Spinner /> : null}
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {showRecent ? (
            <>
              <p className="text-2xs text-muted-foreground px-2 py-1.5 font-medium uppercase tracking-wide">
                Son aramalar
              </p>
              {recent.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  onClick={() => setQuery(entry)}
                  className="text-muted-foreground duration-fast hover:bg-accent/40 hover:text-foreground flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors"
                >
                  <Clock className="size-3.5 shrink-0" />
                  {entry}
                </button>
              ))}
            </>
          ) : null}

          {query.trim().length > 0 && query.trim().length < 2 ? (
            <p className="text-muted-foreground px-2 py-6 text-center text-xs">
              Aramak için en az 2 karakter yazın.
            </p>
          ) : null}

          {noResults ? (
            <p className="text-muted-foreground px-2 py-6 text-center text-xs">Sonuç bulunamadı.</p>
          ) : null}

          {flat.map((result, index) => {
            const Icon = KIND_ICON[result.kind];
            const heading = renderedKind !== result.kind ? KIND_LABEL[result.kind] : null;
            renderedKind = result.kind;

            return (
              <React.Fragment key={`${result.kind}:${result.id}`}>
                {heading ? (
                  <p className="text-2xs text-muted-foreground px-2 pb-1 pt-2 font-medium uppercase tracking-wide">
                    {heading}
                  </p>
                ) : null}

                <button
                  type="button"
                  data-index={index}
                  onClick={() => openResult(result)}
                  onMouseEnter={() => setActiveIndex(index)}
                  aria-current={index === activeIndex ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left",
                    "duration-fast ease-brand transition-colors",
                    index === activeIndex ? "bg-accent/60" : "hover:bg-accent/35",
                  )}
                >
                  {result.image ? (
                    <img
                      src={result.image}
                      alt=""
                      loading="lazy"
                      className="bg-surface-3 size-8 shrink-0 rounded object-contain"
                    />
                  ) : (
                    <span className="bg-surface-3 text-2xs text-muted-foreground grid size-8 shrink-0 place-items-center rounded font-semibold">
                      {initialsOf(result.name)}
                    </span>
                  )}

                  <span className="text-foreground min-w-0 flex-1 truncate text-sm">
                    {result.name}
                  </span>

                  {result.meta ? (
                    <span className="tabular text-2xs text-muted-foreground shrink-0">
                      {result.meta}
                    </span>
                  ) : null}
                  <Icon className="text-muted-foreground/60 size-3.5 shrink-0" />
                </button>
              </React.Fragment>
            );
          })}

          {results.truncated ? (
            <p className="text-2xs text-muted-foreground/70 px-2 py-2 text-center">
              Sonuçların tamamı gösterilmiyor — aramayı daraltın.
            </p>
          ) : null}
        </div>

        <div className="border-border/70 text-2xs text-muted-foreground flex items-center gap-3 border-t px-4 py-2">
          <span>↑↓ gezin</span>
          <span>↵ aç</span>
          <span>Esc kapat</span>
        </div>
      </div>
    </div>
  );
}
