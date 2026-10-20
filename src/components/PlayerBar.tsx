import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PlayMode } from "../types/media";
import { useMediaStore } from "../hooks/useMediaStore";

type PlayerBarProps = {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

const PLAY_MODE_META: Record<PlayMode, { label: string; icon: ReactNode }> = {
  loop: {
    label: "列表循环",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  single: {
    label: "单曲循环",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zM13 15V9h-1l-2 1v1h1.5V15H13z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  shuffle: {
    label: "随机播放",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"
          fill="currentColor"
        />
      </svg>
    ),
  },
};

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

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6h12v12H6V6z" fill="currentColor" />
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

export function PlayerBar({ audioRef, videoRef }: PlayerBarProps) {
  const {
    currentItem,
    isPlaying,
    playMode,
    cyclePlayMode,
    togglePlay,
    stopPlay,
    playNext,
    playPrev,
  } = useMediaStore();

  const volumePanelRef = useRef<HTMLDivElement>(null);
  const seekingRef = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [volumeOpen, setVolumeOpen] = useState(false);

  const getMediaElement = () => {
    if (!currentItem) return null;
    return currentItem.type === "video"
      ? videoRef.current
      : audioRef.current;
  };

  useEffect(() => {
    const media = getMediaElement();
    if (!media) return;
    media.volume = volume;
  }, [currentItem, volume, audioRef, videoRef]);

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
    setCurrentTime(0);
    setDuration(0);

    const media = getMediaElement();
    if (!media) return;

    const syncTime = () => {
      if (!seekingRef.current) {
        setCurrentTime(media.currentTime || 0);
      }
    };

    const syncDuration = () => {
      setDuration(Number.isFinite(media.duration) ? media.duration : 0);
    };

    syncTime();
    syncDuration();

    media.addEventListener("timeupdate", syncTime);
    media.addEventListener("loadedmetadata", syncDuration);
    media.addEventListener("durationchange", syncDuration);
    media.addEventListener("seeked", syncTime);

    return () => {
      media.removeEventListener("timeupdate", syncTime);
      media.removeEventListener("loadedmetadata", syncDuration);
      media.removeEventListener("durationchange", syncDuration);
      media.removeEventListener("seeked", syncTime);
    };
  }, [currentItem, audioRef, videoRef]);

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(event.target.value));
  };

  const seekTo = (nextTime: number) => {
    const media = getMediaElement();
    if (!media || !Number.isFinite(nextTime)) return;
    media.currentTime = nextTime;
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

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const canSeek = Boolean(currentItem && duration > 0);
  const modeMeta = PLAY_MODE_META[playMode];
  const showPlayMode = currentItem?.type !== "video";

  if (currentItem?.type === "video") {
    return null;
  }

  return (
    <footer className="player-bar">
      <div className="player-controls">
        {showPlayMode && (
          <button
            type="button"
            className="control-button mode-button"
            onClick={cyclePlayMode}
            aria-label={modeMeta.label}
            title={modeMeta.label}
          >
            {modeMeta.icon}
          </button>
        )}
        <button
          type="button"
          className="control-button"
          onClick={playPrev}
          disabled={!currentItem}
          aria-label="上一首"
        >
          <PrevIcon />
        </button>
        <button
          type="button"
          className="control-button play-button"
          onClick={() => {
            if (!currentItem) return;
            togglePlay();
          }}
          disabled={!currentItem}
          aria-label={isPlaying ? "暂停" : "播放"}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          className="control-button"
          onClick={playNext}
          disabled={!currentItem}
          aria-label="下一首"
        >
          <NextIcon />
        </button>
      </div>

      <div className="progress-bar">
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
        <button
          type="button"
          className="control-button stop-button"
          onClick={() => {
            const media = getMediaElement();
            if (media) {
              media.pause();
              media.currentTime = 0;
            }
            stopPlay();
          }}
          disabled={!currentItem}
          aria-label="停止"
          title="停止"
        >
          <StopIcon />
        </button>
      </div>

      <div className="volume-control" ref={volumePanelRef}>
        {volumeOpen && (
          <div className="volume-popover" role="dialog" aria-label="音量调节">
            <div className="volume-popover-body">
              <input
                type="range"
                className="volume-slider"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={handleVolumeChange}
                style={
                  {
                    "--volume": `${volume * 100}%`,
                  } as React.CSSProperties
                }
                aria-label="音量"
              />
              <div className="volume-popover-meta">
                <span className="volume-percent">
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}
        <button
          type="button"
          className={`control-button volume-trigger${volumeOpen ? " active" : ""}`}
          onClick={() => setVolumeOpen((open) => !open)}
          aria-label="音量"
          aria-expanded={volumeOpen}
          title="音量"
        >
          <VolumeIcon muted={volume === 0} />
        </button>
      </div>
    </footer>
  );
}
