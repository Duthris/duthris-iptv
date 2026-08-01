import { createId, type Profile } from "@iptv/core";
import { getDb } from "../schema.js";

export const PROFILE_COLORS = ["violet", "indigo", "sky", "emerald", "amber", "rose"] as const;

export type ProfileColor = (typeof PROFILE_COLORS)[number];

const PIN_SALT = "duthris-iptv/profile-pin/v1";

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`${PIN_SALT}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return (await hashPin(pin)) === hash;
}

export async function listProfiles(): Promise<Profile[]> {
  const profiles = await getDb().profiles.toArray();
  return profiles.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getProfile(id: string): Promise<Profile | undefined> {
  return getDb().profiles.get(id);
}

export interface CreateProfileInput {
  name: string;
  color?: ProfileColor;
  isKids?: boolean;
  pin?: string | null;
}

export async function createProfile(input: CreateProfileInput): Promise<Profile> {
  const now = Date.now();
  const existing = await getDb().profiles.count();

  const profile: Profile = {
    id: createId("prof"),
    name: input.name.trim() || "Profil",
    color: input.color ?? PROFILE_COLORS[existing % PROFILE_COLORS.length] ?? "violet",
    avatar: null,
    pinHash: input.pin ? await hashPin(input.pin) : null,
    isKids: input.isKids ?? false,

    parentalControlEnabled: input.isKids ?? false,
    allowedSourceIds: [],
    hiddenCategoryIds: [],
    createdAt: now,
    updatedAt: now,
  };

  await getDb().profiles.add(profile);
  return profile;
}

export async function updateProfile(
  id: string,
  patch: Partial<Omit<Profile, "id" | "createdAt">>,
): Promise<void> {
  await getDb().profiles.update(id, { ...patch, updatedAt: Date.now() });
}

export async function setProfilePin(id: string, pin: string | null): Promise<void> {
  await updateProfile(id, { pinHash: pin ? await hashPin(pin) : null });
}

export async function deleteProfile(id: string): Promise<void> {
  const db = getDb();
  await Promise.all([
    db.profiles.delete(id),
    db.favorites.where("profileId").equals(id).delete(),
    db.watchHistory.where("profileId").equals(id).delete(),
  ]);
}

export async function ensureDefaultProfile(): Promise<Profile> {
  const profiles = await listProfiles();
  const first = profiles[0];
  if (first) return first;
  return createProfile({ name: "Ben" });
}
