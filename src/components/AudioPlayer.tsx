import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "../types/media";
import { getDisplayName, loadCoverSrcForMedia } from "../utils/media";
import {
  findActiveLyricIndex,
  loadLyricsForMedia,
  type LyricsData,
} from "../utils/lyrics";

type AudioPlayerProps = {
  item: MediaItem;
  isPlaying: boolean;
  replayNonce: number;
  onPlayingChange: (playing: boolean) => void;
  onEnded?: () => void;
  mediaRef?: React.RefObject<HTMLAudioElement | null>;
};

export function AudioPlayer({
  item,
  isPlaying,
  replayNonce,
  onPlayingChange,
  onEnded,
  mediaRef,
}: AudioPlayerProps) {
  const localRef = useRef<HTMLAudioElement>(null);
  const audioRef = mediaRef ?? localRef;
  const lyricsListRef = useRef<HTMLDivElement>(null);
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [lyricsStatus, setLyricsStatus] = useState<"loading" | "ready" | "empty">(
    "loading",
  );
  const [activeIndex, setActiveIndex] = useState(-1);
  const [coverSrc, setCoverSrc] = useState<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.src = item.src ?? "";
    audio.load();
    if (isPlaying) {
      void audio.play().catch((error: unknown) => {
        // load()/切歌会中断上一次 play，忽略 AbortError
        if (error instanceof DOMException && error.name === "AbortError") return;
        onPlayingChange(false);
      });
    }
    // 仅在切换曲目时重新加载；暂停/继续由下方 effect 处理，避免重置进度
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally omit isPlaying
  }, [item, audioRef]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      void audio.play().catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        onPlayingChange(false);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, audioRef, onPlayingChange]);

  useEffect(() => {
    if (replayNonce === 0) return;
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      onPlayingChange(false);
    });
  }, [replayNonce, audioRef, onPlayingChange]);

  useEffect(() => {
    let cancelled = false;
    setLyrics(null);
    setActiveIndex(-1);
    setLyricsStatus("loading");
    setCoverSrc(null);

    void loadLyricsForMedia(item).then((data) => {
      if (cancelled) return;
      setLyrics(data);
      setLyricsStatus(data ? "ready" : "empty");
    });

    void loadCoverSrcForMedia(item).then((src) => {
      if (cancelled) return;
      setCoverSrc(src);
    });

    return () => {
      cancelled = true;
    };
  }, [item]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !lyrics || lyrics.kind !== "synced") {
      setActiveIndex(-1);
      return;
    }

    const sync = () => {
      setActiveIndex(findActiveLyricIndex(lyrics.lines, audio.currentTime));
    };

    sync();
    audio.addEventListener("timeupdate", sync);
    audio.addEventListener("seeked", sync);
    return () => {
      audio.removeEventListener("timeupdate", sync);
      audio.removeEventListener("seeked", sync);
    };
  }, [audioRef, lyrics, item]);

  useEffect(() => {
    if (activeIndex < 0 || !lyricsListRef.current) return;
    const active = lyricsListRef.current.querySelector<HTMLElement>(
      `[data-lyric-index="${activeIndex}"]`,
    );
    active?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex]);

  return (
    <section className="player-panel audio-panel">
      <button
        type="button"
        className="music-disk-button"
        onClick={() => onPlayingChange(!isPlaying)}
        aria-label={isPlaying ? "暂停" : "播放"}
        title={isPlaying ? "暂停" : "播放"}
      >
        <span className={`music-disk${isPlaying ? " spinning" : ""}`}>
          <span className="music-disk-groove" aria-hidden />
          <span
            className={`music-disk-label${coverSrc ? " has-cover" : ""}`}
            aria-hidden
          >
            {coverSrc ? (
              <img src={coverSrc} alt="" className="music-disk-cover" draggable={false} />
            ) : (
              "♪"
            )}
          </span>
        </span>
      </button>
      <div className="player-info">
        <h3 title={getDisplayName(item.name)}>{getDisplayName(item.name)}</h3>
      </div>

      <div className="lyrics-panel" aria-live="polite">
        {lyricsStatus === "loading" ? (
          <p className="lyrics-empty">歌词加载中…</p>
        ) : lyricsStatus === "empty" || !lyrics ? (
          <p className="lyrics-empty">暂无歌词</p>
        ) : lyrics.kind === "synced" ? (
          <div className="lyrics-list" ref={lyricsListRef}>
            {lyrics.lines.map((line, index) => (
              <p
                key={`${line.time}-${index}`}
                data-lyric-index={index}
                className={`lyrics-line${index === activeIndex ? " active" : ""}`}
              >
                {line.text}
              </p>
            ))}
          </div>
        ) : (
          <div className="lyrics-list lyrics-list-plain" ref={lyricsListRef}>
            {lyrics.lines.map((line, index) => (
              <p key={`${line}-${index}`} className="lyrics-line">
                {line}
              </p>
            ))}
          </div>
        )}
      </div>

      <audio
        ref={audioRef}
        className="hidden-media"
        onEnded={() => {
          if (onEnded) {
            onEnded();
            return;
          }
          onPlayingChange(false);
        }}
      />
    </section>
  );
}
