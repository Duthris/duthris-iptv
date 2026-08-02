"use client";

import * as React from "react";
import { AlertTriangle, Check, Download, Trash2, X } from "lucide-react";
import { Badge, Button, EmptyState, Progress, cn } from "@iptv/ui";
import { toast } from "sonner";

import { downloadsAvailable, useDownloads } from "@/lib/downloads";
import { getDesktopBridge, type DownloadEntry } from "@/lib/platform";
import { formatDuration, initialsOf } from "@/lib/format";

function size(bytes: number): string {
  if (bytes <= 0) return "—";
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

function Row({
  entry,
  onOpen,
  onChanged,
}: {
  entry: DownloadEntry;
  onOpen: (entry: DownloadEntry) => void;
  onChanged: () => void;
}) {
  const [failed, setFailed] = React.useState(false);
  const done = entry.status === "done";

  return (
    <div className="flex items-center gap-3.5 rounded-lg border border-border/70 bg-card p-3">
      {entry.poster && !failed ? (
        <img
          src={entry.poster}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-16 w-11 shrink-0 rounded-md bg-surface-3 object-cover"
        />
      ) : (
        <span className="grid h-16 w-11 shrink-0 place-items-center rounded-md bg-surface-3 text-2xs font-semibold text-muted-foreground">
          {initialsOf(entry.title)}
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 truncate text-sm font-medium text-foreground">
            {entry.title}
          </span>
          {done ? (
            <Badge variant="brand">
              <Check /> Hazır
            </Badge>
          ) : entry.status === "downloading" ? (
            <Badge variant="outline">Dönüştürülüyor</Badge>
          ) : (
            <Badge variant="destructive">
              <AlertTriangle /> Başarısız
            </Badge>
          )}
        </div>

        {/* The controls share this line rather than being centred against the
            whole card, where they would float between the two rows. */}
        <div className="flex items-center gap-2.5">
          {entry.status === "downloading" ? (
            <>
              <Progress
                value={entry.progress}
                label={`%${Math.round(entry.progress * 100)}`}
                className="min-w-0 flex-1"
              />
              <span className="tabular text-2xs text-muted-foreground shrink-0">
                %{Math.round(entry.progress * 100)}
              </span>
            </>
          ) : (
            <span className="tabular text-2xs text-muted-foreground min-w-0 flex-1 truncate">
              {done ? size(entry.bytes) : (entry.error ?? "")}
              {done && entry.durationSecs ? ` · ${formatDuration(entry.durationSecs)}` : ""}
            </span>
          )}

          <div className="flex shrink-0 items-center gap-1">
            {done ? (
              <Button size="sm" onClick={() => onOpen(entry)}>
                İzle
              </Button>
            ) : entry.status === "downloading" ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Vazgeç"
                onClick={async () => {
                  await getDesktopBridge()?.cancelDownload(entry.id);
                  onChanged();
                }}
              >
                <X />
              </Button>
            ) : null}

            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Sil"
              className="text-muted-foreground hover:text-destructive"
              onClick={async () => {
                await getDesktopBridge()?.removeDownload(entry.id);
                onChanged();
                toast.success("İndirme silindi");
              }}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DownloadsPanel({
  onOpen,
}: {
  onOpen: (entry: DownloadEntry) => void;
}) {
  const { entries, refresh } = useDownloads();

  if (!downloadsAvailable()) {
    return (
      <EmptyState
        icon={<Download />}
        title="İndirme yalnızca masaüstünde"
        description="Dosyalar diske yazıldığı ve dönüştürme ffmpeg ile yapıldığı için tarayıcıda çalışmıyor."
      />
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Download />}
        title="İndirilen içerik yok"
        description="Bir film veya bölüm sayfasındaki İndir düğmesiyle çevrimdışı izlemek üzere kopyalayabilirsin."
      />
    );
  }

  return (
    <div className={cn("flex flex-col gap-3")}>
      {entries.map((entry) => (
        <Row key={entry.id} entry={entry} onOpen={onOpen} onChanged={refresh} />
      ))}
    </div>
  );
}
