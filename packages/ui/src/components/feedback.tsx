"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { cn } from "../lib/cn.js";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("bg-surface-3 relative overflow-hidden rounded-md", className)} {...props}>
      <div className="animate-shimmer via-foreground/[0.06] absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent to-transparent" />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2 className={cn("text-muted-foreground size-4 animate-spin", className)} aria-hidden />
  );
}

export interface ProgressProps {
  value: number | null;
  className?: string;
  label?: string;
}

export function Progress({ value, className, label }: ProgressProps) {
  const clamped = value === null ? null : Math.min(1, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped === null ? undefined : Math.round(clamped * 100)}
      aria-label={label}
      className={cn("bg-surface-3 h-1.5 w-full overflow-hidden rounded-full", className)}
    >
      <div
        className={cn(
          "bg-primary duration-slow ease-brand-out h-full rounded-full transition-[width]",
          clamped === null && "animate-pulse-glow w-1/3",
        )}
        style={clamped === null ? undefined : { width: `${clamped * 100}%` }}
      />
    </div>
  );
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-16 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="bg-surface-3 text-muted-foreground flex size-12 items-center justify-center rounded-full [&_svg]:size-5">
          {icon}
        </div>
      ) : null}
      <div className="flex max-w-sm flex-col gap-1.5">
        <p className="text-md text-foreground font-semibold">{title}</p>
        {description ? (
          <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
