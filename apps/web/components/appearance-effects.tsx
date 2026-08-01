"use client";

import * as React from "react";

import { useSettingsStore } from "@/stores/settings-store";

export function AppearanceEffects() {
  const fontScale = useSettingsStore((state) => state.fontScale);
  const highContrast = useSettingsStore((state) => state.highContrast);

  React.useEffect(() => {
    const root = document.documentElement;

    root.style.fontSize = fontScale === 1 ? "" : `${16 * fontScale}px`;
    return () => {
      root.style.fontSize = "";
    };
  }, [fontScale]);

  React.useEffect(() => {
    const root = document.documentElement;
    if (highContrast) root.setAttribute("data-contrast", "high");
    else root.removeAttribute("data-contrast");
    return () => root.removeAttribute("data-contrast");
  }, [highContrast]);

  return null;
}
