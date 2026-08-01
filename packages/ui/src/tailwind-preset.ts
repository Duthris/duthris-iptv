import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

import { fontSizes, radius, spacing } from "./tokens.js";

function hsl(variable: string): string {
  return `hsl(var(--${variable}) / <alpha-value>)`;
}

const brandScale = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => [
    String(step),
    hsl(`brand-${step}`),
  ]),
);

export const preset = {
  darkMode: ["class"] as ["class"],
  content: [],
  theme: {
    extend: {
      colors: {
        border: hsl("border"),
        input: hsl("input"),
        ring: hsl("ring"),
        background: hsl("background"),
        foreground: hsl("foreground"),

        surface: {
          DEFAULT: hsl("surface"),
          2: hsl("surface-2"),
          3: hsl("surface-3"),
        },

        brand: brandScale,

        primary: {
          DEFAULT: hsl("primary"),
          foreground: hsl("primary-foreground"),
        },
        secondary: {
          DEFAULT: hsl("secondary"),
          foreground: hsl("secondary-foreground"),
        },
        muted: {
          DEFAULT: hsl("muted"),
          foreground: hsl("muted-foreground"),
        },
        accent: {
          DEFAULT: hsl("accent"),
          foreground: hsl("accent-foreground"),
        },
        destructive: {
          DEFAULT: hsl("destructive"),
          foreground: hsl("destructive-foreground"),
        },
        success: {
          DEFAULT: hsl("success"),
          foreground: hsl("success-foreground"),
        },
        warning: {
          DEFAULT: hsl("warning"),
          foreground: hsl("warning-foreground"),
        },
        card: {
          DEFAULT: hsl("card"),
          foreground: hsl("card-foreground"),
        },
        popover: {
          DEFAULT: hsl("popover"),
          foreground: hsl("popover-foreground"),
        },
      },

      borderRadius: {
        none: radius.none,
        sm: radius.sm,
        DEFAULT: radius.md,
        md: radius.md,
        lg: radius.lg,
        xl: radius.xl,
        "2xl": radius["2xl"],
        "3xl": radius["3xl"],
        full: radius.full,
      },

      spacing,

      fontSize: fontSizes as unknown as Record<string, [string, Record<string, string>]>,

      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },

      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "glow-xs": "var(--shadow-glow-xs)",
        "glow-sm": "var(--shadow-glow-sm)",
        "glow-md": "var(--shadow-glow-md)",
        "glow-lg": "var(--shadow-glow-lg)",
        inset: "var(--shadow-inset)",
        none: "none",
      },

      backgroundImage: {
        "brand-text": "var(--gradient-brand-text)",
        "brand-surface": "var(--gradient-brand-surface)",
        "brand-line": "var(--gradient-brand-line)",
      },

      transitionTimingFunction: {
        brand: "var(--ease-brand)",
        "brand-out": "var(--ease-brand-out)",
      },

      transitionDuration: {
        fast: "var(--motion-fast)",
        base: "var(--motion-base)",
        slow: "var(--motion-slow)",
      },

      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "0.8" },
        },
      },

      animation: {
        "fade-in": "fade-in var(--motion-base) var(--ease-brand-out) both",
        "fade-up": "fade-up var(--motion-slow) var(--ease-brand-out) both",
        "scale-in": "scale-in var(--motion-base) var(--ease-brand-out) both",
        shimmer: "shimmer 1.8s infinite",
        "pulse-glow": "pulse-glow 4s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
} satisfies Omit<Config, "content"> & { content: [] };

export default preset;
