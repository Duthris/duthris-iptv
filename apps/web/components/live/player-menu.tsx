"use client";

import * as React from "react";
import {
  AudioLines,
  Captions,
  FileUp,
  Gauge,
  Info,
  MonitorPlay,
  Moon,
  Ratio,
  RotateCcw,
  Search,
} from "lucide-react";
import { Spinner, cn } from "@iptv/ui";

import { useSettingsStore, type AspectRatioMode } from "@/stores/settings-store";
import { sleepTimerRemaining, useSleepTimerStore } from "@/stores/sleep-timer-store";

export interface TrackOption {
  id: string;
  label: string;

  detail?: string | null;
}

export interface PlayerMenuProps {
  open: boolean;
  onClose: () => void;

  live: boolean;
  audioTracks?: TrackOption[];
  activeAudioId?: string | null;
  onSelectAudio?: (id: string) => void;
  subtitleTracks?: TrackOption[];

  activeSubtitleId?: string | null;
  onSelectSubtitle?: (id: string | null) => void;
  onLoadSubtitleFile?: () => void;

  busy?: boolean;

  streamInfo?: Array<{ label: string; value: string }>;

  qualityTracks?: TrackOption[];
  activeQualityId?: string | null;
  onSelectQuality?: (id: string) => void;

  subtitleDelayMs?: number;
  onSubtitleDelayChange?: (deltaMs: number) => void;
  onSearchSubtitle?: () => void;

  /** Absent when no external player has been chosen in settings. */
  externalPlayerName?: string | null;
  onOpenExternally?: () => void;
}

const ASPECT_OPTIONS: Array<{ value: AspectRatioMode; label: string }> = [
  { value: "auto", label: "Otomatik" },
  { value: "fill", label: "Doldur" },
  { value: "zoom", label: "Yakınlaştır" },
  { value: "16:9", label: "16:9" },
  { value: "4:3", label: "4:3" },
];

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 1.75, 2];

const SLEEP_OPTIONS = [15, 30, 45, 60, 90];

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/10 px-3 py-2.5 last:border-b-0">
      <p className="text-2xs mb-2 flex items-center gap-1.5 font-medium uppercase tracking-wide text-white/45">
        <span className="[&_svg]:size-3">{icon}</span>
        {title}
      </p>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "text-2xs rounded-md px-2 py-1 font-medium",
        "duration-fast ease-brand transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-white/10 text-white/75 hover:bg-white/20",
      )}
    >
      {children}
    </button>
  );
}

function TrackRow({
  active,
  label,
  detail,
  onClick,
  disabled,
}: {
  active: boolean;
  label: string;
  detail?: string | null;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left",
        "duration-fast ease-brand transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active ? "bg-white/15" : "hover:bg-white/10",
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", active ? "bg-primary" : "bg-transparent")}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-white/90">{label}</span>
        {detail ? <span className="text-2xs block truncate text-white/45">{detail}</span> : null}
      </span>
    </button>
  );
}

export function PlayerMenu({
  open,
  onClose,
  live,
  audioTracks,
  activeAudioId,
  onSelectAudio,
  subtitleTracks,
  activeSubtitleId,
  onSelectSubtitle,
  onLoadSubtitleFile,
  busy = false,
  streamInfo,
  qualityTracks,
  activeQualityId,
  onSelectQuality,
  subtitleDelayMs = 0,
  onSubtitleDelayChange,
  onSearchSubtitle,
  externalPlayerName,
  onOpenExternally,
}: PlayerMenuProps) {
  const aspectRatio = useSettingsStore((state) => state.aspectRatio);
  const setAspectRatio = useSettingsStore((state) => state.setAspectRatio);
  const playbackRate = useSettingsStore((state) => state.playbackRate);
  const setPlaybackRate = useSettingsStore((state) => state.setPlaybackRate);
  const subtitleStyle = useSettingsStore((state) => state.subtitleStyle);
  const setSubtitleStyle = useSettingsStore((state) => state.setSubtitleStyle);

  const endsAt = useSleepTimerStore((state) => state.endsAt);
  const startSleep = useSleepTimerStore((state) => state.start);
  const cancelSleep = useSleepTimerStore((state) => state.cancel);

  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!open || endsAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [open, endsAt]);

  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  const remaining = sleepTimerRemaining(endsAt, now);
  const hasAudioChoice = Boolean(audioTracks && audioTracks.length > 1 && onSelectAudio);
  const hasSubtitleSupport = Boolean(onSelectSubtitle);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Oynatıcı ayarları"
      className={cn(
        "absolute bottom-16 right-3 z-30 w-72 overflow-hidden rounded-lg",
        "border border-white/15 bg-black/90 shadow-lg backdrop-blur-sm",
        "max-h-[min(70vh,26rem)] overflow-y-auto overscroll-contain",
      )}
    >
      {busy ? (
        <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-3 py-2">
          <Spinner className="text-white/70" />
          <span className="text-2xs text-white/70">Yeni parça hazırlanıyor…</span>
        </div>
      ) : null}

      <Section icon={<Ratio />} title="Görüntü oranı">
        <div className="flex flex-wrap gap-1.5">
          {ASPECT_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              active={aspectRatio === option.value}
              onClick={() => setAspectRatio(option.value)}
            >
              {option.label}
            </Chip>
          ))}
        </div>
      </Section>

      {!live ? (
        <Section icon={<Gauge />} title="Oynatma hızı">
          <div className="flex flex-wrap gap-1.5">
            {SPEED_OPTIONS.map((rate) => (
              <Chip
                key={rate}
                active={Math.abs(playbackRate - rate) < 0.01}
                onClick={() => setPlaybackRate(rate)}
              >
                {rate}x
              </Chip>
            ))}
          </div>
        </Section>
      ) : null}

      {qualityTracks && qualityTracks.length > 1 && onSelectQuality ? (
        <Section icon={<Gauge />} title="Kalite">
          <div className="flex flex-col gap-0.5">
            {qualityTracks.map((track) => (
              <TrackRow
                key={track.id}
                active={track.id === activeQualityId}
                label={track.label}
                detail={track.detail}
                onClick={() => onSelectQuality(track.id)}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {hasAudioChoice ? (
        <Section icon={<AudioLines />} title="Ses dili">
          <div className="flex flex-col gap-0.5">
            {audioTracks!.map((track) => (
              <TrackRow
                key={track.id}
                active={track.id === activeAudioId}
                label={track.label}
                detail={track.detail}
                disabled={busy}
                onClick={() => onSelectAudio!(track.id)}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {hasSubtitleSupport ? (
        <Section icon={<Captions />} title="Altyazı">
          <div className="flex flex-col gap-0.5">
            <TrackRow
              active={!activeSubtitleId}
              label="Kapalı"
              disabled={busy}
              onClick={() => onSelectSubtitle!(null)}
            />
            {(subtitleTracks ?? []).map((track) => (
              <TrackRow
                key={track.id}
                active={track.id === activeSubtitleId}
                label={track.label}
                detail={track.detail}
                disabled={busy}
                onClick={() => onSelectSubtitle!(track.id)}
              />
            ))}
          </div>

          {onSearchSubtitle ? (
            <button
              type="button"
              onClick={onSearchSubtitle}
              className={cn(
                "mt-1.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5",
                "text-2xs text-white/70 transition-colors duration-fast",
                "hover:bg-white/10 hover:text-white",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
              )}
            >
              <Search className="size-3.5" />
              İnternetten altyazı ara
            </button>
          ) : null}

          {onLoadSubtitleFile ? (
            <button
              type="button"
              onClick={onLoadSubtitleFile}
              className={cn(
                "mt-1.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5",
                "text-2xs duration-fast text-white/70 transition-colors",
                "hover:bg-white/10 hover:text-white",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
              )}
            >
              <FileUp className="size-3.5" />
              Altyazı dosyası yükle (.srt/.vtt)
            </button>
          ) : null}

          {activeSubtitleId ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-2xs text-white/40">Boyut</span>
              {(["small", "medium", "large", "xlarge"] as const).map((size) => (
                <Chip
                  key={size}
                  active={subtitleStyle.size === size}
                  onClick={() => setSubtitleStyle({ size })}
                >
                  {size === "small" ? "S" : size === "medium" ? "M" : size === "large" ? "L" : "XL"}
                </Chip>
              ))}
              <Chip
                active={subtitleStyle.background}
                onClick={() => setSubtitleStyle({ background: !subtitleStyle.background })}
              >
                Arka plan
              </Chip>
            </div>
          ) : null}

          {/*
            Sync correction. Embedded tracks are usually right, but a subtitle
            file downloaded for a different release is routinely a second or
            two out, and nothing else in the player can fix that.
          */}
          {activeSubtitleId && onSubtitleDelayChange ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-2xs text-white/40">Gecikme</span>

              <Chip active={false} onClick={() => onSubtitleDelayChange(-500)}>
                −0,5 sn
              </Chip>

              {/*
                A readout, not a control. It was a chip identical to the two
                buttons around it, so at +0,5 it looked exactly like the
                increment next to it while actually resetting.
              */}
              <span
                className={cn(
                  "tabular min-w-16 rounded-md px-2 py-1 text-center text-2xs font-semibold",
                  "border border-dashed",
                  subtitleDelayMs === 0
                    ? "border-white/15 text-white/45"
                    : "border-primary/50 bg-primary/15 text-white",
                )}
              >
                {subtitleDelayMs === 0
                  ? "0 sn"
                  : `${subtitleDelayMs > 0 ? "+" : "−"}${(Math.abs(subtitleDelayMs) / 1000).toFixed(1)} sn`}
              </span>

              <Chip active={false} onClick={() => onSubtitleDelayChange(500)}>
                +0,5 sn
              </Chip>

              {subtitleDelayMs !== 0 ? (
                <button
                  type="button"
                  onClick={() => onSubtitleDelayChange(0)}
                  aria-label="Gecikmeyi sıfırla"
                  title="Sıfırla"
                  className={cn(
                    "grid size-6 place-items-center rounded-md text-white/60",
                    "transition-colors duration-fast hover:bg-white/15 hover:text-white",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                  )}
                >
                  <RotateCcw className="size-3" />
                </button>
              ) : null}

              <span className="w-full text-2xs text-white/40">
                Altyazı erken çıkıyorsa artır, geç çıkıyorsa azalt.
              </span>
            </div>
          ) : null}
        </Section>
      ) : null}

      <Section icon={<Moon />} title="Uyku zamanlayıcısı">
        <div className="flex flex-wrap gap-1.5">
          <Chip active={endsAt === null} onClick={cancelSleep}>
            Kapalı
          </Chip>
          {SLEEP_OPTIONS.map((minutes) => (
            <Chip key={minutes} active={false} onClick={() => startSleep(minutes)}>
              {minutes} dk
            </Chip>
          ))}
        </div>
        {remaining !== null ? (
          <p className="tabular text-2xs mt-2 text-white/55">
            Kalan: {Math.floor(remaining / 60)} dk {String(remaining % 60).padStart(2, "0")} sn
          </p>
        ) : null}
      </Section>

      {externalPlayerName && onOpenExternally ? (
        <Section icon={<MonitorPlay />} title="Harici oynatıcı">
          <button
            type="button"
            onClick={onOpenExternally}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left",
              "duration-fast ease-brand transition-colors hover:bg-white/10",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-white/90">
                {externalPlayerName} ile aç
              </span>
              <span className="block truncate text-2xs text-white/45">
                Buradaki oynatma durur — abonelik tek bağlantıya izin veriyor
              </span>
            </span>
          </button>
        </Section>
      ) : null}

      {streamInfo && streamInfo.length > 0 ? (
        <Section icon={<Info />} title="Yayın bilgisi">
          <dl className="flex flex-col gap-1">
            {streamInfo.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-3">
                <dt className="text-2xs text-white/45">{row.label}</dt>
                <dd className="tabular text-2xs min-w-0 truncate text-white/80">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}
    </div>
  );
}
