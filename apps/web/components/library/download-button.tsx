"use client";

import * as React from "react";
import { Check, Download, Trash2, X } from "lucide-react";
import { Button, Progress, cn } from "@iptv/ui";
import { toast } from "sonner";

import { downloadsAvailable, startDownload, useDownloads } from "@/lib/downloads";
import { getDesktopBridge } from "@/lib/platform";

export interface DownloadButtonProps {
  itemId: string;
  kind: "vod" | "episode";
  title: string;
  poster?: string | null;
  /** Resolves the source stream; called only when a download actually starts. */
  resolveUrl: () => Promise<string | null>;
  className?: string;
}

/**
 * Download control for one title.
 *
 * The stream URL is resolved at the moment the user asks, not up front: it
 * carries credentials and is only needed once.
 */
export function DownloadButton({
  itemId,
  kind,
  title,
  poster,
  resolveUrl,
  className,
}: DownloadButtonProps) {
  const { byItem, refresh } = useDownloads();
  const [busy, setBusy] = React.useState(false);
  const entry = byItem.get(itemId);

  if (!downloadsAvailable()) return null;

  const begin = async () => {
    setBusy(true);
    try {
      const url = await resolveUrl();
      if (!url) {
        toast.error("Yayın adresi çözülemedi");
        return;
      }
      await startDownload({ url, title, poster, kind, itemId });
      toast.success("İndirme başladı", {
        description: "Dönüştürme sürüyor; ilerlemeyi Kitaplığım › İndirilenler'den izleyebilirsin.",
      });
    } catch {
      toast.error("İndirme başlatılamadı");
    } finally {
      setBusy(false);
    }
  };

  if (entry?.status === "downloading") {
    return (
      <div className={cn("flex min-w-40 flex-col gap-1.5", className)}>
        <Progress value={entry.progress} label={`İndiriliyor · %${Math.round(entry.progress * 100)}`} />
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={async () => {
            await getDesktopBridge()?.cancelDownload(entry.id);
            refresh();
          }}
        >
          <X /> Vazgeç
        </Button>
      </div>
    );
  }

  if (entry?.status === "done") {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn("text-muted-foreground hover:text-destructive", className)}
        onClick={async () => {
          await getDesktopBridge()?.removeDownload(entry.id);
          refresh();
          toast.success("İndirme silindi");
        }}
      >
        <Check className="text-primary" /> İndirildi
        <Trash2 />
      </Button>
    );
  }

  return (
    <Button variant="outline" loading={busy} onClick={begin} className={className}>
      <Download /> İndir
    </Button>
  );
}
