"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  FileUp,
  KeyRound,
  Link2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import type {
  ParseProgress,
  PlaylistSource,
  SourceKind,
  StreamProtocolPreference,
} from "@iptv/core";
import { deleteSource, updateSource } from "@iptv/db";
import { Badge, Button, Card, EmptyState, Progress, cn } from "@iptv/ui";

import { AppShell } from "@/components/app-shell";
import { AddPlaylistForm } from "@/components/playlist/add-playlist-form";
import { SegmentedControl } from "@/components/playlist/segmented-control";
import { SubscriptionStatus } from "@/components/playlist/subscription-status";
import { importEpg, refreshSource } from "@/lib/import/import-source";
import { clearCredentialCache } from "@/lib/resolve-stream";
import { usePlaylistStore } from "@/stores/playlist-store";
import { formatCount, formatRelative } from "@/lib/format";

const KIND_META: Record<
  SourceKind,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  "m3u-url": { label: "M3U bağlantı", icon: Link2 },
  "m3u-file": { label: "M3U dosya", icon: FileUp },
  xtream: { label: "Xtream", icon: KeyRound },
};

const PROTOCOL_OPTIONS: ReadonlyArray<{ value: StreamProtocolPreference; label: string }> = [
  { value: "auto", label: "Otomatik" },
  { value: "http", label: "HTTP" },
  { value: "https", label: "HTTPS" },
];

function SourceCard({
  source,
  onChanged,
}: {
  source: PlaylistSource;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState<ParseProgress | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const meta = KIND_META[source.kind];
  const Icon = meta.icon;
  const stats = source.stats;

  async function handleRefresh() {
    setBusy(true);
    setProgress(null);
    try {
      await refreshSource(source.id, { onProgress: setProgress });
      await onChanged();
      toast.success(`${source.name} güncellendi`);
    } catch (error) {
      toast.error("Yenilenemedi", {
        description: error instanceof Error ? error.message : undefined,
      });
      await onChanged();
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function handleEpgImport() {
    const epgUrl = source.epgUrl;
    if (!epgUrl) {
      toast.error("Bu kaynak için TV rehberi adresi yok");
      return;
    }

    setBusy(true);
    setProgress(null);
    try {
      const result = await importEpg(source.id, epgUrl, { onProgress: setProgress });
      await onChanged();
      toast.success("TV rehberi güncellendi", {
        description:
          `${formatCount(result.programCount)} program · ` +
          `${formatCount(result.matchedChannels)} kanal eşleşti`,
      });
    } catch (error) {
      toast.error("TV rehberi alınamadı", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function handleProtocolChange(value: StreamProtocolPreference) {
    await updateSource(source.id, { streamProtocol: value });
    await onChanged();
    toast.success(
      value === "auto"
        ? "Yayın protokolü otomatik seçilecek"
        : `Yayın protokolü ${value.toUpperCase()} olarak ayarlandı`,
    );
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteSource(source.id);
      clearCredentialCache();
      await onChanged();
      toast.success(`${source.name} kaldırıldı`);
    } catch {
      toast.error("Kaynak silinemedi");
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <span className="bg-surface-3 text-muted-foreground grid size-9 shrink-0 place-items-center rounded-md">
          <Icon className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-md text-foreground truncate font-semibold">{source.name}</h3>
            <Badge variant="outline">{meta.label}</Badge>
            {!source.enabled ? <Badge variant="warning">Pasif</Badge> : null}
          </div>
          <p className="text-muted-foreground mt-1 truncate text-xs">
            {source.lastSuccessAt
              ? `Son güncelleme ${formatRelative(source.lastSuccessAt)}`
              : "Henüz güncellenmedi"}
          </p>
        </div>
      </div>

      {stats ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {[
            { label: "Canlı", value: stats.liveCount },
            { label: "Film", value: stats.vodCount },
            { label: "Dizi", value: stats.seriesCount },
            { label: "Kategori", value: stats.categoryCount },
          ].map((item) => (
            <div key={item.label} className="flex flex-col gap-0.5">
              <dt className="text-2xs text-muted-foreground uppercase tracking-wide">
                {item.label}
              </dt>
              <dd className="tabular text-md text-foreground font-semibold">
                {formatCount(item.value)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <SubscriptionStatus subscription={source.subscription} />

      {source.lastError ? (
        <div className="border-destructive/25 bg-destructive/[0.06] flex items-start gap-2.5 rounded-md border p-3">
          <AlertTriangle className="text-destructive mt-0.5 size-3.5 shrink-0" />
          <p className="text-foreground text-xs leading-relaxed">{source.lastError}</p>
        </div>
      ) : null}

      {busy && progress ? (
        <div className="flex flex-col gap-2">
          <Progress value={progress.ratio} label="Yenileniyor" />
          <p className="text-2xs text-muted-foreground">{progress.label}</p>
        </div>
      ) : null}

      <div className="border-border/70 bg-surface-2/50 flex flex-col gap-2 rounded-md border p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-foreground text-sm font-medium">Yayın protokolü</span>
          <SegmentedControl
            options={PROTOCOL_OPTIONS}
            value={source.streamProtocol ?? "auto"}
            onChange={handleProtocolChange}
            aria-label="Yayın protokolü"
            className="w-full sm:w-64"
          />
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Sağlayıcılar aynı yayını hem HTTP hem HTTPS üzerinden verir ve bunlar farklı sunuculara
          gider. HTTPS ucu geçersiz sertifika kullanıyorsa tarayıcı yayını açmaz; böyle bir durumda
          HTTP&apos;yi seçin.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {source.kind !== "m3u-file" ? (
          <Button variant="outline" size="sm" onClick={handleRefresh} loading={busy}>
            <RefreshCw /> Yenile
          </Button>
        ) : null}

        {source.epgUrl ? (
          <Button variant="outline" size="sm" onClick={handleEpgImport} loading={busy}>
            <CalendarClock /> TV rehberini indir
          </Button>
        ) : null}

        {confirmDelete ? (
          <>
            <Button variant="destructive" size="sm" onClick={handleDelete} loading={busy}>
              <Trash2 /> Kalıcı olarak sil
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              <X /> Vazgeç
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 /> Kaldır
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function PlaylistsPage() {
  const { sources, loaded, refresh } = usePlaylistStore();
  const [adding, setAdding] = React.useState(false);

  const showForm = adding || (loaded && sources.length === 0);

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight">Playlistler</h1>
            <p className="text-muted-foreground text-sm">
              Kaynaklarınız bu cihazda saklanır. İstediğiniz zaman ekleyip kaldırabilirsiniz.
            </p>
          </div>

          {!showForm ? (
            <Button onClick={() => setAdding(true)}>
              <Plus /> Playlist ekle
            </Button>
          ) : null}
        </header>

        {showForm ? (
          <Card variant="elevated" className="flex flex-col gap-5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-foreground text-lg font-semibold tracking-tight">
                  Yeni kaynak ekle
                </h2>
                <p className="text-muted-foreground text-sm">
                  M3U bağlantısı, M3U dosyası veya Xtream giriş bilgileriyle.
                </p>
              </div>
              {sources.length > 0 ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setAdding(false)}
                  aria-label="Kapat"
                >
                  <X />
                </Button>
              ) : null}
            </div>

            <AddPlaylistForm
              onDone={() => {
                setAdding(false);
                void refresh();
              }}
            />
          </Card>
        ) : null}

        {loaded && sources.length > 0 ? (
          <div className={cn("flex flex-col gap-4")}>
            {sources.map((source) => (
              <SourceCard key={source.id} source={source} onChanged={refresh} />
            ))}
          </div>
        ) : null}

        {loaded && sources.length === 0 && !showForm ? (
          <EmptyState
            icon={<Link2 />}
            title="Henüz kaynak yok"
            description="Bir M3U bağlantısı ya da Xtream hesabı ekleyerek başlayın."
            action={<Button onClick={() => setAdding(true)}>Playlist ekle</Button>}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
