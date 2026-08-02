"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

import { AppearanceEffects } from "@/components/appearance-effects";
import { UpdateBanner } from "@/components/update-banner";
import { useAutoRefresh } from "@/lib/auto-refresh";
import { installDesktopIntegration } from "@/lib/desktop-bootstrap";
import { useProfileStore } from "@/stores/profile-store";
import { usePlaylistStore } from "@/stores/playlist-store";

function BootstrapLocalData({ children }: { children: React.ReactNode }) {
  const initProfiles = useProfileStore((state) => state.init);
  const refreshSources = usePlaylistStore((state) => state.refresh);

  useAutoRefresh();

  React.useEffect(() => {
    let cancelled = false;

    installDesktopIntegration();
    void (async () => {
      await initProfiles();
      if (!cancelled) await refreshSources();
    })();
    return () => {
      cancelled = true;
    };
  }, [initProfiles, refreshSources]);

  return <>{children}</>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"

      defaultTheme="dark"
      enableSystem={false}
      themes={["light", "dark"]}
      disableTransitionOnChange
    >
      <AppearanceEffects />
      <UpdateBanner />
      <BootstrapLocalData>{children}</BootstrapLocalData>
      <Toaster
        position="bottom-right"

        toastOptions={{
          classNames: {
            toast:
              "!bg-popover !text-popover-foreground !border-border !shadow-lg !rounded-lg !font-sans",
            description: "!text-muted-foreground",
            actionButton: "!bg-primary !text-primary-foreground !rounded-md",
            cancelButton: "!bg-secondary !text-secondary-foreground !rounded-md",
          },
        }}
      />
    </ThemeProvider>
  );
}
