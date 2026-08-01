import { app, safeStorage } from "electron";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

interface CredentialFile {
  version: 1;

  entries: Record<string, { value: string; encrypted: boolean }>;
}

let cache: CredentialFile | null = null;

function filePath(): string {
  return join(app.getPath("userData"), "credentials.json");
}

function load(): CredentialFile {
  if (cache) return cache;

  const path = filePath();
  if (!existsSync(path)) {
    cache = { version: 1, entries: {} };
    return cache;
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as CredentialFile;
    cache = parsed?.entries ? parsed : { version: 1, entries: {} };
  } catch {
    cache = { version: 1, entries: {} };
  }
  return cache;
}

function persist(data: CredentialFile): void {
  const path = filePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data), { encoding: "utf8", mode: 0o600 });
  cache = data;
}

export function saveCredential(ref: string, secret: string): void {
  const data = load();

  if (safeStorage.isEncryptionAvailable()) {
    data.entries[ref] = {
      value: safeStorage.encryptString(secret).toString("base64"),
      encrypted: true,
    };
  } else {
    console.warn("[credentials] safeStorage kullanılamıyor, parola şifrelenmeden saklanıyor");
    data.entries[ref] = { value: secret, encrypted: false };
  }

  persist(data);
}

export function readCredential(ref: string): string | null {
  const entry = load().entries[ref];
  if (!entry) return null;

  if (!entry.encrypted) return entry.value;

  try {
    return safeStorage.decryptString(Buffer.from(entry.value, "base64"));
  } catch {
    return null;
  }
}

export function deleteCredential(ref: string): void {
  const data = load();
  delete data.entries[ref];
  persist(data);
}

export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}
