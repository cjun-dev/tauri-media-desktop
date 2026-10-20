import { useEffect } from "react";
import type { MediaItem } from "../types/media";
import { VideoPlayer } from "./VideoPlayer";

type VideoViewerProps = {
  item: MediaItem;
  isPlaying: boolean;
  replayNonce: number;
  onPlayingChange: (playing: boolean) => void;
  onEnded: () => void;
  onClose: () => void;
  mediaRef: React.RefObject<HTMLVideoElement | null>;
  /** 独立窗口已有系统标题栏时隐藏内部标题/关闭 */
  showHeader?: boolean;
};

export function VideoViewer({
  item,
  isPlaying,
  replayNonce,
  onPlayingChange,
  onEnded,
  onClose,
  mediaRef,
  showHeader = true,
}: VideoViewerProps) {
  useEffect(() => {
    if (!showHeader) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.documentElement.classList.contains("video-fullscreen-active")) {
        return;
      }
      onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, showHeader]);

  return (
    <div
      className={`doc-viewer video-viewer${showHeader ? "" : " video-viewer-frameless"}`}
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
    >
      {showHeader && (
        <header className="doc-viewer-header">
          <h3 className="doc-viewer-title" title={item.name}>
            {item.name}
          </h3>
          <button
            type="button"
            className="doc-viewer-close"
            aria-label="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </header>
      )}

      <div className="doc-viewer-body video-viewer-body">
        {item.src ? (
          <VideoPlayer
            item={item}
            isPlaying={isPlaying}
            replayNonce={replayNonce}
            onPlayingChange={onPlayingChange}
            onEnded={onEnded}
            mediaRef={mediaRef}
          />
        ) : (
          <p className="doc-viewer-error">无法加载视频</p>
        )}
      </div>
    </div>
  );
}
