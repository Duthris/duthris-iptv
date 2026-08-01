"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button, cn } from "@iptv/ui";

export interface DetailOverlayProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;

  backdrop?: string | null;
  className?: string;
}

export function DetailOverlay({
  open,
  onClose,
  children,
  backdrop,
  className,
}: DetailOverlayProps) {
  const sheetRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown, true);
    sheetRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Kapat"
        onClick={onClose}
        className="bg-background/85 fixed inset-0 cursor-default backdrop-blur-sm"
      />

      {backdrop ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-x-0 top-0 h-80 opacity-25 blur-2xl"
          style={{
            backgroundImage: `url(${backdrop})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      ) : null}

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          "animate-fade-up relative z-10 flex max-h-full w-full max-w-4xl flex-col",
          "border-border/70 bg-card overflow-hidden rounded-xl border shadow-lg focus:outline-none",
          className,
        )}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Kapat"
          className="bg-background/60 absolute right-3 top-3 z-20 backdrop-blur-sm"
        >
          <X />
        </Button>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}
