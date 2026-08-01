"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, cn } from "@iptv/ui";

export interface DayPickerProps {
  offset: number;
  onChange: (offset: number) => void;

  min: number;
  max: number;

  labelFor: (offset: number) => string;
}

export function DayPicker({ offset, onChange, min, max, labelFor }: DayPickerProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const days: number[] = [];
  for (let day = min; day <= max; day++) days.push(day);

  return (
    <div ref={rootRef} className="relative flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onChange(offset - 1)}
        aria-label="Önceki gün"
        disabled={offset <= min}
      >
        <ChevronLeft />
      </Button>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "text-foreground min-w-28 rounded-md px-2 py-1 text-sm font-medium",
          "duration-fast hover:bg-accent/40 transition-colors",
          "focus-visible:ring-ring/70 focus-visible:outline-none focus-visible:ring-2",
        )}
      >
        {labelFor(offset)}
      </button>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onChange(offset + 1)}
        aria-label="Sonraki gün"
        disabled={offset >= max}
      >
        <ChevronRight />
      </Button>

      {open ? (
        <ul
          role="listbox"
          className={cn(
            "absolute right-0 top-full z-40 mt-1 max-h-72 w-52 overflow-y-auto rounded-lg p-1",
            "border-border/70 bg-surface-1 border shadow-lg",
          )}
        >
          {days.map((day) => (
            <li key={day}>
              <button
                type="button"
                role="option"
                aria-selected={day === offset}
                onClick={() => {
                  onChange(day);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                  "duration-fast transition-colors",
                  day === offset
                    ? "bg-accent/60 text-foreground"
                    : "text-muted-foreground hover:bg-accent/35 hover:text-foreground",
                )}
              >
                {labelFor(day)}
                {day === 0 ? <span className="text-2xs text-muted-foreground">bugün</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
