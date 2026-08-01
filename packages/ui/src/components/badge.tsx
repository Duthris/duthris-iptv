"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn.js";

const badgeVariants = cva(
  "inline-flex h-5 items-center gap-1 rounded-full px-2 text-2xs font-medium leading-none [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        brand: "bg-brand-500/15 text-brand-300 ring-1 ring-inset ring-brand-500/25",
        outline: "border border-border text-muted-foreground",
        success: "bg-success/15 text-success ring-1 ring-inset ring-success/25",
        warning: "bg-warning/15 text-warning ring-1 ring-inset ring-warning/25",
        destructive: "bg-destructive/15 text-destructive ring-1 ring-inset ring-destructive/25",

        live: "bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex size-1.5", className)}>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
      <span className="relative inline-flex size-1.5 rounded-full bg-current" />
    </span>
  );
}

export { badgeVariants };
