"use client";

import * as React from "react";

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: "release", listener: () => void) => void;
}

interface WakeLockNavigator {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
}

export function isWakeLockSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return typeof (navigator as WakeLockNavigator).wakeLock?.request === "function";
}

export function useWakeLock(active: boolean): void {
  const sentinelRef = React.useRef<WakeLockSentinelLike | null>(null);

  React.useEffect(() => {
    if (!active || !isWakeLockSupported()) return;

    let cancelled = false;

    const acquire = async () => {
      if (cancelled || sentinelRef.current) return;
      if (document.visibilityState !== "visible") return;

      try {
        const sentinel = await (navigator as WakeLockNavigator).wakeLock!.request("screen");
        if (cancelled) {
          void sentinel.release().catch(() => undefined);
          return;
        }
        sentinelRef.current = sentinel;

        sentinel.addEventListener("release", () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
        });
      } catch {
        // Denied (battery saver, unsupported surface) — not worth surfacing.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel && !sentinel.released) void sentinel.release().catch(() => undefined);
    };
  }, [active]);
}
