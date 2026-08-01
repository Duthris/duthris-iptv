"use client";

import * as React from "react";
import { cn } from "@iptv/ui";

export interface ChannelNumberEntryProps {
  digits: string;

  notFound?: boolean;
}

export function ChannelNumberEntry({ digits, notFound = false }: ChannelNumberEntryProps) {
  if (!digits) return null;

  return (
    <div className="pointer-events-none absolute left-1/2 top-8 z-30 -translate-x-1/2">
      <div
        className={cn(
          "flex flex-col items-center gap-1 rounded-lg px-5 py-3",
          "border border-white/15 bg-black/80 backdrop-blur-sm",
        )}
      >
        <span className="tabular text-3xl font-semibold leading-none tracking-wider text-white">
          {digits}
        </span>
        <span className="text-2xs text-white/50">
          {notFound ? "Kanal bulunamadı" : "Kanal numarası"}
        </span>
      </div>
    </div>
  );
}
