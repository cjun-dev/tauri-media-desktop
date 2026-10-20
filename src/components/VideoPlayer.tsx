import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MediaItem } from "../types/media";
import { useMediaStore } from "../hooks/useMediaStore";
import { isTauri } from "../utils/media";

type VideoPlayerProps = {
  item: MediaItem;
  isPlaying: boolean;
  replayNonce: number;
  onPlayingChange: (playing: boolean) => void;
  onEnded?: () => void;
  mediaRef?: React.RefObject<HTMLVideoElement | null>;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function PrevIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6h2.5v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" fill="currentColor" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 18l8.5-6L6 6v12zm10.5-12H19v12h-2.5V6z" fill="currentColor" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" fill="currentColor" />
    </svg>
  );
}

function VolumeIcon({ muted = false }: { muted?: boolean }) {
  if (muted) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
        <path
          d="M4 9v6h4l5 4V5L8 9H4z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M16 9.5 20.5 14M20.5 9.5 16 14"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path
        d="M4 9v6h4l5 4V5L8 9H4z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M16 9a3.2 3.2 0 0 1 0 6M18.5 7a5.5 5.5 0 0 1 0 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path
        d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path
        d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function setVideoFullscreenActive(active: boolean) {
  document.documentElement.classList.toggle("video-fullscreen-active", active);
}

export function VideoPlayer({
  item,
  isPlaying,
  replayNonce,
  onPlayingChange,
  onEnded,
  mediaRef,
}: VideoPlayerProps) {
  const { playNext, playPrev } = useMediaStore();
  const localRef = useRef<HTMLVideoElement>(null);
  const videoRef = mediaRef ?? localRef;
  const panelRef = useRef<HTMLElement>(null);
  const seekingRef = useRef(false);
  const volumePanelRef = useRef<HTMLDivElement>(null);
  const videoFullscreenRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const applyFullscreenState = (active: boolean) => {
    videoFullscreenRef.current = active;
    setVideoFullscreenActive(active);
    setIsFullscreen(active);
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.src = item.src ?? "";
    video.load();
    if (isPlaying) {
      void video.play().catch((error: unknown) => {
        // load()/切歌会中断上一次 play，忽略 AbortError
        if (error instanceof DOMException && error.name === "AbortError") return;
        onPlayingChange(false);
      });
    }
    // 仅在切换媒体时重新加载；暂停/继续由下方 effect 处理，避免重置进度
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally omit isPlaying
  }, [item, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      void video.play().catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        onPlayingChange(false);
      });
    } else {
      video.pause();
    }
  }, [isPlaying, videoRef, onPlayingChange]);

  useEffect(() => {
    if (replayNonce === 0) return;
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      onPlayingChange(false);
    });
  }, [replayNonce, videoRef, onPlayingChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
  }, [volume, videoRef, item]);

  useEffect(() => {
    if (!volumeOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!volumePanelRef.current?.contains(event.target as Node)) {
        setVolumeOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [volumeOpen]);

  useEffect(() => {
    if (isTauri()) {
      const win = getCurrentWindow();

      const syncWindowFullscreen = async () => {
        if (!videoFullscreenRef.current) return;
        const fullscreen = await win.isFullscreen();
        if (!fullscreen) {
          applyFullscreenState(false);
        }
      };

      void syncWindowFullscreen();
      const unlistenPromise = win.onResized(() => {
        void syncWindowFullscreen();
      });

      return () => {
        void unlistenPromise.then((unlisten) => unlisten());
        if (videoFullscreenRef.current) {
          void getCurrentWindow().setFullscreen(false);
        }
        setVideoFullscreenActive(false);
        videoFullscreenRef.current = false;
      };
    }

    const syncElementFullscreen = () => {
      const panel = panelRef.current;
      const active =
        document.fullscreenElement ??
        (document as Document & { webkitFullscreenElement?: Element })
          .webkitFullscreenElement;
      applyFullscreenState(Boolean(panel && active === panel));
    };

    document.addEventListener("fullscreenchange", syncElementFullscreen);
    document.addEventListener("webkitfullscreenchange", syncElementFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", syncElementFullscreen);
      document.removeEventListener(
        "webkitfullscreenchange",
        syncElementFullscreen,
      );
      setVideoFullscreenActive(false);
      videoFullscreenRef.current = false;
    };
  }, []);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);

    const video = videoRef.current;
    if (!video) return;

    const syncTime = () => {
      if (!seekingRef.current) {
        setCurrentTime(video.currentTime || 0);
      }
    };

    const syncDuration = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    };

    syncTime();
    syncDuration();

    video.addEventListener("timeupdate", syncTime);
    video.addEventListener("loadedmetadata", syncDuration);
    video.addEventListener("durationchange", syncDuration);
    video.addEventListener("seeked", syncTime);

    return () => {
      video.removeEventListener("timeupdate", syncTime);
      video.removeEventListener("loadedmetadata", syncDuration);
      video.removeEventListener("durationchange", syncDuration);
      video.removeEventListener("seeked", syncTime);
    };
  }, [item, videoRef]);

  const seekTo = (nextTime: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(nextTime)) return;
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleSeekChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTime(Number(event.target.value));
  };

  const handleSeekStart = () => {
    seekingRef.current = true;
  };

  const handleSeekCommit = (event: React.SyntheticEvent<HTMLInputElement>) => {
    seekTo(Number(event.currentTarget.value));
    seekingRef.current = false;
  };

  const toggleFullscreen = async () => {
    const next = !isFullscreen;

    try {
      if (isTauri()) {
        await getCurrentWindow().setFullscreen(next);
        applyFullscreenState(next);
        return;
      }

      const panel = panelRef.current;
      if (!panel) return;

      if (!next) {
        const doc = document as Document & {
          webkitExitFullscreen?: () => Promise<void> | void;
        };
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
        return;
      }

      const el = panel as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
      };
      if (panel.requestFullscreen) {
        await panel.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      }
    } catch {
      // 用户拒绝或环境不支持全屏时忽略
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const canSeek = duration > 0;

  return (
    <section className="player-panel video-panel" ref={panelRef}>
      <div
        className="video-stage"
        onClick={() => onPlayingChange(!isPlaying)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onPlayingChange(!isPlaying);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={isPlaying ? "暂停" : "播放"}
      >
        <video
          ref={videoRef}
          className="video-element"
          controls={false}
          onEnded={() => {
            if (onEnded) {
              onEnded();
              return;
            }
            onPlayingChange(false);
          }}
        />
        {!isPlaying && (
          <span className="video-play-overlay" aria-hidden>
            <PlayIcon />
          </span>
        )}
      </div>

      <div className="video-controls">
        <div className="video-controls-row">
          <div className="player-controls video-transport">
            <button
              type="button"
              className="control-button"
              onClick={playPrev}
              aria-label="上一个"
            >
              <PrevIcon />
            </button>
            <button
              type="button"
              className="control-button play-button"
              onClick={() => onPlayingChange(!isPlaying)}
              aria-label={isPlaying ? "暂停" : "播放"}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              type="button"
              className="control-button"
              onClick={playNext}
              aria-label="下一个"
            >
              <NextIcon />
            </button>
          </div>

          <div className="progress-bar video-progress">
            <span className="progress-time">{formatTime(currentTime)}</span>
            <input
              type="range"
              className="progress-slider"
              min={0}
              max={duration || 0}
              step={0.1}
              value={duration > 0 ? currentTime : 0}
              disabled={!canSeek}
              onChange={handleSeekChange}
              onMouseDown={handleSeekStart}
              onTouchStart={handleSeekStart}
              onMouseUp={handleSeekCommit}
              onTouchEnd={handleSeekCommit}
              onKeyUp={handleSeekCommit}
              style={{ "--progress": `${progress}%` } as React.CSSProperties}
              aria-label="播放进度"
            />
            <span className="progress-time">{formatTime(duration)}</span>
          </div>

          <div className="video-actions">
            <div className="video-volume" ref={volumePanelRef}>
              {volumeOpen && (
                <div
                  className="video-volume-popover"
                  role="dialog"
                  aria-label="音量调节"
                >
                  <input
                    type="range"
                    className="video-volume-slider"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={(event) => setVolume(Number(event.target.value))}
                    style={
                      {
                        "--volume": `${volume * 100}%`,
                      } as React.CSSProperties
                    }
                    aria-label="音量"
                  />
                  <span className="video-volume-percent">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
              )}
              <button
                type="button"
                className={`control-button video-volume-trigger${volumeOpen ? " active" : ""}`}
                onClick={() => setVolumeOpen((open) => !open)}
                aria-label="音量"
                aria-expanded={volumeOpen}
                title="音量"
              >
                <VolumeIcon muted={volume === 0} />
              </button>
            </div>

            <button
              type="button"
              className="control-button video-fullscreen-trigger"
              onClick={() => {
                void toggleFullscreen();
              }}
              aria-label={isFullscreen ? "退出全屏" : "全屏"}
              aria-pressed={isFullscreen}
              title={isFullscreen ? "退出全屏" : "全屏"}
            >
              {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
