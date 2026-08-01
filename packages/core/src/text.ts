const FANCY_LETTERS: Record<string, string> = {
  ᴬ: "A",
  ᴮ: "B",
  ᶜ: "C",
  ᴰ: "D",
  ᴱ: "E",
  ᶠ: "F",
  ᴳ: "G",
  ᴴ: "H",
  ᴵ: "I",
  ᴶ: "J",
  ᴷ: "K",
  ᴸ: "L",
  ᴹ: "M",
  ᴺ: "N",
  ᴼ: "O",
  ᴾ: "P",
  ᴿ: "R",
  ˢ: "S",
  ᵀ: "T",
  ᵁ: "U",
  ⱽ: "V",
  ᵂ: "W",
  ˣ: "X",
  ʸ: "Y",
  ᶻ: "Z",
  ᵃ: "A",
  ᵇ: "B",
  ᵈ: "D",
  ᵉ: "E",
  ᶢ: "G",
  ʰ: "H",
  ⁱ: "I",
  ʲ: "J",
  ᵏ: "K",
  ˡ: "L",
  ᵐ: "M",
  ⁿ: "N",
  ᵒ: "O",
  ᵖ: "P",
  ʳ: "R",
  ᵗ: "T",
  ᵘ: "U",
  ᵛ: "V",

  ᴀ: "A",
  ʙ: "B",
  ᴄ: "C",
  ᴅ: "D",
  ᴇ: "E",
  ғ: "F",
  ɢ: "G",
  ʜ: "H",
  ɪ: "I",
  ᴊ: "J",
  ᴋ: "K",
  ʟ: "L",
  ᴍ: "M",
  ɴ: "N",
  ᴏ: "O",
  ᴘ: "P",
  ǫ: "Q",
  ʀ: "R",
  ꜱ: "S",
  ᴛ: "T",
  ᴜ: "U",
  ᴠ: "V",
  ᴡ: "W",
  ʏ: "Y",
  ᴢ: "Z",

  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
};

const FANCY_RE = new RegExp(`[${Object.keys(FANCY_LETTERS).join("")}]`, "g");

const TR_MAP: Record<string, string> = {
  ı: "i",
  İ: "i",
  ş: "s",
  Ş: "s",
  ğ: "g",
  Ğ: "g",
  ü: "u",
  Ü: "u",
  ö: "o",
  Ö: "o",
  ç: "c",
  Ç: "c",
};

const TR_RE = /[ıİşŞğĞüÜöÖçÇ]/g;

const COMBINING_MARKS_RE = new RegExp("[\\u0300-\\u036f]", "g");

const NOISE_TOKENS = new Set([
  "hd",
  "sd",
  "fhd",
  "uhd",
  "4k",
  "8k",
  "hq",
  "lq",
  "hevc",
  "h265",
  "h264",
  "raw",
  "backup",
  "buffer",
  "alt",
  "opt",
  "vip",
  "plus",
  "multi",
  "audio",
  "1080p",
  "1080",
  "720p",
  "720",
  "480p",
  "480",
  "2160p",
  "60fps",
  "50fps",
]);

const SYMBOL_RE = /[▱▰●○◆◇■□★☆♦▶►▪▫•|/\\_~`^*+=<>[\]{}()"'‚„“”‘’«»–—-]+/g;

export function cleanDisplayName(raw: string): string {
  return raw
    .replace(FANCY_RE, (ch) => FANCY_LETTERS[ch] ?? ch)
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeForSearch(raw: string): string {
  return raw
    .replace(FANCY_RE, (ch) => FANCY_LETTERS[ch] ?? ch)
    .replace(TR_RE, (ch) => TR_MAP[ch] ?? ch)
    .normalize("NFD")
    .replace(COMBINING_MARKS_RE, "")
    .toLowerCase()
    .replace(SYMBOL_RE, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function epgMatchKey(raw: string): string {
  const normalized = normalizeForSearch(raw);
  const kept = normalized
    .split(" ")
    .filter((token) => token.length > 0 && !NOISE_TOKENS.has(token));

  if (kept.length > 1 && kept[0] && kept[0].length <= 3 && /^[a-z]+$/.test(kept[0])) {
    kept.shift();
  }
  return kept.join("");
}

const MAX_TOKENS = 8;

export function searchTokens(raw: string): string[] {
  const normalized = normalizeForSearch(raw);
  if (!normalized) return [];
  const seen = new Set<string>();
  for (const token of normalized.split(" ")) {
    if (token.length < 2) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    if (seen.size >= MAX_TOKENS) break;
  }
  return Array.from(seen);
}

const ADULT_PATTERNS =
  /\b(xxx|adults?|porn\w*|erotic|erotik|18\+|sex|sexy|playboy|brazzers|hustler|penthouse|dorcel|vixen|blacked|onlyfans|hentai|yetiskin|yetişkin)\b/i;

export function looksAdult(name: string): boolean {
  return ADULT_PATTERNS.test(name) || ADULT_PATTERNS.test(normalizeForSearch(name));
}

export function decodeXmlEntities(input: string): string {
  if (input.indexOf("&") === -1) return input;
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    switch (entity) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      case "apos":
        return "'";
      case "nbsp":
        return " ";
      default:
        break;
    }
    if (entity.charAt(0) === "#") {
      const isHex = entity.charAt(1) === "x" || entity.charAt(1) === "X";
      const code = parseInt(isHex ? entity.slice(2) : entity.slice(1), isHex ? 16 : 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        return String.fromCodePoint(code);
      }
    }
    return match;
  });
}
