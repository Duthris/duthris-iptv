"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Film, ListVideo, Radio, RefreshCw, Tv } from "lucide-react";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  cn,
} from "@iptv/ui";

import { AppShell } from "@/components/app-shell";
import { ChannelShortcuts } from "@/components/home/channel-shortcuts";
import { daysUntilExpiry, expiryTone } from "@/components/playlist/subscription-status";
import { WelcomeHero } from "@/components/welcome-hero";
import { usePlaylistStore } from "@/stores/playlist-store";
import { useActiveProfile } from "@/stores/profile-store";
import { formatCount, formatRelative } from "@/lib/format";

function DashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-96" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
    </div>
  );
}

function LibraryCard({
  href,
  icon: Icon,
  title,
  description,
  cta,
  featured = false,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  cta: string;
  featured?: boolean;
}) {
  return (
    <Card variant={featured ? "feature" : "default"} interactive className="group">
      <Link href={href} className="block">
        <CardHeader>
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center self-start rounded-md",
              featured ? "bg-brand-500/15 text-primary" : "bg-surface-3 text-muted-foreground",
            )}
          >
            <Icon className="size-4" />
          </span>
          <CardTitle className="mt-2">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <span className="text-primary inline-flex items-center gap-1.5 text-sm font-medium">
            {cta}
            <ArrowRight className="duration-fast size-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </CardContent>
      </Link>
    </Card>
  );
}

export default function HomePage() {
  const { sources, loaded } = usePlaylistStore();
  const profile = useActiveProfile();

  const totals = React.useMemo(() => {
    return sources.reduce(
      (accumulator, source) => {
        const stats = source.stats;
        if (!stats) return accumulator;
        return {
          live: accumulator.live + stats.liveCount,
          vod: accumulator.vod + stats.vodCount,
          series: accumulator.series + stats.seriesCount,
        };
      },
      { live: 0, vod: 0, series: 0 },
    );
  }, [sources]);

  const expiringSoon = React.useMemo(
    () =>
      sources.filter((source) => {
        const tone = expiryTone(daysUntilExpiry(source.subscription));
        return tone === "warning" || tone === "expired";
      }),
    [sources],
  );

  if (!loaded) {
    return (
      <AppShell>
        <DashboardSkeleton />
      </AppShell>
    );
  }

  if (sources.length === 0) {
    return (
      <AppShell>
        <WelcomeHero />
      </AppShell>
    );
  }

  const lastRefresh = sources
    .map((source) => source.lastSuccessAt)
    .filter((value): value is number => value !== null)
    .sort((a, b) => b - a)[0];

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            {profile ? `Merhaba, ${profile.name}` : "Ana Sayfa"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {formatCount(totals.live)} canlı kanal · {formatCount(totals.vod)} film ·{" "}
            {formatCount(totals.series)} dizi
            {lastRefresh ? ` · son güncelleme ${formatRelative(lastRefresh)}` : ""}
          </p>
        </header>

        {expiringSoon.length > 0 ? (
          <Link
            href="/playlists"
            className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/[0.07] p-4 transition-colors duration-fast hover:bg-warning/[0.12]"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                {expiringSoon.length === 1
                  ? `"${expiringSoon[0]?.name}" aboneliği ${
                      daysUntilExpiry(expiringSoon[0]?.subscription ?? null)! < 0
                        ? "sona erdi"
                        : "yakında sona eriyor"
                    }`
                  : `${expiringSoon.length} kaynağın aboneliği yakında sona eriyor`}
              </span>
              <span className="text-xs text-muted-foreground">
                Ayrıntılar için Playlistler ekranına git.
              </span>
            </span>
          </Link>
        ) : null}

        <ChannelShortcuts profileId={profile?.id ?? null} />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <LibraryCard
            href="/live"
            icon={Radio}
            title="Canlı TV"
            description={`${formatCount(totals.live)} kanal, kategorilere ayrılmış hâlde hazır.`}
            cta="İzlemeye başla"
            featured
          />
          <LibraryCard
            href="/movies"
            icon={Film}
            title="Filmler"
            description={`${formatCount(totals.vod)} film. Poster görünümü, arama ve kaldığın yerden devam.`}
            cta="Kütüphaneyi aç"
          />
          <LibraryCard
            href="/series"
            icon={Tv}
            title="Diziler"
            description={`${formatCount(totals.series)} dizi. Sezon ve bölüm listesiyle.`}
            cta="Kütüphaneyi aç"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card interactive>
            <Link href="/playlists" className="block">
              <CardHeader>
                <span className="bg-surface-3 text-muted-foreground grid size-9 shrink-0 place-items-center self-start rounded-md">
                  <ListVideo className="size-4" />
                </span>
                <CardTitle className="mt-2">Playlistler</CardTitle>
                <CardDescription>
                  {sources.length} kaynak ekli. Yeni ekleyin, yenileyin veya kaldırın.
                </CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card>
            <CardHeader>
              <span className="bg-surface-3 text-muted-foreground grid size-9 shrink-0 place-items-center self-start rounded-md">
                <RefreshCw className="size-4" />
              </span>
              <CardTitle className="mt-2">Kaynak durumu</CardTitle>
              <CardDescription>Etkin kaynakların son yenileme bilgisi.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              {sources.slice(0, 4).map((source) => (
                <div key={source.id} className="flex items-center justify-between gap-3">
                  <span className="text-foreground min-w-0 truncate text-sm">{source.name}</span>
                  {source.lastError ? (
                    <Badge variant="destructive">Hata</Badge>
                  ) : source.lastSuccessAt ? (
                    <span className="text-2xs text-muted-foreground shrink-0">
                      {formatRelative(source.lastSuccessAt)}
                    </span>
                  ) : (
                    <Badge variant="outline">Bekliyor</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
