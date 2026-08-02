"use client";

import { Youtube } from "lucide-react";
import { Button } from "@iptv/ui";

import { getDesktopBridge } from "@/lib/platform";

/**
 * Opens the trailer outside the app.
 *
 * Embedding YouTube would mean loading their player and its trackers inside a
 * window that holds the user's playlist credentials, and the network policy
 * blocks it anyway. The browser is both safer and what people expect.
 */
export function TrailerButton({
  trailerKey,
  className,
}: {
  trailerKey: string | null;
  className?: string;
}) {
  if (!trailerKey) return null;

  const url = `https://www.youtube.com/watch?v=${trailerKey}`;

  return (
    <Button
      variant="outline"
      className={className}
      onClick={() => {
        const bridge = getDesktopBridge();
        if (bridge) void bridge.openExternal(url);
        else window.open(url, "_blank", "noopener,noreferrer");
      }}
    >
      <Youtube /> Fragman
    </Button>
  );
}
