"use client";

import * as React from "react";

import { cn } from "../lib/cn.js";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, icon, invalid = false, type = "text", ...props },
  ref,
) {
  const field = (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        "bg-surface-2 text-foreground h-10 w-full rounded-md border px-3 text-base",
        "duration-fast ease-brand transition-[border-color,box-shadow]",
        "placeholder:text-muted-foreground/70",
        "focus-visible:border-brand-500 focus-visible:ring-brand-500/25 focus-visible:outline-none focus-visible:ring-[3px]",
        "disabled:cursor-not-allowed disabled:opacity-55",
        invalid
          ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/25"
          : "border-input",
        icon ? "pl-10" : null,
        className,
      )}
      {...props}
    />
  );

  if (!icon) return field;

  return (
    <div className="relative">
      <span className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center [&_svg]:size-4">
        {icon}
      </span>
      {field}
    </div>
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid = false, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "bg-surface-2 text-foreground min-h-24 w-full rounded-md border px-3 py-2.5 text-base",
        "duration-fast ease-brand transition-[border-color,box-shadow]",
        "placeholder:text-muted-foreground/70",
        "focus-visible:border-brand-500 focus-visible:ring-brand-500/25 focus-visible:outline-none focus-visible:ring-[3px]",
        "disabled:cursor-not-allowed disabled:opacity-55",
        invalid ? "border-destructive" : "border-input",
        className,
      )}
      {...props}
    />
  );
});

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(function Label({ className, ...props }, ref) {
  return (
    <label
      ref={ref}
      className={cn("text-foreground text-sm font-medium leading-none", className)}
      {...props}
    />
  );
});

export function FieldHint({
  children,
  error = false,
  className,
}: {
  children: React.ReactNode;
  error?: boolean;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p
      role={error ? "alert" : undefined}
      className={cn(
        "text-xs leading-relaxed",
        error ? "text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
