"use client";

import * as React from "react";
import { FileDown } from "lucide-react";
import { Button, FieldHint } from "@iptv/ui";
import { toast } from "sonner";

import { getDesktopBridge, type ShellSettings } from "@/lib/platform";

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
