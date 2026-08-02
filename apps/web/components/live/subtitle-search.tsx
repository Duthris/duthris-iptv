"use client";

import * as React from "react";
import { Download, Search, X } from "lucide-react";
import type { SubtitleCandidate } from "@iptv/core";
import { Badge, Button, EmptyState, Select, Spinner, cn } from "@iptv/ui";
import { toast } from "sonner";

import { languageName } from "@/lib/languages";
import {
  downloadSubtitle,
  searchSubtitles,
  type SubtitleQuery,
} from "@/lib/opensubtitles";

const LANGUAGE_CHOICES = [
  { value: "tr", label: "Türkçe" },
  { value: "en", label: "İngilizce" },
  { value: "tr,en", label: "Türkçe + İngilizce" },
  { value: "de", label: "Almanca" },
  { value: "fr", label: "Fransızca" },
  { value: "es", label: "İspanyolca" },
  { value: "ar", label: "Arapça" },
];

export interface SubtitleSearchProps {
  open: boolean;
  onClose: () => void;
  query: SubtitleQuery | null;
  /** Receives the subtitle file contents once one is downloaded. */
  onLoaded: (text: string, name: string) => void;
}

function CandidateRow({
  candidate,
  busy,
  onPick,
}: {
  candidate: SubtitleCandidate;
  busy: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={busy}
      className={cn(
        "flex w-full items-start gap-3 rounded-md border border-border/70 bg-card p-2.5 text-left",
        "transition-colors duration-fast ease-brand hover:border-brand-500/40 hover:bg-accent/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
        "disabled:cursor-not-allowed disabled:opacity-55",
      )}
    >
      <Download className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-xs text-foreground">{candidate.release}</span>
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{languageName(candidate.language) ?? candidate.language}</Badge>
          <span className="tabular text-2xs text-muted-foreground">
            {candidate.downloadCount.toLocaleString("tr-TR")} indirme
          </span>
          {candidate.fps ? (
            <span className="tabular text-2xs text-muted-foreground">{candidate.fps} fps</span>
          ) : null}
          {candidate.hearingImpaired ? <Badge variant="outline">işitme engelli</Badge> : null}
          {candidate.machineTranslated ? <Badge variant="warning">makine çevirisi</Badge> : null}
        </span>
      </span>
    </button>
  );
}

/**
 * Subtitle search over OpenSubtitles.
 *
 * Rendered inside the player element so it survives fullscreen, which is where
 * a missing subtitle is usually noticed.
 */
export function SubtitleSearch({ open, onClose, query, onLoaded }: SubtitleSearchProps) {
  const [languages, setLanguages] = React.useState("tr");
  const [results, setResults] = React.useState<SubtitleCandidate[] | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [downloading, setDownloading] = React.useState<number | null>(null);

  const run = React.useCallback(async () => {
    if (!query) return;
    setSearching(true);
    try {
      setResults(await searchSubtitles(query, languages));
    } catch {
      setResults([]);
      toast.error("Altyazı araması başarısız oldu");
    } finally {
      setSearching(false);
    }
  }, [query, languages]);

  // Search as soon as the panel opens, and again when the language changes.
  React.useEffect(() => {
    if (!open) return;
    void run();
  }, [open, run]);

  React.useEffect(() => {
    if (!open) setResults(null);
  }, [open]);

  if (!open) return null;

  const pick = async (candidate: SubtitleCandidate) => {
    setDownloading(candidate.fileId);
    try {
      const result = await downloadSubtitle(candidate.fileId);
      onLoaded(result.text, result.fileName ?? candidate.release);
      toast.success(
        result.remaining !== null
          ? `Altyazı yüklendi · bugün ${result.remaining} indirme hakkın kaldı`
          : "Altyazı yüklendi",
      );
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Altyazı indirilemedi");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-label="Altyazı ara"
        className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border/70 bg-surface-1 shadow-lg"
      >
        <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">Altyazı ara</p>
            <p className="truncate text-2xs text-muted-foreground">{query?.title ?? ""}</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Kapat">
            <X />
          </Button>
        </div>

        <div className="border-b border-border/70 px-4 py-2.5">
          <Select
            value={languages}
            onChange={(event) => setLanguages(event.target.value)}
            aria-label="Altyazı dili"
          >
            {LANGUAGE_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
          {searching ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Spinner /> Aranıyor…
            </div>
          ) : results && results.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {results.slice(0, 25).map((candidate) => (
                <CandidateRow
                  key={candidate.fileId}
                  candidate={candidate}
                  busy={downloading !== null}
                  onPick={() => void pick(candidate)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Search />}
              title="Sonuç bulunamadı"
              description="Farklı bir dil deneyin. Yerel bir .srt dosyası yüklemek de mümkün."
            />
          )}
        </div>
      </div>
    </div>
  );
}
