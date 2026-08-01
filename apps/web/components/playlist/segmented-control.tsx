"use client";

import * as React from "react";
import { cn } from "@iptv/ui";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const next = options[(activeIndex + delta + options.length) % options.length];
    if (next) onChange(next.value);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn(
        "border-border/70 bg-surface-2/60 relative grid gap-1 rounded-lg border p-1",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="bg-card shadow-glow-xs duration-base ease-brand absolute inset-y-1 rounded-md transition-transform"
        style={{
          width: `calc((100% - 0.5rem - ${(options.length - 1) * 0.25}rem) / ${options.length})`,
          left: "0.25rem",
          transform: `translateX(calc(${activeIndex} * (100% + 0.25rem)))`,
        }}
      />

      {options.map((option) => {
        const Icon = option.icon;
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative z-10 flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium",
              "duration-fast ease-brand focus-visible:ring-ring/70 transition-colors focus-visible:outline-none focus-visible:ring-2",
              selected ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon ? <Icon className={cn("size-4", selected && "text-primary")} /> : null}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
