import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { tokens } from "../src/tokens.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outFile = join(here, "..", "src", "styles", "tokens.css");

const { brand, accents, darkTheme, lightTheme, radius, baseRadius, shadows, motion, gradients } =
  tokens;

function block(entries) {
  return entries.map(([name, value]) => `  --${name}: ${value};`).join("\n");
}

function themeVars(semantic, shadowSet) {
  return [
    ...Object.entries(semantic),
    ...Object.entries(shadowSet).map(([key, value]) => [`shadow-${key}`, value]),
  ];
}

const shared = [
  ...Object.entries(brand).map(([step, value]) => [`brand-${step}`, value]),
  ...Object.entries(accents).map(([name, value]) => [`accent-${name}`, value]),
  ...Object.entries(radius).map(([name, value]) => [`radius-${name}`, value]),
  ["radius", baseRadius],
  ["motion-fast", motion.fast],
  ["motion-base", motion.base],
  ["motion-slow", motion.slow],
  ["ease-brand", motion.ease],
  ["ease-brand-out", motion.easeOut],
  ["gradient-brand-text", gradients.brandText],
  ["gradient-brand-surface", gradients.brandSurface],
  ["gradient-brand-line", gradients.brandLine],
];

const css = `/* Generated from src/tokens.ts by pnpm gen:theme. Do not edit. */

:root {
${block(shared)}

${block(themeVars(lightTheme, shadows.light))}
}

.dark {
${block(themeVars(darkTheme, shadows.dark))}
}

/* Tarayıcının kendi form/scrollbar renklerini temaya uydurur. */
:root {
  color-scheme: light;
}

.dark {
  color-scheme: dark;
}
`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, css, "utf8");
console.log(`tokens.css yazıldı: ${outFile}`);
