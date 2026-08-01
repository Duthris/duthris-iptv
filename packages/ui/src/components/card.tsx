"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn.js";

const cardVariants = cva("rounded-lg border transition-all duration-base ease-brand", {
  variants: {
    variant: {
      default: "border-border bg-card shadow-xs",
      elevated: "border-border/70 bg-surface-2 shadow-md",

      feature: "border-brand-500/20 bg-card bg-brand-surface shadow-glow-xs",
      ghost: "border-transparent bg-transparent",
    },
    interactive: {
      true: "cursor-pointer hover:-translate-y-px hover:border-brand-500/40 hover:shadow-glow-sm",
      false: "",
    },
  },
  defaultVariants: {
    variant: "default",
    interactive: false,
  },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant, interactive, ...props },
  ref,
) {
  return (
    <div ref={ref} className={cn(cardVariants({ variant, interactive }), className)} {...props} />
  );
});

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return <div ref={ref} className={cn("flex flex-col gap-1.5 p-5", className)} {...props} />;
  },
);

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(function CardTitle({ className, ...props }, ref) {
  return (
    <h3
      ref={ref}
      className={cn("text-foreground text-lg font-semibold leading-tight", className)}
      {...props}
    />
  );
});

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...props }, ref) {
  return <p ref={ref} className={cn("text-muted-foreground text-sm", className)} {...props} />;
});

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />;
  },
);

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div ref={ref} className={cn("flex items-center gap-3 p-5 pt-0", className)} {...props} />
    );
  },
);

export { cardVariants };
