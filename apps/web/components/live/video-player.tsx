"use client";

import * as React from "react";
import { AlertTriangle, Loader2, RotateCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import type Hls from "hls.js";
import { checkPlaybackCapability, detectStreamKind, maskCredentialsInUrl } from "@iptv/core";
import { Button, Spinner, cn } from "@iptv/ui";

import { PlayerControls } from "@/components/live/player-controls";
import { PlayerMenu, type TrackOption } from "@/components/live/player-menu";
import { VolumeIndicator } from "@/components/live/volume-indicator";
import { SubtitleOverlay } from "@/components/live/subtitle-overlay";
import { languageName } from "@/lib/languages";
import { findCueAt, parseSubtitles, type SubtitleCue } from "@/lib/subtitles";
import { useMediaSession, useMediaSessionState } from "@/lib/use-media-session";
import { useSubtitleTrack } from "@/lib/use-subtitle-track";
import { useWakeLock } from "@/lib/use-wake-lock";
import { useSleepTimerStore } from "@/stores/sleep-timer-store";
import { getDesktopBridge, isDesktop, isHttpsPage, type TranscodeSession } from "@/lib/platform";
import { diagnoseStream, type StreamDiagnosis } from "@/lib/diagnose-stream";
import { useSettingsStore } from "@/stores/settings-store";
import { formatDuration, initialsOf } from "@/lib/format";

export interface VideoPlayerProps {
  url: string | null;
  title: string;
  logo?: string | null;

  canSwitchToHttp?: boolean;
  onSwitchToHttp?: () => void;

  rewriteUrl?: (url: string) => string;

  live?: boolean;

  startPositionSecs?: number | null;

  onProgress?: (positionSecs: number, durationSecs: number) => void;

  onEnded?: (durationSecs: number) => void;

  overlay?: React.ReactNode;

  fallbackTsUrl?: string | null;

  onPrevious?: (() => void) | undefined;
  onNext?: (() => void) | undefined;
  previousLabel?: string;
  nextLabel?: string;

  mediaSubtitle?: string | null;
  /** Fires whenever playback starts or stops, for watch tracking. */
  onPlayingChange?: (playing: boolean) => void;
  className?: string;
}

type PlayerState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "playing" }
  | { status: "error"; message: string; recoverable: boolean; diagnose: boolean };

const MAX_SILENT_RETRIES = 2;

const BEHIND_LIVE_SECONDS = 12;

const BEHIND_LIVE_NATIVE_SECONDS = 45;

const CONNECT_TIMEOUT_MS = 20_000;

const HLS_STAGE_TIMEOUT_MS = 6_000;

const WAITING_OVERLAY_DELAY_MS = 700;

const VOLUME_OSD_MS = 1_400;

const SEEK_DEBOUNCE_MS = 450;

const EXTERNAL_SUBTITLE_ID = "external";

interface QualityLevel {
  index: number;
  height: number | null;
  bitrate: number | null;
}

const BROWSER_CONTAINERS = /\.(mp4|m4v|webm|mov|m3u8|ts|mpegts)(\?|#|$)/i;

function isBrowserPlayableSource(url: string): boolean {
  return BROWSER_CONTAINERS.test(url);
}

function rewritePlaylistBody(body: string, rewrite: (url: string) => string): string {
  return body.replace(/https:\/\/[^\s"'\r\n]+/g, (match) => rewrite(match));
}

function createRewritingLoader(
  HlsCtor: typeof import("hls.js").default,
  rewrite: (url: string) => string,
) {
  const BaseLoader = HlsCtor.DefaultConfig.loader;
  type LoadArgs = Parameters<InstanceType<typeof BaseLoader>["load"]>;

  return class RewritingLoader extends BaseLoader {
    override load(context: LoadArgs[0], config: LoadArgs[1], callbacks: LoadArgs[2]): void {
      context.url = rewrite(context.url);

      const originalOnSuccess = callbacks.onSuccess;
      const patched: LoadArgs[2] = {
        ...callbacks,
        onSuccess: (response, stats, ctx, networkDetails) => {
          if (typeof response.data === "string" && response.data.includes("https://")) {
            response.data = rewritePlaylistBody(response.data, rewrite);
          }
          originalOnSuccess(response, stats, ctx, networkDetails);
        },
      };

      super.load(context, config, patched);
    }
  };
}

export function VideoPlayer({
  url,
  title,
  logo,
  canSwitchToHttp = false,
  onSwitchToHttp,
  rewriteUrl,
  live = true,
  startPositionSecs = null,
  onProgress,
  onEnded,
  overlay,
  fallbackTsUrl,
  onPrevious,
  onNext,
  previousLabel,
  nextLabel,
  mediaSubtitle,
  onPlayingChange,
  className,
}: VideoPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const hlsRef = React.useRef<Hls | null>(null);
  const mpegtsRef = React.useRef<{ destroy: () => void } | null>(null);
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const waitingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const attachedUrlRef = React.useRef<string | null>(null);

  const [state, setState] = React.useState<PlayerState>({ status: "idle" });
  const [attempt, setAttempt] = React.useState(0);
  const [logoFailed, setLogoFailed] = React.useState(false);
  const [diagnosis, setDiagnosis] = React.useState<StreamDiagnosis | null>(null);
  const [diagnosing, setDiagnosing] = React.useState(false);
  const [controlsVisible, setControlsVisible] = React.useState(true);
  const [behindLive, setBehindLive] = React.useState(false);
  const [volumeVisible, setVolumeVisible] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  const [paused, setPaused] = React.useState(true);

  const [transcode, setTranscode] = React.useState<TranscodeSession | null>(null);
  const [transcoding, setTranscoding] = React.useState(false);
  const [seekOffset, setSeekOffset] = React.useState(0);
  const [virtualPosition, setVirtualPosition] = React.useState(0);

  const [audioIndex, setAudioIndex] = React.useState<number | null>(null);
  const [subtitleIndex, setSubtitleIndex] = React.useState<number | null>(null);

  const [externalCues, setExternalCues] = React.useState<SubtitleCue[] | null>(null);
  const [externalName, setExternalName] = React.useState<string | null>(null);
  const [externalActive, setExternalActive] = React.useState(false);
  const [activeCueText, setActiveCueText] = React.useState<string | null>(null);
  /** Manual subtitle sync correction, in milliseconds. */
  const [subtitleDelayMs, setSubtitleDelayMs] = React.useState(0);
  const [videoSize, setVideoSize] = React.useState<{ width: number; height: number } | null>(null);
  /** Holds the pre-seek picture while the decoder restarts. */
  const freezeRef = React.useRef<HTMLCanvasElement>(null);
  const [frozen, setFrozen] = React.useState(false);

  /**
   * Renditions the manifest offers, and which one is on screen.
   *
   * Only meaningful on the hls.js path; a single-rendition stream reports one
   * level and the picker stays hidden. `-1` means the adaptive algorithm is
   * choosing.
   */
  const [qualityLevels, setQualityLevels] = React.useState<QualityLevel[]>([]);
  const [activeLevel, setActiveLevel] = React.useState(-1);
  const [manualLevel, setManualLevel] = React.useState(-1);
  const subtitleFileRef = React.useRef<HTMLInputElement>(null);
  const volumeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const volumeTouchedRef = React.useRef(false);

  const volume = useSettingsStore((store) => store.volume);
  const muted = useSettingsStore((store) => store.muted);
  const autoplay = useSettingsStore((store) => store.autoplay);
  const setMuted = useSettingsStore((store) => store.setMuted);
  const aspectRatio = useSettingsStore((store) => store.aspectRatio);
  const playbackRate = useSettingsStore((store) => store.playbackRate);
  const keepScreenAwake = useSettingsStore((store) => store.keepScreenAwake);
  const subtitleStyle = useSettingsStore((store) => store.subtitleStyle);

  const sleepEndsAt = useSleepTimerStore((store) => store.endsAt);
  const markSleepFired = useSleepTimerStore((store) => store.markFired);

  React.useEffect(() => setLogoFailed(false), [logo]);
  React.useEffect(() => {
    setDiagnosis(null);
  }, [url]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let silentRetries = 0;
    let triedTsFallback = false;
    let hlsStageTimer: ReturnType<typeof setTimeout> | null = null;

    const teardown = () => {
      attachedUrlRef.current = null;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (mpegtsRef.current) {
        mpegtsRef.current.destroy();
        mpegtsRef.current = null;
      }
      if (video.src) {
        video.removeAttribute("src");
        video.load();
      }
    };

    if (!url) {
      teardown();
      setState({ status: "idle" });
      return;
    }

    const capability = checkPlaybackCapability(
      { url, kind: detectStreamKind(url), insecure: url.toLowerCase().startsWith("http://") },
      { pageIsSecure: isHttpsPage(), isDesktop: isDesktop() },
    );

    if (!capability.playable) {
      teardown();
      setState({
        status: "error",
        message: capability.message ?? "Bu yayın bu platformda oynatılamıyor.",
        recoverable: false,
        diagnose: false,
      });
      return;
    }

    setState({ status: "loading" });

    let connectTimer: ReturnType<typeof setTimeout> | null = null;

    const fail = (message: string, recoverable: boolean, diagnose: boolean) => {
      if (cancelled) return;
      if (connectTimer) clearTimeout(connectTimer);
      setState({ status: "error", message, recoverable, diagnose });
    };

    const stopWatchdog = () => {
      if (connectTimer) clearTimeout(connectTimer);
      connectTimer = null;
    };

    connectTimer = setTimeout(() => {
      if (cancelled) return;
      fail("Yayın açılamadı — sağlayıcı yanıt vermedi.", true, true);
    }, CONNECT_TIMEOUT_MS);

    const video2 = video;
    video2.addEventListener("playing", stopWatchdog, { once: true });

    const cleanup = () => {
      cancelled = true;
      stopWatchdog();
      video2.removeEventListener("playing", stopWatchdog);
      teardown();
    };

    if (!live && getDesktopBridge() && !isBrowserPlayableSource(url) && !transcode) {
      return cleanup;
    }

    if (transcode) {
      attachedUrlRef.current = transcode.url;

      const params = new URLSearchParams({ t: String(Math.floor(seekOffset)) });
      if (audioIndex !== null) params.set("a", String(audioIndex));
      if (subtitleIndex !== null) params.set("s", String(subtitleIndex));
      video.src = `${transcode.url}&${params.toString()}`;
      if (autoplay) void video.play().catch(() => undefined);
      return cleanup;
    }

    const kind = detectStreamKind(url);

    const startNative = () => {
      attachedUrlRef.current = url;
      video.src = url;
      if (autoplay) void video.play().catch(() => undefined);
    };

    const startMpegTs = async (tsUrl: string) => {
      const mpegts = (await import("mpegts.js")).default;
      if (cancelled) return;

      if (!mpegts.getFeatureList().mseLivePlayback) {
        fail("Tarayıcınız bu yayın biçimini oynatamıyor.", false, false);
        return;
      }

      const player = mpegts.createPlayer(
        { type: "mpegts", isLive: true, url: rewriteUrl ? rewriteUrl(tsUrl) : tsUrl },
        {
          enableStashBuffer: true,
          stashInitialSize: 256 * 1024,

          liveBufferLatencyChasing: true,
          liveBufferLatencyMaxLatency: 8,
          liveBufferLatencyMinRemain: 2,

          lazyLoad: false,

          autoCleanupSourceBuffer: true,
          autoCleanupMaxBackwardDuration: 40,
          autoCleanupMinBackwardDuration: 20,
        },
      );

      mpegtsRef.current = player;
      attachedUrlRef.current = tsUrl;
      player.attachMediaElement(video);
      player.on(mpegts.Events.ERROR, () => {
        if (!cancelled) fail("Yayına bağlanılamadı.", true, true);
      });
      player.load();
      if (autoplay) void player.play()?.catch?.(() => undefined);
    };

    const switchToTs = (): boolean => {
      if (!fallbackTsUrl || triedTsFallback || cancelled) return false;
      triedTsFallback = true;
      if (hlsStageTimer) {
        clearTimeout(hlsStageTimer);
        hlsStageTimer = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      void startMpegTs(fallbackTsUrl);
      return true;
    };

    const startHlsJs = async () => {
      const { default: HlsCtor } = await import("hls.js");
      if (cancelled) return;

      if (!HlsCtor.isSupported()) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          startNative();
        } else {
          fail("Tarayıcınız bu yayın biçimini desteklemiyor.", false, false);
        }
        return;
      }

      const hls = new HlsCtor({
        lowLatencyMode: false,
        enableWorker: true,
        backBufferLength: 30,
        maxBufferLength: 24,

        manifestLoadingMaxRetry: fallbackTsUrl ? 0 : 2,
        levelLoadingMaxRetry: fallbackTsUrl ? 1 : 3,
        fragLoadingMaxRetry: fallbackTsUrl ? 2 : 4,
        ...(rewriteUrl ? { loader: createRewritingLoader(HlsCtor, rewriteUrl) } : {}),
      });

      hlsRef.current = hls;
      attachedUrlRef.current = url;
      hls.attachMedia(video);
      hls.loadSource(url);

      hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
        if (cancelled) return;
        silentRetries = 0;
        setQualityLevels(
          hls.levels.map((level, index) => ({
            index,
            height: level.height || null,
            bitrate: level.bitrate || null,
          })),
        );
        if (autoplay) void video.play().catch(() => undefined);
      });

      /**
       * Reported whenever the adaptive algorithm moves, so the menu can show
       * which rendition "Otomatik" has settled on rather than just the word.
       */
      hls.on(HlsCtor.Events.LEVEL_SWITCHED, (_event, data) => {
        if (!cancelled) setActiveLevel(data.level);
      });

      hls.on(HlsCtor.Events.ERROR, (_event, data) => {
        if (cancelled || !data.fatal) return;

        if (switchToTs()) return;

        if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR && silentRetries < MAX_SILENT_RETRIES) {
          silentRetries++;
          hls.startLoad();
          return;
        }
        if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR && silentRetries < MAX_SILENT_RETRIES) {
          silentRetries++;
          hls.recoverMediaError();
          return;
        }

        const isNetwork = data.type === HlsCtor.ErrorTypes.NETWORK_ERROR;
        fail(
          isNetwork
            ? "Yayına bağlanılamadı."
            : "Yayın çözümlenemedi; biçim tarayıcı tarafından desteklenmiyor olabilir.",
          true,
          isNetwork,
        );
      });

      if (fallbackTsUrl) {
        hlsStageTimer = setTimeout(() => {
          if (!cancelled && videoRef.current?.paused !== false) switchToTs();
        }, HLS_STAGE_TIMEOUT_MS);
      }
    };

    if (kind === "mpegts") {
      void startMpegTs(url);
      return;
    }

    if (kind === "hls") {
      void startHlsJs();
    } else {
      startNative();
    }

    return () => {
      if (hlsStageTimer) clearTimeout(hlsStageTimer);
      cleanup();
    };
  }, [
    url,
    attempt,
    autoplay,
    rewriteUrl,
    fallbackTsUrl,
    transcode,
    seekOffset,
    live,
    audioIndex,
    subtitleIndex,
  ]);

  React.useEffect(() => {
    const bridge = getDesktopBridge();
    setTranscode(null);
    setSeekOffset(0);
    setVirtualPosition(0);

    setAudioIndex(null);
    setSubtitleIndex(null);
    setExternalCues(null);
    setExternalName(null);
    setExternalActive(false);
    setSubtitleDelayMs(0);

    if (!url || !bridge || live) return;
    if (isBrowserPlayableSource(url)) return;

    const startAt = startPositionSecs && startPositionSecs > 5 ? Math.floor(startPositionSecs) : 0;
    setSeekOffset(startAt);
    setVirtualPosition(startAt);

    let cancelled = false;
    setTranscoding(true);

    void bridge
      .startTranscode(url)
      .then((session) => {
        if (cancelled) return;
        setTranscode(session);

        const settings = useSettingsStore.getState();

        const wantedAudio = settings.preferredAudioLang;
        if (wantedAudio && session.audioTracks.length > 1) {
          const match = session.audioTracks.find((track) => track.language === wantedAudio);
          if (match) setAudioIndex(match.index);
        }

        const wantedSubtitle = settings.preferredSubtitleLang;
        if (wantedSubtitle) {
          const match = session.subtitleTracks.find(
            (track) => track.language === wantedSubtitle && track.textBased,
          );
          if (match) setSubtitleIndex(match.index);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          status: "error",
          message: "Yerel dönüştürücü başlatılamadı.",
          recoverable: true,
          diagnose: false,
        });
      })
      .finally(() => {
        if (!cancelled) setTranscoding(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, live]);

  React.useEffect(() => {
    if (!transcode) return;
    const sessionUrl = transcode.url;
    return () => {
      void getDesktopBridge()?.stopTranscode(sessionUrl);
    };
  }, [transcode]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !transcode) return;

    const update = () => setVirtualPosition(seekOffset + video.currentTime);
    video.addEventListener("timeupdate", update);
    return () => video.removeEventListener("timeupdate", update);
  }, [transcode, seekOffset]);

  const seekDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Copies the frame on screen into a canvas.
   *
   * Restarting ffmpeg takes a few seconds, during which the media element has
   * no data and paints black — which reads as a crash rather than a wait.
   * Holding the last frame instead makes the delay legible. Only drawing is
   * needed, never reading pixels back, so the canvas being tainted by the
   * cross-origin local stream does not matter.
   */
  const captureFrame = React.useCallback((): boolean => {
    const video = videoRef.current;
    const canvas = freezeRef.current;
    if (!video || !canvas || video.videoWidth === 0) return false;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) return false;

    try {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleTranscodeSeek = React.useCallback(
    (seconds: number) => {
      const target = Math.max(0, Math.floor(seconds));

      setVirtualPosition(target);

      if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current);
      seekDebounceRef.current = setTimeout(() => {
        seekDebounceRef.current = null;
        // Grabbed at commit time rather than on every drag frame; the picture
        // is still the pre-seek one and the copy costs nothing until now.
        if (captureFrame()) setFrozen(true);
        setSeekOffset(target);
      }, SEEK_DEBOUNCE_MS);
    },
    [captureFrame],
  );

  React.useEffect(() => {
    return () => {
      if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current);
    };
  }, []);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = muted;
  }, [volume, muted]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = live ? 1 : playbackRate;
  }, [playbackRate, live, url, transcode]);

  useWakeLock(keepScreenAwake && Boolean(url) && !paused);

  React.useEffect(() => {
    if (sleepEndsAt === null) return;

    const check = () => {
      if (Date.now() < sleepEndsAt) return;
      videoRef.current?.pause();
      markSleepFired();
      toast.info("Uyku zamanlayıcısı doldu — oynatma durduruldu.");
    };

    const timer = setInterval(check, 1000);
    check();
    return () => clearInterval(timer);
  }, [sleepEndsAt, markSleepFired]);

  React.useEffect(() => {
    if (state.status !== "error" || !state.diagnose || !url || diagnosis) return;

    let cancelled = false;
    setDiagnosing(true);

    void diagnoseStream(url, { canSwitchToHttp })
      .then((result) => {
        if (!cancelled) setDiagnosis(result);
      })
      .finally(() => {
        if (!cancelled) setDiagnosing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [state, url, diagnosis, canSwitchToHttp]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !live) return;

    const check = () => {
      const syncPosition = hlsRef.current?.liveSyncPosition;

      if (typeof syncPosition === "number" && Number.isFinite(syncPosition)) {
        setBehindLive(syncPosition - video.currentTime > BEHIND_LIVE_SECONDS);
        return;
      }

      if (video.seekable.length > 0) {
        const edge = video.seekable.end(video.seekable.length - 1);
        setBehindLive(edge - video.currentTime > BEHIND_LIVE_NATIVE_SECONDS);
      }
    };

    video.addEventListener("timeupdate", check);
    const timer = setInterval(check, 1000);

    return () => {
      video.removeEventListener("timeupdate", check);
      clearInterval(timer);
    };
  }, [live, url]);

  const seekToLive = React.useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const target = hlsRef.current?.liveSyncPosition;
    if (typeof target === "number" && Number.isFinite(target)) {
      video.currentTime = target;
    } else if (video.seekable.length > 0) {
      video.currentTime = video.seekable.end(video.seekable.length - 1);
    }
    void video.play().catch(() => undefined);
  }, []);

  const revealControls = React.useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      const video = videoRef.current;

      if (video && !video.paused) setControlsVisible(false);
    }, 2600);
  }, []);

  React.useEffect(() => {
    if (!volumeTouchedRef.current) {
      volumeTouchedRef.current = true;
      return;
    }

    setVolumeVisible(true);
    if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
    volumeTimerRef.current = setTimeout(() => setVolumeVisible(false), VOLUME_OSD_MS);

    return () => {
      if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
    };
  }, [volume, muted]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || live || !startPositionSecs || startPositionSecs < 5) return;

    if (transcode) return;

    const applyPosition = () => {
      if (Number.isFinite(video.duration) && startPositionSecs < video.duration - 10) {
        video.currentTime = startPositionSecs;
      }
    };

    video.addEventListener("loadedmetadata", applyPosition, { once: true });
    return () => video.removeEventListener("loadedmetadata", applyPosition);
  }, [live, startPositionSecs, url, transcode]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || live || !onProgress) return;

    let lastReport = 0;
    const report = (force: boolean) => {
      const position = transcode ? seekOffset + video.currentTime : video.currentTime;
      const duration = transcode ? (transcode.durationSecs ?? 0) : video.duration;

      if (!Number.isFinite(duration) || duration <= 0) return;
      const now = Date.now();
      if (!force && now - lastReport < 5_000) return;
      lastReport = now;
      onProgress(position, duration);
    };

    const onTimeUpdate = () => report(false);
    const onPause = () => report(true);
    const onSeeked = () => report(true);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeeked);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeeked);

      report(true);
    };
  }, [live, onProgress, url, transcode, seekOffset]);

  const clearWaitingTimer = React.useCallback(() => {
    if (waitingTimerRef.current) {
      clearTimeout(waitingTimerRef.current);
      waitingTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current);
    };
  }, []);

  const togglePlay = React.useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  }, []);

  const toggleFullscreen = React.useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void containerRef.current?.requestFullscreen().catch(() => undefined);
  }, []);

  const seekBy = React.useCallback(
    (delta: number) => {
      if (live) return;
      if (transcode) {
        handleTranscodeSeek(Math.max(0, virtualPosition + delta));
        return;
      }
      const video = videoRef.current;
      if (!video || !Number.isFinite(video.duration)) return;
      video.currentTime = Math.min(
        Math.max(0, video.currentTime + delta),
        Math.max(0, video.duration - 1),
      );
    },
    [live, transcode, virtualPosition, handleTranscodeSeek],
  );

  useMediaSession({
    title,
    subtitle: mediaSubtitle ?? null,
    artwork: logo ?? null,
    active: Boolean(url),
    onPlay: () => void videoRef.current?.play().catch(() => undefined),
    onPause: () => videoRef.current?.pause(),
    onPrevious,
    onNext,
    onSeekBy: live ? undefined : seekBy,
  });

  useMediaSessionState(paused, Boolean(url));

  React.useEffect(() => {
    onPlayingChange?.(Boolean(url) && !paused);
  }, [paused, url, onPlayingChange]);

  React.useEffect(() => {
    if (!url) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      switch (event.key) {
        case " ":
        case "k":
        case "K":
          event.preventDefault();
          togglePlay();
          break;
        case "m":
        case "M":
          event.preventDefault();
          setMuted(!muted);
          break;
        case "f":
        case "F":
          event.preventDefault();
          toggleFullscreen();
          break;
        case "Escape":
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
          return;
        case "ArrowUp":
          event.preventDefault();
          useSettingsStore.getState().setVolume(volume + 0.05);
          break;
        case "ArrowDown":
          event.preventDefault();
          useSettingsStore.getState().setVolume(volume - 0.05);
          break;
        case "ArrowLeft":
          if (live) return;
          event.preventDefault();
          seekBy(-10);
          break;
        case "ArrowRight":
          if (live) return;
          event.preventDefault();
          seekBy(10);
          break;
        case "n":
        case "N":
          if (!onNext) return;
          event.preventDefault();
          onNext();
          break;
        case "p":
        case "P":
          if (!onPrevious) return;
          event.preventDefault();
          onPrevious();
          break;
        default:
          return;
      }
      revealControls();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    url,
    muted,
    volume,
    live,
    togglePlay,
    toggleFullscreen,
    setMuted,
    revealControls,
    seekBy,
    onNext,
    onPrevious,
  ]);

  const clickTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVideoClick = () => {
    if (clickTimerRef.current) return;
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      togglePlay();
    }, 220);
  };

  const handleVideoDoubleClick = () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    toggleFullscreen();
  };

  React.useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  const retry = () => {
    setDiagnosis(null);
    setAttempt((value) => value + 1);
  };

  const showHttpFix =
    canSwitchToHttp && diagnosis?.kind === "blocked-by-browser" && Boolean(onSwitchToHttp);

  const audioTrackOptions: TrackOption[] = React.useMemo(() => {
    if (!transcode) return [];
    return transcode.audioTracks.map((track, position) => {
      const language = languageName(track.language);
      return {
        id: String(track.index),
        label: track.title ?? language ?? `Ses ${position + 1}`,
        detail:
          [track.title ? language : null, track.codec.toUpperCase(), track.layout]
            .filter(Boolean)
            .join(" · ") || null,
      };
    });
  }, [transcode]);

  const subtitleTrackOptions: TrackOption[] = React.useMemo(() => {
    const options: TrackOption[] = (transcode?.subtitleTracks ?? []).map((track, position) => {
      const language = languageName(track.language);
      return {
        id: String(track.index),
        label: track.title ?? language ?? `Altyazı ${position + 1}`,
        detail:
          [
            track.title ? language : null,
            track.forced ? "zorunlu" : null,

            track.textBased ? null : "görüntü tabanlı — videoya yakılır",
          ]
            .filter(Boolean)
            .join(" · ") || null,
      };
    });

    if (externalCues) {
      options.push({
        id: EXTERNAL_SUBTITLE_ID,
        label: externalName ?? "Dosyadan",
        detail: `Yüklenen dosya · ${externalCues.length} satır`,
      });
    }

    return options;
  }, [transcode, externalCues, externalName]);

  const activeSubtitleId = externalActive
    ? EXTERNAL_SUBTITLE_ID
    : subtitleIndex !== null
      ? String(subtitleIndex)
      : null;

  const selectSubtitle = React.useCallback((id: string | null) => {
    if (id === EXTERNAL_SUBTITLE_ID) {
      setExternalActive(true);
      setSubtitleIndex(null);
      return;
    }
    setExternalActive(false);
    setSubtitleIndex(id === null ? null : Number(id));
  }, []);

  const embeddedTrack =
    subtitleIndex === null
      ? null
      : (transcode?.subtitleTracks.find((track) => track.index === subtitleIndex) ?? null);

  const embeddedIsText = Boolean(embeddedTrack?.textBased);

  const embeddedCues = useSubtitleTrack(
    transcode?.subtitleUrl ?? null,
    embeddedIsText,
    `${seekOffset}|${audioIndex}|${subtitleIndex}`,
  );

  React.useEffect(() => {
    const cues = externalActive ? externalCues : embeddedIsText ? embeddedCues : null;
    const video = videoRef.current;

    if (!video || !cues || cues.length === 0) {
      setActiveCueText(null);
      return;
    }

    let lastText: string | null = null;
    const tick = () => {
      const time = externalActive && transcode ? seekOffset + video.currentTime : video.currentTime;
      const text = findCueAt(cues, time - subtitleDelayMs / 1000)?.text ?? null;

      if (text !== lastText) {
        lastText = text;
        setActiveCueText(text);
      }
    };

    tick();
    const timer = setInterval(tick, 100);
    return () => {
      clearInterval(timer);
      setActiveCueText(null);
    };
  }, [externalActive, externalCues, embeddedCues, embeddedIsText, seekOffset, transcode, subtitleDelayMs]);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const update = () => {
      setVideoSize(
        video.videoWidth > 0 ? { width: video.videoWidth, height: video.videoHeight } : null,
      );
    };

    video.addEventListener("loadedmetadata", update);
    video.addEventListener("resize", update);
    update();

    return () => {
      video.removeEventListener("loadedmetadata", update);
      video.removeEventListener("resize", update);
    };
  }, [url, transcode]);

  const streamInfo = React.useMemo(() => {
    const rows: Array<{ label: string; value: string }> = [];

    if (videoSize)
      rows.push({ label: "Çözünürlük", value: `${videoSize.width}×${videoSize.height}` });

    if (transcode) {
      rows.push({
        label: "Video",
        value: `${(transcode.videoCodec ?? "?").toUpperCase()} · ${
          transcode.videoAction === "copy" ? "kopyalanıyor" : "çevriliyor"
        }`,
      });
      rows.push({
        label: "Ses",
        value: `${(transcode.audioCodec ?? "?").toUpperCase()} · ${
          transcode.audioAction === "copy" ? "kopyalanıyor" : "çevriliyor"
        }`,
      });
      rows.push({ label: "Mod", value: "Yerel dönüştürme (ffmpeg)" });
    } else if (url) {
      const kind = detectStreamKind(url);
      rows.push({
        label: "Mod",
        value: kind === "hls" ? "HLS" : kind === "mpegts" ? "MPEG-TS" : "Doğrudan",
      });
    }

    return rows;
  }, [videoSize, transcode, url]);

  React.useEffect(() => {
    setQualityLevels([]);
    setActiveLevel(-1);
    setManualLevel(-1);
    setFrozen(false);
  }, [url]);

  /**
   * Safety net for a restart that never produces a picture.
   *
   * `playing` clears the held frame, but a source that fails to resume would
   * otherwise leave a still image on screen forever, looking like a freeze
   * rather than an error.
   */
  React.useEffect(() => {
    if (!frozen) return;
    const timer = setTimeout(() => setFrozen(false), CONNECT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [frozen]);

  React.useEffect(() => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = manualLevel;
  }, [manualLevel]);

  /**
   * Quality options.
   *
   * Hidden entirely when the stream offers fewer than two renditions, which is
   * the common case for these channels — a picker with one entry is noise.
   * Sorted tallest first so the list reads the way a viewer expects.
   */
  const qualityOptions: TrackOption[] | undefined = React.useMemo(() => {
    if (qualityLevels.length < 2) return undefined;

    const describe = (level: QualityLevel) => {
      const height = level.height ? `${level.height}p` : `Seviye ${level.index + 1}`;
      const rate = level.bitrate ? `${Math.round(level.bitrate / 1000)} kbps` : null;
      return { label: height, detail: rate };
    };

    const auto = qualityLevels.find((level) => level.index === activeLevel);
    return [
      {
        id: "-1",
        label: "Otomatik",
        detail: auto?.height ? `şu an ${auto.height}p` : null,
      },
      ...[...qualityLevels]
        .sort((a, b) => (b.height ?? 0) - (a.height ?? 0))
        .map((level) => ({ id: String(level.index), ...describe(level) })),
    ];
  }, [qualityLevels, activeLevel]);

  const handleSubtitleFile = React.useCallback((file: File) => {
    void file.text().then((text) => {
      const cues = parseSubtitles(text);
      if (cues.length === 0) {
        toast.error("Altyazı okunamadı — yalnızca .srt ve .vtt destekleniyor.");
        return;
      }
      setExternalCues(cues);
      setExternalName(file.name.replace(/\.[^.]+$/, ""));
      setExternalActive(true);
      setSubtitleIndex(null);
      toast.success(`Altyazı yüklendi — ${cues.length} satır`);
    });
  }, []);

  const forcedRatio = aspectRatio === "16:9" ? "16 / 9" : aspectRatio === "4:3" ? "4 / 3" : null;

  const videoFitClass =
    aspectRatio === "zoom"
      ? "object-cover"
      : aspectRatio === "fill" || forcedRatio
        ? "object-fill"
        : "object-contain";

  const videoStyle: React.CSSProperties | undefined = forcedRatio
    ? {
        aspectRatio: forcedRatio,
        height: "100%",
        width: "auto",
        maxWidth: "100%",
        maxHeight: "100%",
        margin: "0 auto",
      }
    : undefined;

  return (
    <div
      ref={containerRef}
      onMouseMove={revealControls}
      onMouseLeave={() => {
        const video = videoRef.current;
        if (video && !video.paused) setControlsVisible(false);
      }}
      onTouchStart={revealControls}

      style={{ containerType: "inline-size" }}
      className={cn(
        "border-border/70 group relative aspect-video w-full overflow-hidden rounded-lg border bg-black",
        "focus-visible:ring-ring/70 focus-visible:outline-none focus-visible:ring-2",
        className,
      )}
    >
      <video
        ref={videoRef}
        playsInline
        preload="none"
        className={cn("size-full bg-black", videoFitClass)}
        style={videoStyle}
        onClick={handleVideoClick}
        onDoubleClick={handleVideoDoubleClick}
        onEnded={() => {
          const element = videoRef.current;
          const duration = element && Number.isFinite(element.duration) ? element.duration : 0;
          onEnded?.(duration);
        }}
        onPause={() => {
          setControlsVisible(true);
          setPaused(true);
        }}
        onPlay={() => setPaused(false)}
        onPlaying={() => {
          clearWaitingTimer();
          setPaused(false);
          // The real picture is back; drop the held frame.
          setFrozen(false);
          setState({ status: "playing" });
        }}
        onCanPlay={clearWaitingTimer}
        onWaiting={() => {
          if (waitingTimerRef.current) return;
          waitingTimerRef.current = setTimeout(() => {
            waitingTimerRef.current = null;
            setState((current) => (current.status === "error" ? current : { status: "loading" }));
          }, WAITING_OVERLAY_DELAY_MS);
        }}
        onError={() => {
          if (!attachedUrlRef.current) return;
          setState({
            status: "error",
            message: "Yayın açılamadı.",
            recoverable: true,
            diagnose: true,
          });
        }}
      />

      {url ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3",
            "bg-gradient-to-b from-black/70 to-transparent p-4",
            "duration-base ease-brand transition-opacity",
            controlsVisible ? "opacity-100" : "opacity-0",
          )}
        >
          {logo && !logoFailed ? (
            <img
              src={logo}
              alt=""
              className="size-8 shrink-0 rounded-md bg-white/10 object-contain"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <span className="text-2xs grid size-8 shrink-0 place-items-center rounded-md bg-white/10 font-semibold text-white">
              {initialsOf(title)}
            </span>
          )}
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">{title}</p>
        </div>
      ) : null}

      {/*
        Always mounted so a frame can be drawn into it at the moment the seek
        commits; only its visibility changes.
      */}
      <div
        aria-hidden={!frozen}
        className={cn(
          "pointer-events-none absolute inset-0 z-10",
          "transition-opacity duration-base ease-brand",
          frozen ? "opacity-100" : "opacity-0",
        )}
      >
        <canvas ref={freezeRef} className="size-full bg-black object-contain" />

        {frozen ? (
          <div className="absolute inset-0 grid place-items-center bg-black/45">
            <div className="flex flex-col items-center gap-2.5">
              <Loader2 className="size-6 animate-spin text-white/80" />
              <p className="tabular text-sm text-white/80">
                {formatDuration(virtualPosition)} konumuna atlanıyor
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {url && !live ? (
        <SubtitleOverlay
          text={activeCueText}
          style={subtitleStyle}
          controlsVisible={controlsVisible || menuOpen}
        />
      ) : null}

      {overlay}

      {url ? <VolumeIndicator value={volume} muted={muted} visible={volumeVisible} /> : null}

      <input
        ref={subtitleFileRef}
        type="file"
        accept=".srt,.vtt,text/vtt,application/x-subrip"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];

          event.target.value = "";
          if (file) handleSubtitleFile(file);
        }}
      />

      {url && state.status !== "error" ? (
        <PlayerControls
          videoRef={videoRef}
          containerRef={containerRef}
          live={live}
          behindLive={behindLive}
          onSeekToLive={seekToLive}

          visible={controlsVisible || menuOpen || state.status !== "playing"}
          virtualPosition={transcode ? virtualPosition : null}
          virtualDuration={transcode?.durationSecs ?? null}
          onSeek={transcode ? handleTranscodeSeek : undefined}
          onToggleMenu={() => setMenuOpen((open) => !open)}
          menuOpen={menuOpen}
          onPrevious={onPrevious}
          onNext={onNext}
          previousLabel={previousLabel}
          nextLabel={nextLabel}
        />
      ) : null}

      {url && state.status !== "error" ? (
        <PlayerMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          live={live}
          audioTracks={audioTrackOptions}
          activeAudioId={
            audioIndex !== null ? String(audioIndex) : (audioTrackOptions[0]?.id ?? null)
          }
          onSelectAudio={(id) => setAudioIndex(Number(id))}
          subtitleTracks={subtitleTrackOptions}
          activeSubtitleId={activeSubtitleId}

          onSelectSubtitle={live ? undefined : selectSubtitle}
          onLoadSubtitleFile={live ? undefined : () => subtitleFileRef.current?.click()}
          busy={state.status === "loading"}
          streamInfo={streamInfo}
          qualityTracks={qualityOptions}
          activeQualityId={String(manualLevel)}
          onSelectQuality={(id) => setManualLevel(Number(id))}
          subtitleDelayMs={subtitleDelayMs}
          onSubtitleDelayChange={(delta) =>
            setSubtitleDelayMs((current) => (delta === 0 ? 0 : current + delta))
          }
        />
      ) : null}

      {state.status === "loading" && !frozen ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/45">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-6 animate-spin text-white/80" />
            <p className="text-sm text-white/70">Bağlanılıyor…</p>
          </div>
        </div>
      ) : null}

      {state.status === "idle" ? (
        <div className="absolute inset-0 grid place-items-center">
          <p className="text-sm text-white/50">İzlemek için soldan bir kanal seçin</p>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-black/85 px-6 py-8 text-center">
          <span className="bg-destructive/15 text-destructive grid size-11 shrink-0 place-items-center rounded-full">
            {diagnosis?.kind === "blocked-by-browser" ? (
              <ShieldAlert className="size-5" />
            ) : (
              <AlertTriangle className="size-5" />
            )}
          </span>

          <p className="max-w-md text-sm leading-relaxed text-white/85">{state.message}</p>

          {diagnosing ? (
            <span className="flex items-center gap-2 text-xs text-white/55">
              <Spinner className="text-white/55" /> Yayın durumu kontrol ediliyor…
            </span>
          ) : diagnosis ? (
            <p className="max-w-md text-xs leading-relaxed text-white/60">{diagnosis.message}</p>
          ) : null}

          {url ? (
            <p className="text-2xs max-w-md truncate text-white/30">{maskCredentialsInUrl(url)}</p>
          ) : null}

          <div className="flex flex-wrap items-center justify-center gap-2">
            {showHttpFix ? (
              <Button size="sm" onClick={onSwitchToHttp}>
                Protokolü HTTP yap ve tekrar dene
              </Button>
            ) : null}
            {state.recoverable ? (
              <Button variant="secondary" size="sm" onClick={retry}>
                <RotateCcw /> Tekrar dene
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
