"use client";

import * as React from "react";
import { X, Youtube } from "lucide-react";
import { Button, Spinner, cn } from "@iptv/ui";

import { getDesktopBridge } from "@/lib/platform";

/**
 * Trailer playback, kept inside the app.
 *
 * The embed rather than a browser hand-off: leaving the app for a two minute
 * clip breaks the session badly. youtube-nocookie is used because the ordinary
 * domain sets advertising cookies before anything is even played.
 *
 * On the desktop this only works because the network policy exempts YouTube
 * from the player identity it gives every other host — see security.ts.
 */
export function TrailerButton({
  trailerKey,
  title,
  className,
}: {
  trailerKey: string | null;
  title?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [src, setSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !trailerKey) {
      setSrc(null);
      return;
    }

    const bridge = getDesktopBridge();
    if (!bridge) {
      // A browser page already has a real origin of its own.
      setSrc(`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0`);
      return;
    }

    let cancelled = false;
    void bridge.trailerEmbedUrl(trailerKey).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [open, trailerKey]);

  React.useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };

    // Capture phase: the player underneath also listens for Escape.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  if (!trailerKey) return null;

  return (
    <>
      <Button variant="outline" className={className} onClick={() => setOpen(true)}>
        <Youtube /> Fragman
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title ? `${title} fragmanı` : "Fragman"}
          onClick={() => setOpen(false)}
          className={cn(
            "fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4",
            "duration-base ease-brand animate-in fade-in",
          )}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="relative w-full max-w-4xl overflow-hidden rounded-xl bg-black shadow-lg"
          >
            <div className="grid aspect-video w-full place-items-center">
              {src ? (
                <iframe
                  src={src}
                  title={title ? `${title} fragmanı` : "Fragman"}
                  allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  className="size-full border-0"
                />
              ) : (
                <Spinner />
              )}
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Kapat"
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2 bg-black/60 text-white hover:bg-black/80"
            >
              <X />
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
