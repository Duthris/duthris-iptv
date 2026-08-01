"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "../lib/cn.js";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, icon, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      {icon ? (
        <span className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center [&_svg]:size-4">
          {icon}
        </span>
      ) : null}

      <select
        ref={ref}
        className={cn(
          "border-input bg-surface-2 text-foreground h-9 w-full appearance-none rounded-md border pr-9 text-sm",
          "duration-fast ease-brand transition-[border-color,box-shadow]",
          "focus-visible:border-brand-500 focus-visible:ring-brand-500/25 focus-visible:outline-none focus-visible:ring-[3px]",
          "disabled:cursor-not-allowed disabled:opacity-55",
          icon ? "pl-9" : "pl-3",
          className,
        )}
        {...props}
      >
        {children}
      </select>

      <ChevronDown className="text-muted-foreground pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2" />
    </div>
  );
});
