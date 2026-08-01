"use client";

import * as React from "react";
import {
  Maximize,
  Minimize,
  Moon,
  Pause,
  PictureInPicture2,
  Play,
  Radio,
  Settings,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { LiveDot, cn } from "@iptv/ui";

import { formatDuration } from "@/lib/format";
import { useSettingsStore } from "@/stores/settings-store";
import { sleepTimerRemaining, useSleepTimerStore } from "@/stores/sleep-timer-store";

export interface PlayerControlsProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  containerRef: React.RefObject<HTMLDivElement>;

  live: boolean;

  behindLive?: boolean;
  onSeekToLive?: () => void;
  visible: boolean;

  virtualPosition?: number | null;
  virtualDuration?: number | null;

  onSeek?: (seconds: number) => void;

  onToggleMenu?: () => void;
  menuOpen?: boolean;

  onPrevious?: (() => void) | undefined;
  onNext?: (() => void) | undefined;
  previousLabel?: string;
  nextLabel?: string;
}

function ControlButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-md text-white/90",
        "duration-fast ease-brand transition-colors",
        "hover:bg-white/15 hover:text-white",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
        "[&_svg]:size-[18px]",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function PlayerControls({
  videoRef,
  containerRef,
  live,
  behindLive = false,
  onSeekToLive,
  visible,
  virtualPosition = null,
  virtualDuration = null,
  onSeek,
  onToggleMenu,
  menuOpen = false,
  onPrevious,
  onNext,
  previousLabel = "Önceki",
  nextLabel = "Sonraki",
}: PlayerControlsProps) {
  const volume = useSettingsStore((state) => state.volume);
  const muted = useSettingsStore((state) => state.muted);
  const setVolume = useSettingsStore((state) => state.setVolume);
  const setMuted = useSettingsStore((state) => state.setMuted);
  const sleepEndsAt = useSleepTimerStore((state) => state.endsAt);

  const [paused, setPaused] = React.useState(true);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [pipActive, setPipActive] = React.useState(false);
  const [position, setPosition] = React.useState(0);
  const [duration, setDuration] = React.useState(0);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncPlayback = () => setPaused(video.paused);
    const syncTime = () => {
      setPosition(video.currentTime);
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    };
    const syncPip = () => setPipActive(document.pictureInPictureElement === video);

    video.addEventListener("play", syncPlayback);
    video.addEventListener("pause", syncPlayback);
    video.addEventListener("timeupdate", syncTime);
    video.addEventListener("durationchange", syncTime);
    video.addEventListener("enterpictureinpicture", syncPip);
    video.addEventListener("leavepictureinpicture", syncPip);
    syncPlayback();
    syncTime();

    return () => {
      video.removeEventListener("play", syncPlayback);
      video.removeEventListener("pause", syncPlayback);
      video.removeEventListener("timeupdate", syncTime);
      video.removeEventListener("durationchange", syncTime);
      video.removeEventListener("enterpictureinpicture", syncPip);
      video.removeEventListener("leavepictureinpicture", syncPip);
    };
  }, [videoRef]);

  const [sleepNow, setSleepNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (sleepEndsAt === null) return;
    setSleepNow(Date.now());
    const timer = setInterval(() => setSleepNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [sleepEndsAt]);

  React.useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [containerRef]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void container.requestFullscreen().catch(() => undefined);
  };

  const togglePip = () => {
    const video = videoRef.current;
    if (!video) return;
    if (document.pictureInPictureElement) {
      void document.exitPictureInPicture().catch(() => undefined);
    } else {
      void video.requestPictureInPicture().catch(() => undefined);
    }
  };

  const displayPosition = virtualPosition ?? position;
  const displayDuration = virtualDuration ?? duration;

  const handleSeek = (seconds: number) => {
    if (onSeek) {
      onSeek(seconds);
      return;
    }
    const video = videoRef.current;
    if (video) video.currentTime = seconds;
  };

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const pipSupported = typeof document !== "undefined" && document.pictureInPictureEnabled === true;

  const sleepRemaining = sleepTimerRemaining(sleepEndsAt, sleepNow);

  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 z-10",
        "bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-2.5 pt-10",
        "duration-base ease-brand transition-opacity",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      {!live ? (
        <div className="mb-1.5 flex items-center gap-3">
          <span className="tabular text-2xs w-12 shrink-0 text-white/70">
            {formatDuration(displayPosition)}
          </span>
          <input
            type="range"
            min={0}
            max={displayDuration || 0}
            step={1}
            value={Math.min(displayPosition, displayDuration || 0)}
            onChange={(event) => handleSeek(Number(event.target.value))}
            aria-label="Konum"
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/25 accent-[hsl(var(--primary))]"
          />
          <span className="tabular text-2xs w-12 shrink-0 text-right text-white/70">
            {formatDuration(displayDuration)}
          </span>
        </div>
      ) : null}

      <div className="flex items-center gap-1">
        {onPrevious ? (
          <ControlButton label={previousLabel} onClick={onPrevious}>
            <SkipBack />
          </ControlButton>
        ) : null}

        <ControlButton label={paused ? "Oynat" : "Duraklat"} onClick={togglePlay}>
          {paused ? <Play /> : <Pause />}
        </ControlButton>

        {onNext ? (
          <ControlButton label={nextLabel} onClick={onNext}>
            <SkipForward />
          </ControlButton>
        ) : null}

        <div className="group/vol flex items-center">
          <ControlButton label={muted ? "Sesi aç" : "Sesi kapat"} onClick={() => setMuted(!muted)}>
            <VolumeIcon />
          </ControlButton>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(event) => {
              const next = Number(event.target.value);
              setVolume(next);
              if (next > 0 && muted) setMuted(false);
            }}
            aria-label="Ses seviyesi"
            className={cn(
              "h-1 cursor-pointer appearance-none rounded-full bg-white/25 accent-[hsl(var(--primary))]",
              "duration-base ease-brand w-0 opacity-0 transition-all",
              "group-hover/vol:ml-1 group-hover/vol:w-20 group-hover/vol:opacity-100",
              "focus-visible:ml-1 focus-visible:w-20 focus-visible:opacity-100",
            )}
          />
        </div>

        {live ? (
          behindLive && onSeekToLive ? (
            <button
              type="button"
              onClick={onSeekToLive}
              className={cn(
                "ml-1 flex h-7 items-center gap-1.5 rounded-full bg-white/15 px-2.5",
                "text-2xs duration-fast font-medium text-white transition-colors",
                "hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
              )}
            >
              <Radio className="size-3" />
              Canlıya dön
            </button>
          ) : (
            <span className="bg-destructive text-2xs ml-1 flex h-7 items-center gap-1.5 rounded-full px-2.5 font-medium text-white">
              <LiveDot />
              CANLI
            </span>
          )
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          {sleepRemaining !== null ? (
            <span
              title="Uyku zamanlayıcısı"
              className="tabular text-2xs mr-1 flex h-7 items-center gap-1.5 rounded-full bg-white/15 px-2.5 font-medium text-white/85"
            >
              <Moon className="size-3" />
              {Math.floor(sleepRemaining / 60)}:{String(sleepRemaining % 60).padStart(2, "0")}
            </span>
          ) : null}

          {onToggleMenu ? (
            <ControlButton
              label="Ayarlar"
              onClick={onToggleMenu}
              className={menuOpen ? "bg-white/20 text-white" : undefined}
            >
              <Settings />
            </ControlButton>
          ) : null}

          {pipSupported ? (
            <ControlButton
              label={pipActive ? "Küçük ekrandan çık" : "Küçük ekran"}
              onClick={togglePip}
            >
              <PictureInPicture2 />
            </ControlButton>
          ) : null}
          <ControlButton
            label={fullscreen ? "Tam ekrandan çık" : "Tam ekran"}
            onClick={toggleFullscreen}
          >
            {fullscreen ? <Minimize /> : <Maximize />}
          </ControlButton>
        </div>
      </div>
    </div>
  );
}
