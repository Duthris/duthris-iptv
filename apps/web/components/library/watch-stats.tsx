"use client";

import * as React from "react";
import { BarChart3, CheckCheck, Clock, Radio } from "lucide-react";
import { getWatchStats, type WatchStats } from "@iptv/db";
import { Card, EmptyState, Skeleton, cn } from "@iptv/ui";

import { formatCount, formatRelative, initialsOf } from "@/lib/format";

function hours(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} dk`;
  const value = seconds / 3600;
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} sa`;
}

function Tile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="flex items-center gap-1.5 text-2xs uppercase tracking-wide text-muted-foreground">
        <span className="[&_svg]:size-3.5">{icon}</span>
        {label}
      </span>
      <span className="tabular text-xl font-semibold text-foreground">{value}</span>
      {hint ? <span className="text-2xs text-muted-foreground">{hint}</span> : null}
    </Card>
  );
}

function Breakdown({ stats }: { stats: WatchStats }) {
  const parts = [
    { label: "Canlı TV", secs: stats.liveSecs, className: "bg-brand-500" },
    { label: "Filmler", secs: stats.vodSecs, className: "bg-emerald-500" },
    { label: "Diziler", secs: stats.seriesSecs, className: "bg-amber-500" },
  ].filter((part) => part.secs > 0);

  if (parts.length === 0) return null;
  const total = parts.reduce((sum, part) => sum + part.secs, 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-3">
        {parts.map((part) => (
          <span
            key={part.label}
            className={cn("h-full", part.className)}
            style={{ width: `${(part.secs / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((part) => (
          <span key={part.label} className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <span className={cn("size-2 rounded-full", part.className)} />
            {part.label} · {hours(part.secs)}
          </span>
        ))}
      </div>
    </div>
  );
}

function TopList({
  title,
  rows,
}: {
  title: string;
  rows: WatchStats["topChannels"];
}) {
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ol className="flex flex-col gap-1.5">
        {rows.map((row, index) => (
          <li
            key={row.id}
            className="flex items-center gap-3 rounded-md border border-border/70 bg-card p-2.5"
          >
            <span className="tabular w-4 shrink-0 text-center text-2xs text-muted-foreground">
              {index + 1}
            </span>
            <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded bg-surface-3 text-2xs font-semibold text-muted-foreground">
              {row.poster ? (
                <img src={row.poster} alt="" loading="lazy" className="size-full object-contain" />
              ) : (
                initialsOf(row.title)
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{row.title}</span>
            <span className="tabular shrink-0 text-2xs text-muted-foreground">
              {hours(row.totalSecs ?? 0)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function WatchStatsPanel({ profileId }: { profileId: string | null }) {
  const [stats, setStats] = React.useState<WatchStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!profileId) return;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      const result = await getWatchStats(profileId);
      if (cancelled) return;
      setStats(result);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!stats || stats.itemCount === 0) {
    return (
      <EmptyState
        icon={<BarChart3 />}
        title="Henüz istatistik yok"
        description="Bir şeyler izlemeye başladığında toplam süre, en çok izlediğin kanallar ve yarım kalanlar burada birikir."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          icon={<Clock />}
          label="Toplam izleme"
          value={hours(stats.totalSecs)}
          hint={
            stats.firstWatchedAt ? `${formatRelative(stats.firstWatchedAt)} beri` : undefined
          }
        />
        <Tile icon={<Radio />} label="Canlı TV" value={hours(stats.liveSecs)} />
        <Tile
          icon={<CheckCheck />}
          label="Tamamlanan"
          value={formatCount(stats.completedCount)}
          hint={`${formatCount(stats.unfinishedCount)} yarım kalan`}
        />
        <Tile
          icon={<BarChart3 />}
          label="İzlenen içerik"
          value={formatCount(stats.itemCount)}
        />
      </div>

      <Breakdown stats={stats} />

      <div className="grid gap-6 lg:grid-cols-2">
        <TopList title="En çok izlenen kanallar" rows={stats.topChannels} />
        <TopList title="En çok izlenen film ve diziler" rows={stats.topTitles} />
      </div>
    </div>
  );
}
