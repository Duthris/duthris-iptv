"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@iptv/ui";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  const label = !mounted ? "Temayı değiştir" : isDark ? "Açık temaya geç" : "Koyu temaya geç";

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
    >
      {mounted ? (
        isDark ? (
          <Sun className="animate-scale-in" />
        ) : (
          <Moon className="animate-scale-in" />
        )
      ) : (
        <span className="size-4" />
      )}
    </Button>
  );
}
