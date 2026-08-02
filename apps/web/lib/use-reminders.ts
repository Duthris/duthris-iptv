"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getLiveChannel } from "@iptv/db";
import { toast } from "sonner";

import { useReminderStore, type Reminder } from "@/stores/reminder-store";
import { usePlayerStore } from "@/stores/player-store";

/**
 * Programme reminders, watched while the app runs.
 *
 * Only for a showing the user picked, so nothing is tracked in the background
 * and no schedule is followed on its own. A reminder cannot survive the app
 * being closed — there is no service to fire it — which is why the wording
 * where it is set says so plainly.
 */

/** Often enough for a minute's precision without waking constantly. */
const TICK_MS = 20_000;

/** Fired reminders are dropped, so a slow tick cannot repeat one. */
function due(reminder: Reminder, now: number): boolean {
  return now >= reminder.startAt - reminder.leadMinutes * 60_000;
}

function notify(reminder: Reminder, onOpen: () => void): void {
  const minutes = Math.max(0, Math.round((reminder.startAt - Date.now()) / 60_000));
  const body =
    minutes > 0
      ? `${reminder.channelName} · ${minutes} dakika içinde başlıyor`
      : `${reminder.channelName} · başlıyor`;

  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const native = new Notification(reminder.title, { body });
      native.onclick = onOpen;
      return;
    }
  } catch {
    // Notifications unavailable in this context; the toast below still shows.
  }

  toast(reminder.title, { description: body, action: { label: "Aç", onClick: onOpen } });
}

export function useReminderWatcher(): void {
  const router = useRouter();
  const playChannel = usePlayerStore((state) => state.playChannel);

  const reminders = useReminderStore((state) => state.reminders);
  const remove = useReminderStore((state) => state.remove);
  const prune = useReminderStore((state) => state.prune);

  const open = React.useCallback(
    async (channelId: string) => {
      const channel = await getLiveChannel(channelId);
      if (!channel) return;

      playChannel({
        id: channel.id,
        sourceId: channel.sourceId,
        name: channel.name,
        logo: channel.logo,
        number: channel.number,
        tvgId: channel.tvgId,
        hasArchive: channel.hasArchive,
      });
      router.push("/live");
    },
    [playChannel, router],
  );

  // Held in a ref so the interval below is created once rather than on every
  // change to the list.
  const latest = React.useRef({ reminders, remove, open });
  latest.current = { reminders, remove, open };

  React.useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission().catch(() => undefined);
    }

    prune();

    const timer = setInterval(() => {
      const now = Date.now();
      for (const reminder of latest.current.reminders) {
        if (!due(reminder, now)) continue;

        latest.current.remove(reminder.id);
        notify(reminder, () => void latest.current.open(reminder.channelId));
      }
    }, TICK_MS);

    return () => clearInterval(timer);
  }, [prune]);
}
