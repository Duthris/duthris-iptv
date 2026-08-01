import { getDb } from "../schema.js";

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await getDb().settings.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await getDb().settings.put({ key, value, updatedAt: Date.now() });
}

export async function getAllSettings(): Promise<Record<string, unknown>> {
  const rows = await getDb().settings.toArray();
  const result: Record<string, unknown> = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}

export async function deleteSetting(key: string): Promise<void> {
  await getDb().settings.delete(key);
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export interface StorageEstimate {
  usageBytes: number;
  quotaBytes: number;
  persisted: boolean;
}

export async function estimateStorage(): Promise<StorageEstimate | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  try {
    const estimate = await navigator.storage.estimate();
    const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    return {
      usageBytes: estimate.usage ?? 0,
      quotaBytes: estimate.quota ?? 0,
      persisted,
    };
  } catch {
    return null;
  }
}
