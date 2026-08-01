"use client";

import { clearIndexedDbCredentials, listIndexedDbCredentials, setCredentialStore } from "@iptv/db";
import { getDesktopBridge } from "./platform";

let installed = false;

async function migrateCredentials(bridge: NonNullable<ReturnType<typeof getDesktopBridge>>) {
  try {
    const legacy = await listIndexedDbCredentials();
    if (legacy.length === 0) return;

    for (const entry of legacy) {
      if (!entry.secret) continue;

      if (await bridge.hasCredential(entry.id)) continue;
      await bridge.saveCredential(entry.id, entry.secret);
    }

    await clearIndexedDbCredentials();
  } catch {
    // A failed migration must not block startup; the user can re-add the source.
  }
}

export function installDesktopIntegration(): void {
  if (installed) return;
  const bridge = getDesktopBridge();
  if (!bridge) return;

  setCredentialStore({
    save: (ref, secret) => bridge.saveCredential(ref, secret),
    has: (ref) => bridge.hasCredential(ref),

    read: (ref) => bridge.revealCredential(ref),
    remove: (ref) => bridge.deleteCredential(ref),
  });

  installed = true;
  void migrateCredentials(bridge);
}
