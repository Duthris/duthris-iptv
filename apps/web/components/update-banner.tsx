"use client";

import * as React from "react";
import { ArrowUpCircle, Download, RefreshCw } from "lucide-react";
import { Button, Progress, cn } from "@iptv/ui";

import { useUpdater } from "@/lib/use-updater";

/**
 * Update prompt.
 *
 * Only appears once there is something to act on, so the normal case is that
 * nothing is shown at all. Dismissing hides it for the session rather than
 * permanently — the next launch checks again, and an update worth installing
 * should keep asking.
 */
export function UpdateBanner() {
  const { state, install, download } = useUpdater();
  const [dismissed, setDismissed] = React.useState(false);

  const actionable =
    state.status === "available" || state.status === "downloading" || state.status === "ready";

  if (!actionable || dismissed) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2",
        "rounded-lg border border-brand-500/40 bg-surface-1/95 p-4 shadow-lg backdrop-blur",
      )}
    >
      <div className="flex items-start gap-3">
        <ArrowUpCircle className="mt-0.5 size-4 shrink-0 text-primary" />

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {state.status === "available" ? (
            <>
              <p className="text-sm font-medium text-foreground">
                Yeni sürüm hazır — {state.version}
              </p>
              <p className="text-xs text-muted-foreground">
                İndirip yeniden başlattığında güncellenir. Verilerin ve ayarların korunur.
              </p>
              <div className="flex flex-wrap gap-2 pt-0.5">
                <Button size="sm" onClick={download}>
                  <Download /> İndir
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
                  Sonra
                </Button>
              </div>
            </>
          ) : state.status === "downloading" ? (
            <>
              <p className="text-sm font-medium text-foreground">Güncelleme indiriliyor</p>
              <Progress value={state.percent / 100} label={`%${state.percent}`} />
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                {state.status === "ready" ? `${state.version} kurulmaya hazır` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Uygulama kapanıp kurulum açılacak. İmzasız olduğu için Windows bir uyarı
                gösterebilir.
              </p>
              <div className="flex flex-wrap gap-2 pt-0.5">
                <Button size="sm" onClick={install}>
                  <RefreshCw /> Yeniden başlat ve kur
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
                  Çıkışta kurulsun
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
