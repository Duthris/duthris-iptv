"use client";

import * as React from "react";
import { FileDown, MonitorPlay } from "lucide-react";
import { Badge, Button, FieldHint } from "@iptv/ui";
import { toast } from "sonner";

import { browseForPlayer, useDetectedPlayers } from "@/lib/external-player";
import { getDesktopBridge, type ShellSettings } from "@/lib/platform";
import { useSettingsStore } from "@/stores/settings-store";

const DEFAULTS: ShellSettings = {
  minimiseToTray: false,
  launchAtStartup: false,
  alwaysOnTop: false,
};

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 accent-[hsl(var(--primary))]"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs leading-relaxed text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

/**
 * Choosing mpv or VLC to hand playback to.
 *
 * Nothing is bundled: an external player is only offered once one is actually
 * installed, or the user points at an executable themselves. Without a
 * selection the feature stays out of the way entirely.
 */
function ExternalPlayerPicker() {
  const detected = useDetectedPlayers();
  const playerPath = useSettingsStore((state) => state.externalPlayerPath);
  const setPlayerPath = useSettingsStore((state) => state.setExternalPlayerPath);

  const chosen = detected.find((player) => player.path === playerPath);
  const name = chosen?.name ?? (playerPath ? playerPath.split(/[\\/]/).pop() : null);

  return (
    <div className="border-border/70 flex flex-col gap-3 rounded-lg border p-3.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-foreground text-sm font-medium">Harici oynatıcı</span>
        <span className="text-muted-foreground text-xs leading-relaxed">
          mpv veya VLC, bu uygulamanın dönüştürerek açtığı içerikleri doğrudan açar ve anında ileri
          sarar. Seçtiğinde oynatıcıda &quot;Harici oynatıcıda aç&quot; düğmesi görünür.
        </span>
      </div>

      {playerPath ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="brand">{name}</Badge>
          <span className="text-2xs text-muted-foreground min-w-0 flex-1 truncate">
            {playerPath}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setPlayerPath("")}>
            Kaldır
          </Button>
        </div>
      ) : detected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {detected.map((player) => (
            <Button
              key={player.path}
              variant="outline"
              size="sm"
              onClick={() => setPlayerPath(player.path)}
            >
              <MonitorPlay /> {player.name} kullan
            </Button>
          ))}
        </div>
      ) : (
        <FieldHint>
          Kurulu mpv veya VLC bulunamadı. Kurduysan aşağıdan uygulamayı gösterebilirsin.
        </FieldHint>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={async () => {
          const picked = await browseForPlayer();
          if (picked) {
            setPlayerPath(picked.path);
            toast.success(`${picked.name} seçildi`);
          }
        }}
      >
        Uygulamayı seç…
      </Button>
    </div>
  );
}

/**
 * Desktop-only window behaviour.
 *
 * State lives in the main process rather than the settings store, because it is
 * the main process that acts on it — the tray, the login item and the window
 * flag are all its to set.
 */
export function DesktopShellSettings() {
  const [settings, setSettings] = React.useState<ShellSettings | null>(null);

  React.useEffect(() => {
    const bridge = getDesktopBridge();
    if (!bridge) return;
    void bridge.getShellSettings().then(setSettings).catch(() => setSettings(DEFAULTS));
  }, []);

  const apply = React.useCallback((next: ShellSettings) => {
    setSettings(next);
    void getDesktopBridge()
      ?.setShellSettings(next)
      .catch(() => toast.error("Ayar uygulanamadı"));
  }, []);

  if (!getDesktopBridge()) return null;
  const current = settings ?? DEFAULTS;

  return (
    <div className="flex flex-col gap-4">
      <Toggle
        label="Kapatınca sistem tepsisine küçült"
        description="Pencereyi kapatmak uygulamayı sonlandırmaz; tepsi simgesinden geri açılır. Çıkmak için tepsi menüsündeki Çıkış."
        checked={current.minimiseToTray}
        onChange={(minimiseToTray) => apply({ ...current, minimiseToTray })}
      />

      <Toggle
        label="Bilgisayar açılışında başlat"
        description="Pencere açılmadan, yalnızca tepside başlar."
        checked={current.launchAtStartup}
        onChange={(launchAtStartup) => apply({ ...current, launchAtStartup })}
      />

      <Toggle
        label="Her zaman üstte"
        description="Pencere diğer uygulamaların üstünde kalır. Küçük ekranda izlerken işe yarar."
        checked={current.alwaysOnTop}
        onChange={(alwaysOnTop) => apply({ ...current, alwaysOnTop })}
      />

      <ExternalPlayerPicker />

      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          className="self-start"
          onClick={async () => {
            const path = await getDesktopBridge()?.exportLogs();
            if (path) toast.success("Günlükler kaydedildi", { description: path });
          }}
        >
          <FileDown /> Günlükleri dışa aktar
        </Button>
        <FieldHint>
          Bir sorunu bildirirken işe yarar. Kaynak adresleri ve parolalar günlüğe yazılmaz.
        </FieldHint>
      </div>
    </div>
  );
}
