import {
  decryptJson,
  encryptJson,
  type EncryptedPayload,
  type FavoriteEntry,
  type PlaylistSource,
  type Profile,
  type WatchHistoryEntry,
} from "@iptv/core";

import { getDb, type EpgMapping, type SettingEntry, type StoredCredential } from "./schema.js";
import { readCredential, saveCredential } from "./repos/sources.js";

export const BACKUP_FORMAT = "duthris-iptv-backup";
export const BACKUP_VERSION = 1;

export interface BackupContents {
  profiles: Profile[];
  sources: PlaylistSource[];

  credentials: StoredCredential[];
  favorites: FavoriteEntry[];
  watchHistory: WatchHistoryEntry[];
  settings: SettingEntry[];
  epgMappings: EpgMapping[];
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: number;
  encrypted: boolean;

  data?: BackupContents;

  payload?: EncryptedPayload;
}

export interface BackupStats {
  profiles: number;
  sources: number;
  favorites: number;
  historyEntries: number;
  credentials: number;
}

async function collect(includeCredentials: boolean): Promise<BackupContents> {
  const db = getDb();

  const [profiles, sources, favorites, watchHistory, settings, epgMappings] = await Promise.all([
    db.profiles.toArray(),
    db.playlistSources.toArray(),
    db.favorites.toArray(),
    db.watchHistory.toArray(),
    db.settings.toArray(),
    db.epgMappings.toArray(),
  ]);

  let credentials: StoredCredential[] = [];
  if (includeCredentials) {
    const entries = await Promise.all(
      sources
        .filter((source) => source.credentialRef)
        .map(async (source): Promise<StoredCredential | null> => {
          const secret = await readCredential(source.credentialRef);
          if (!secret) return null;
          return {
            id: source.credentialRef as string,
            secret,

            encrypted: false,
            updatedAt: Date.now(),
          };
        }),
    );
    credentials = entries.filter((entry): entry is StoredCredential => entry !== null);
  }

  return { profiles, sources, favorites, watchHistory, settings, epgMappings, credentials };
}

export interface CreateBackupOptions {
  passphrase?: string;
}

export async function createBackup(
  options: CreateBackupOptions = {},
): Promise<{ file: BackupFile; stats: BackupStats }> {
  const encrypted = Boolean(options.passphrase);
  const data = await collect(encrypted);

  const stats: BackupStats = {
    profiles: data.profiles.length,
    sources: data.sources.length,
    favorites: data.favorites.length,
    historyEntries: data.watchHistory.length,
    credentials: data.credentials.length,
  };

  const base = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: Date.now(),
  } as const;

  if (options.passphrase) {
    return {
      file: { ...base, encrypted: true, payload: await encryptJson(data, options.passphrase) },
      stats,
    };
  }

  return { file: { ...base, encrypted: false, data }, stats };
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}

export function parseBackupFile(text: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError("Dosya okunamadı — geçerli bir yedek dosyası değil.");
  }

  const file = parsed as BackupFile;
  if (!file || file.format !== BACKUP_FORMAT) {
    throw new BackupError("Bu dosya bir Duthris IPTV yedeği değil.");
  }
  if (file.version > BACKUP_VERSION) {
    throw new BackupError(
      "Yedek daha yeni bir uygulama sürümüyle oluşturulmuş. Uygulamayı güncelleyin.",
    );
  }
  return file;
}

export async function restoreBackup(
  file: BackupFile,
  options: { passphrase?: string } = {},
): Promise<BackupStats> {
  let data: BackupContents;

  if (file.encrypted) {
    if (!options.passphrase) throw new BackupError("Bu yedek şifreli — parola gerekli.");
    if (!file.payload) throw new BackupError("Yedek dosyası eksik.");
    data = await decryptJson<BackupContents>(file.payload, options.passphrase);
  } else {
    if (!file.data) throw new BackupError("Yedek dosyası eksik.");
    data = file.data;
  }

  const db = getDb();

  await db.transaction(
    "rw",
    [db.profiles, db.playlistSources, db.favorites, db.watchHistory, db.settings, db.epgMappings],
    async () => {
      await Promise.all([
        db.profiles.clear(),
        db.playlistSources.clear(),
        db.favorites.clear(),
        db.watchHistory.clear(),
        db.settings.clear(),
        db.epgMappings.clear(),
      ]);

      await Promise.all([
        db.profiles.bulkPut(data.profiles ?? []),
        db.playlistSources.bulkPut(data.sources ?? []),
        db.favorites.bulkPut(data.favorites ?? []),
        db.watchHistory.bulkPut(data.watchHistory ?? []),
        db.settings.bulkPut(data.settings ?? []),
        db.epgMappings.bulkPut(data.epgMappings ?? []),
      ]);
    },
  );

  for (const credential of data.credentials ?? []) {
    await saveCredential(credential.id, credential.secret);
  }

  return {
    profiles: data.profiles?.length ?? 0,
    sources: data.sources?.length ?? 0,
    favorites: data.favorites?.length ?? 0,
    historyEntries: data.watchHistory?.length ?? 0,
    credentials: data.credentials?.length ?? 0,
  };
}

export async function eraseAllData(): Promise<void> {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
}
