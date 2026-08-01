export const brand = {
  50: "258 100% 98%", // #F8F5FF
  100: "258 95% 95%", // #ECE6FE
  200: "258 92% 90%", // #DACFFD
  300: "258 90% 82%", // #BDACFB
  400: "258 88% 72%", // #9C81F9
  500: "258 86% 63%", // #8050F2  ← koyu temada ana vurgu
  600: "258 78% 55%", // #6833E6  ← açık temada ana vurgu (beyaz üstünde kontrast)
  700: "258 70% 47%", // #5624CC
  800: "258 65% 38%", // #4822A0
  900: "258 60% 30%", // #3A1F7A
  950: "258 62% 16%", // #1F0F42
} as const;

export const accents = {
  violet: "258 86% 63%",
  indigo: "243 75% 62%",
  sky: "199 89% 55%",
  emerald: "160 70% 45%",
  amber: "38 92% 55%",
  rose: "347 77% 60%",
} as const;

type SemanticMap = Record<string, string>;

export const darkTheme: SemanticMap = {
  background: "258 32% 5%", // #0B0911
  foreground: "258 20% 96%", // #F6F4FA

  surface: "257 28% 8%", // #131019
  "surface-2": "257 25% 11%", // #1A1522
  "surface-3": "257 22% 15%", // #231F2E

  card: "257 28% 8%",
  "card-foreground": "258 20% 96%",
  popover: "258 30% 7%",
  "popover-foreground": "258 20% 96%",

  primary: brand[500],
  "primary-foreground": "258 40% 8%",

  secondary: "257 22% 15%",
  "secondary-foreground": "258 20% 92%",

  muted: "258 20% 14%",
  "muted-foreground": "256 14% 64%", // #9E97AD

  accent: "258 40% 18%",
  "accent-foreground": "258 90% 88%",

  destructive: "0 72% 55%",
  "destructive-foreground": "0 0% 100%",
  success: "158 64% 45%",
  "success-foreground": "158 80% 96%",
  warning: "38 92% 55%",
  "warning-foreground": "38 90% 10%",

  border: "258 20% 18%", // #2B2538
  input: "258 20% 22%",
  ring: brand[400],
};

export const lightTheme: SemanticMap = {
  background: "0 0% 100%",
  foreground: "258 40% 11%", // #171127

  surface: "0 0% 100%",
  "surface-2": "258 40% 98%", // #FAF8FD
  "surface-3": "258 35% 95.5%", // #F1EDF9

  card: "0 0% 100%",
  "card-foreground": "258 40% 11%",
  popover: "0 0% 100%",
  "popover-foreground": "258 40% 11%",

  primary: brand[600],
  "primary-foreground": "0 0% 100%",

  secondary: "258 35% 96%",
  "secondary-foreground": "258 40% 18%",

  muted: "258 35% 96.5%",
  "muted-foreground": "256 14% 44%", // #6A6180

  accent: "258 60% 95%",
  "accent-foreground": "258 70% 35%",

  destructive: "0 72% 48%",
  "destructive-foreground": "0 0% 100%",
  success: "158 70% 34%",
  "success-foreground": "0 0% 100%",
  warning: "32 90% 45%",
  "warning-foreground": "0 0% 100%",

  border: "258 30% 91%", // #E5E1EF
  input: "258 28% 88%",
  ring: brand[500],
};

export const radius = {
  none: "0px",
  sm: "6px",
  md: "10px",
  lg: "14px",
  xl: "18px",
  "2xl": "24px",
  "3xl": "32px",
  full: "9999px",
} as const;

export const baseRadius = "12px";

export const spacing = {
  "4.5": "1.125rem", // 18px — ikon+metin hizasında sık gerekiyor
  "13": "3.25rem", // 52px — liste satırı yüksekliği
  "18": "4.5rem", // 72px — üst bar
  "22": "5.5rem", // 88px
  sidebar: "17rem", // 272px — sol panel
  "sidebar-sm": "13rem", // 208px
} as const;

export const shadows = {
  dark: {
    xs: "0 1px 2px 0 hsl(258 60% 2% / 0.5)",
    sm: "0 2px 6px -1px hsl(258 60% 2% / 0.6)",
    md: "0 8px 24px -6px hsl(258 60% 2% / 0.7)",
    lg: "0 18px 48px -12px hsl(258 60% 2% / 0.8)",
    xl: "0 32px 72px -20px hsl(258 60% 2% / 0.85)",

    "glow-xs": "0 0 0 1px hsl(258 86% 63% / 0.10), 0 2px 10px -3px hsl(258 86% 63% / 0.18)",
    "glow-sm": "0 0 0 1px hsl(258 86% 63% / 0.16), 0 4px 18px -4px hsl(258 86% 63% / 0.28)",
    "glow-md": "0 0 28px -6px hsl(258 86% 63% / 0.42)",
    "glow-lg": "0 0 56px -10px hsl(258 86% 63% / 0.55)",
    inset: "inset 0 1px 0 0 hsl(258 90% 90% / 0.06)",
  },
  light: {
    xs: "0 1px 2px 0 hsl(258 30% 20% / 0.05)",
    sm: "0 2px 4px -1px hsl(258 30% 20% / 0.07), 0 1px 2px -1px hsl(258 30% 20% / 0.05)",
    md: "0 8px 20px -8px hsl(258 30% 20% / 0.14), 0 2px 6px -2px hsl(258 30% 20% / 0.07)",
    lg: "0 18px 40px -16px hsl(258 30% 20% / 0.18), 0 4px 10px -4px hsl(258 30% 20% / 0.08)",
    xl: "0 32px 64px -24px hsl(258 30% 20% / 0.22)",
    "glow-xs": "0 0 0 1px hsl(258 78% 55% / 0.08), 0 2px 8px -3px hsl(258 78% 55% / 0.12)",
    "glow-sm": "0 0 0 1px hsl(258 78% 55% / 0.12), 0 4px 14px -4px hsl(258 78% 55% / 0.16)",
    "glow-md": "0 6px 24px -8px hsl(258 78% 55% / 0.22)",
    "glow-lg": "0 12px 40px -12px hsl(258 78% 55% / 0.28)",
    inset: "inset 0 1px 0 0 hsl(0 0% 100% / 0.8)",
  },
} as const;

export const fontSizes = {
  "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.01em" }], // 11px
  xs: ["0.75rem", { lineHeight: "1.125rem", letterSpacing: "0.005em" }], // 12px
  sm: ["0.8125rem", { lineHeight: "1.25rem" }], // 13px
  base: ["0.9375rem", { lineHeight: "1.5rem" }], // 15px — gövde
  md: ["1rem", { lineHeight: "1.5rem" }], // 16px
  lg: ["1.125rem", { lineHeight: "1.6rem", letterSpacing: "-0.011em" }], // 18px
  xl: ["1.375rem", { lineHeight: "1.85rem", letterSpacing: "-0.016em" }], // 22px
  "2xl": ["1.75rem", { lineHeight: "2.15rem", letterSpacing: "-0.022em" }], // 28px
  "3xl": ["2.25rem", { lineHeight: "2.6rem", letterSpacing: "-0.028em" }], // 36px
  "4xl": ["3rem", { lineHeight: "3.25rem", letterSpacing: "-0.034em" }], // 48px
} as const;

export const motion = {
  fast: "120ms",
  base: "180ms",
  slow: "280ms",

  ease: "cubic-bezier(0.32, 0.72, 0, 1)",
  easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

export const gradients = {
  brandText: `linear-gradient(103deg, hsl(${brand[300]}) 0%, hsl(${brand[500]}) 52%, hsl(${accents.indigo}) 100%)`,
  brandSurface: `linear-gradient(160deg, hsl(${brand[500]} / 0.16) 0%, hsl(${brand[700]} / 0.05) 46%, transparent 100%)`,
  brandLine: `linear-gradient(90deg, transparent, hsl(${brand[500]} / 0.55), transparent)`,
} as const;

export const tokens = {
  brand,
  accents,
  darkTheme,
  lightTheme,
  radius,
  baseRadius,
  spacing,
  shadows,
  fontSizes,
  motion,
  gradients,
} as const;

export type Tokens = typeof tokens;
