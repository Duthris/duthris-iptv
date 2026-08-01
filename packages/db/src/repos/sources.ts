import {
  createId,
  type PlaylistSource,
  type SourceKind,
  type SourceStats,
  type SourceSubscription,
  type StreamEndpoints,
  type StreamProtocolPreference,
} from "@iptv/core";
import { getDb, type StoredCredential } from "../schema.js";
import { clearCatalog } from "./catalog.js";

export async function listSources(): Promise<PlaylistSource[]> {
  const sources = await getDb().playlistSources.toArray();
  return sources.sort((a, b) => a.createdAt - b.createdAt);
}

export async function listEnabledSources(): Promise<PlaylistSource[]> {
  return (await listSources()).filter((source) => source.enabled);
}

export async function getSource(id: string): Promise<PlaylistSource | undefined> {
  return getDb().playlistSources.get(id);
}

export interface CreateSourceInput {
  name: string;
  kind: SourceKind;
  url: string;
  username?: string | null;
  password?: string | null;
  epgUrl?: string | null;
  refreshIntervalHours?: number;
  preferredFormat?: PlaylistSource["preferredFormat"];
  streamProtocol?: StreamProtocolPreference;
}

export async function createSource(input: CreateSourceInput): Promise<PlaylistSource> {
  const db = getDb();
  const now = Date.now();
  const id = createId("src");

  let credentialRef: string | null = null;
  if (input.password) {
    credentialRef = `cred_${id}`;
    await saveCredential(credentialRef, input.password);
  }

  const source: PlaylistSource = {
    id,
    name: input.name.trim() || "Playlist",
    kind: input.kind,
    enabled: true,
    url: input.url,
    username: input.username?.trim() || null,
    credentialRef,

    preferredFormat: input.preferredFormat ?? "m3u8",
    streamProtocol: input.streamProtocol ?? "auto",

    streamEndpoints: null,
    epgUrl: input.epgUrl ?? null,
    refreshIntervalHours: input.refreshIntervalHours ?? 24,
    lastRefreshAt: null,
    lastSuccessAt: null,
    lastError: null,
    stats: null,
    subscription: null,
    createdAt: now,
    updatedAt: now,
  };

  await db.playlistSources.add(source);
  return source;
}

export async function updateSource(
  id: string,
  patch: Partial<Omit<PlaylistSource, "id" | "createdAt">>,
): Promise<void> {
  await getDb().playlistSources.update(id, { ...patch, updatedAt: Date.now() });
}

export async function markSourceSuccess(
  id: string,
  stats: SourceStats,
  streamEndpoints?: StreamEndpoints | null,
  subscription?: SourceSubscription | null,
): Promise<void> {
  const now = Date.now();
  await updateSource(id, {
    stats,
    lastRefreshAt: now,
    lastSuccessAt: now,
    lastError: null,
    ...(streamEndpoints ? { streamEndpoints } : {}),
    ...(subscription ? { subscription } : {}),
  });
}

export async function markSourceError(id: string, message: string): Promise<void> {
  await updateSource(id, { lastRefreshAt: Date.now(), lastError: message });
}

export async function deleteSource(id: string): Promise<void> {
  const db = getDb();
  const source = await getSource(id);

  await clearCatalog(id);
  if (source?.credentialRef) await credentialStore.remove(source.credentialRef);
  await db.playlistSources.delete(id);
}

export async function findStaleSources(now = Date.now()): Promise<PlaylistSource[]> {
  const sources = await listEnabledSources();
  return sources.filter((source) => {
    if (source.refreshIntervalHours <= 0) return false;
    if (source.lastSuccessAt === null) return true;
    return now - source.lastSuccessAt >= source.refreshIntervalHours * 60 * 60 * 1000;
  });
}

export interface CredentialStore {
  save(ref: string, secret: string): Promise<void>;

  has(ref: string): Promise<boolean>;

  read(ref: string): Promise<string | null>;
  remove(ref: string): Promise<void>;
}

const indexedDbStore: CredentialStore = {
  async save(ref, secret) {
    const record: StoredCredential = {
      id: ref,
      secret,
      encrypted: false,
      updatedAt: Date.now(),
    };
    await getDb().credentials.put(record);
  },
  async has(ref) {
    return (await getDb().credentials.get(ref)) !== undefined;
  },
  async read(ref) {
    return (await getDb().credentials.get(ref))?.secret ?? null;
  },
  async remove(ref) {
    await getDb().credentials.delete(ref);
  },
};

let credentialStore: CredentialStore = indexedDbStore;

export function setCredentialStore(store: CredentialStore): void {
  credentialStore = store;
}

export async function saveCredential(ref: string, secret: string): Promise<void> {
  await credentialStore.save(ref, secret);
}

export async function readCredential(ref: string | null): Promise<string | null> {
  if (!ref) return null;
  return credentialStore.read(ref);
}

export async function hasCredential(ref: string | null): Promise<boolean> {
  if (!ref) return false;
  return credentialStore.has(ref);
}

export async function listIndexedDbCredentials(): Promise<StoredCredential[]> {
  return getDb().credentials.toArray();
}

export async function clearIndexedDbCredentials(): Promise<void> {
  await getDb().credentials.clear();
}
