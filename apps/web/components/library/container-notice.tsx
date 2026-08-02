"use client";

import { FileWarning } from "lucide-react";
import { isDirectPlayContainer } from "@iptv/core";

import { isDesktop } from "@/lib/platform";

export function isBrowserPlayableContainer(container: string | null): boolean {
  // The desktop build transcodes, so nothing is off limits there.
  if (isDesktop()) return true;
  return isDirectPlayContainer(container);
}

export function UnsupportedContainerNotice({ container }: { container: string | null }) {
  const label = (container ?? "bu").replace(/^\./, "").toUpperCase();

  return (
    <div className="border-warning/25 bg-warning/[0.07] flex items-start gap-3 rounded-lg border p-4">
      <FileWarning className="text-warning mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-1">
        <p className="text-foreground text-sm font-medium">
          {label} biçimi bu sürümde oynatılamıyor
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Chromium tabanlı oynatıcılar MKV/AVI kapsayıcılarını çözemiyor — bu, hem tarayıcı hem
          Windows uygulaması için geçerli. Bu içerikleri açabilmek için mpv motoru eklenecek; o
          zamana kadar MP4 içerikler sorunsuz oynuyor.
        </p>
      </div>
    </div>
  );
}
