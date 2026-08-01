"use client";

import { CheckCircle2, CloudDownload, Database, ListFilter, Loader2 } from "lucide-react";
import type { ParseProgress } from "@iptv/core";
import { Progress, cn } from "@iptv/ui";

import { formatCount } from "@/lib/format";

const PHASE_META: Record<
  ParseProgress["phase"],
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  download: { label: "İndiriliyor", icon: CloudDownload },
  parse: { label: "Çözümleniyor", icon: ListFilter },
  normalize: { label: "Düzenleniyor", icon: ListFilter },
  store: { label: "Kaydediliyor", icon: Database },
};

const PHASE_ORDER: ParseProgress["phase"][] = ["download", "parse", "normalize", "store"];

export function ImportProgress({
  progress,
  sourceName,
  className,
}: {
  progress: ParseProgress | null;
  sourceName: string;
  className?: string;
}) {
  const phase = progress?.phase ?? "download";
  const meta = PHASE_META[phase];
  const Icon = meta.icon;
  const currentStep = PHASE_ORDER.indexOf(phase);

  return (
    <div
      className={cn(
        "border-brand-500/20 bg-card bg-brand-surface flex flex-col gap-4 rounded-lg border p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="bg-brand-500/15 text-primary mt-0.5 grid size-9 shrink-0 place-items-center rounded-md">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-semibold">{sourceName}</p>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {progress?.label ?? "Hazırlanıyor…"}
          </p>
        </div>
        <Loader2 className="text-muted-foreground mt-1 size-4 shrink-0 animate-spin" />
      </div>

      <Progress value={progress?.ratio ?? null} label="İçe aktarma ilerlemesi" />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {PHASE_ORDER.map((step, index) => (
            <span
              key={step}
              title={PHASE_META[step].label}
              className={cn(
                "duration-base h-1 w-6 rounded-full transition-colors",
                index < currentStep
                  ? "bg-primary"
                  : index === currentStep
                    ? "bg-primary/60"
                    : "bg-surface-3",
              )}
            />
          ))}
        </div>

        {progress && progress.processed > 0 ? (
          <span className="tabular text-2xs text-muted-foreground">
            {formatCount(progress.processed)}
            {progress.total ? ` / ${formatCount(progress.total)}` : ""} kayıt
          </span>
        ) : null}
      </div>

      <p className="text-2xs text-muted-foreground leading-relaxed">
        Bu işlem sırasında uygulamayı kullanmaya devam edebilirsiniz — çözümleme arka planda
        yapılıyor.
      </p>
    </div>
  );
}

export function ImportSuccess({
  sourceName,
  stats,
}: {
  sourceName: string;
  stats: { liveCount: number; vodCount: number; seriesCount: number; categoryCount: number };
}) {
  const items = [
    { label: "Canlı kanal", value: stats.liveCount },
    { label: "Film", value: stats.vodCount },
    { label: "Dizi", value: stats.seriesCount },
    { label: "Kategori", value: stats.categoryCount },
  ].filter((item) => item.value > 0);

  return (
    <div className="border-success/25 bg-success/[0.06] flex flex-col gap-4 rounded-lg border p-5">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="text-success size-5 shrink-0" />
        <p className="text-foreground text-sm font-semibold">{sourceName} eklendi</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-0.5">
            <dt className="text-2xs text-muted-foreground uppercase tracking-wide">{item.label}</dt>
            <dd className="tabular text-foreground text-lg font-semibold">
              {formatCount(item.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
