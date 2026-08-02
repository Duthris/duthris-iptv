"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, Play, Trash2 } from "lucide-react";
import { getLiveChannel } from "@iptv/db";
import { Badge, Button, EmptyState, cn } from "@iptv/ui";
import { toast } from "sonner";

import { useGuideTime } from "@/lib/use-guide-time";
import { useReminderStore } from "@/stores/reminder-store";
import { usePlayerStore } from "@/stores/player-store";

/**
 * Everything currently waiting to be announced.
 *
 * Set from the guide, but hunting back through a schedule to find what was set
 * is no way to manage them — so they are listed here, where the rest of the
 * user's own things live.
 */
export function RemindersPanel() {
  const router = useRouter();
  const { formatTime, formatDate } = useGuideTime();
  const playChannel = usePlayerStore((state) => state.playChannel);

  const reminders = useReminderStore((state) => state.reminders);
  const remove = useReminderStore((state) => state.remove);

  const sorted = React.useMemo(
    () => [...reminders].sort((a, b) => a.startAt - b.startAt),
    [reminders],
  );

  const open = React.useCallback(
    async (channelId: string) => {
      const channel = await getLiveChannel(channelId);
      if (!channel) {
        toast.error("Kanal artık kaynakta yok");
        return;
      }
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

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={<Bell />}
        title="Bekleyen hatırlatma yok"
        description="TV rehberinde ileri saatteki bir programa tıklayıp Hatırlat diyerek kurabilirsin. Hatırlatmalar yalnızca uygulama açıkken çalışır."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((reminder) => {
        const minutesAway = Math.round((reminder.startAt - Date.now()) / 60_000);

        return (
          <div
            key={reminder.id}
            className={cn(
              "border-border/70 bg-card flex items-center gap-3.5 rounded-lg border p-3",
            )}
          >
            <span className="bg-primary/15 text-primary grid size-11 shrink-0 place-items-center rounded-md">
              <Bell className="size-4" />
            </span>

            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-foreground truncate text-sm font-medium">
                {reminder.title}
              </span>
              <div className="text-2xs text-muted-foreground flex flex-wrap items-center gap-2">
                <Badge variant="outline">{reminder.channelName}</Badge>
                <span className="tabular">
                  {formatDate(reminder.startAt)} · {formatTime(reminder.startAt)}
                </span>
                <span className="tabular">
                  {minutesAway > 60
                    ? `${Math.round(minutesAway / 60)} saat sonra`
                    : minutesAway > 0
                      ? `${minutesAway} dk sonra`
                      : "başlamak üzere"}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Kanalı aç"
                title="Kanalı aç"
                onClick={() => void open(reminder.channelId)}
              >
                <Play />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Hatırlatmayı kaldır"
                title="Hatırlatmayı kaldır"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => {
                  remove(reminder.id);
                  toast.success("Hatırlatma kaldırıldı");
                }}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
