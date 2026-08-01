export function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function asRequiredString(value: unknown, fallback: string): string {
  return asString(value) ?? fallback;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function asInt(value: unknown): number | null {
  const parsed = asNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

export function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    return lowered === "1" || lowered === "true" || lowered === "yes";
  }
  return false;
}

export function asEpochMs(value: unknown): number | null {
  const seconds = asNumber(value);
  if (seconds === null || seconds <= 0) return null;

  return seconds > 1e11 ? Math.trunc(seconds) : Math.trunc(seconds * 1000);
}

export function asYear(value: unknown): number | null {
  const raw = asString(value);
  if (!raw) return null;
  const match = /(19|20)\d{2}/.exec(raw);
  return match ? Number.parseInt(match[0], 10) : null;
}

export function asCategoryIds(single: unknown, multi: unknown): string[] {
  const ids = new Set<string>();
  const primary = asString(single);
  if (primary) ids.add(primary);
  if (Array.isArray(multi)) {
    for (const entry of multi) {
      const id = asString(entry);
      if (id) ids.add(id);
    }
  }
  return Array.from(ids);
}

export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    const result: string[] = [];
    for (const entry of value) {
      const str = asString(entry);
      if (str) result.push(str);
    }
    return result;
  }
  const single = asString(value);
  return single ? [single] : [];
}
