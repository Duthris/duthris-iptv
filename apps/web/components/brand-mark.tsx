import { cn } from "@iptv/ui";

export function BrandMark({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const box = size === "sm" ? "size-7" : size === "lg" ? "size-11" : "size-9";
  const radius = size === "lg" ? "rounded-xl" : "rounded-lg";

  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden",
        box,
        radius,
        "from-brand-400 via-brand-500 to-brand-700 bg-gradient-to-br",
        "shadow-glow-sm ring-1 ring-inset ring-white/15",
        className,
      )}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={size === "lg" ? "size-6" : size === "sm" ? "size-4" : "size-5"}
      >
        <path
          d="M5.5 8.6a8.6 8.6 0 0 1 0 6.8M18.5 8.6a8.6 8.6 0 0 0 0 6.8"
          stroke="white"
          strokeOpacity="0.85"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path d="M10.4 9.1 15 12l-4.6 2.9V9.1Z" fill="white" />
      </svg>
    </span>
  );
}

export function BrandLockup({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <div className="flex flex-col leading-none">
        <span className="text-md text-foreground font-semibold tracking-tight">Duthris</span>
        <span className="text-2xs text-muted-foreground mt-1 font-medium uppercase tracking-[0.14em]">
          IPTV
        </span>
      </div>
    </div>
  );
}
