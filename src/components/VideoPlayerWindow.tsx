import { useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useMediaStore } from "../hooks/useMediaStore";
import { createMediaItem, isTauri } from "../utils/media";
import { VideoViewer } from "./VideoViewer";

type VideoPlayerWindowProps = {
  initialPath: string | null;
};

export function VideoPlayerWindow({ initialPath }: VideoPlayerWindowProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
    currentItem,
    isPlaying,
    setIsPlaying,
    replayNonce,
    playItem,
    handleEnded,
  } = useMediaStore();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || !initialPath) return;
    startedRef.current = true;
    try {
      playItem(createMediaItem(initialPath, "video"));
    } catch {
      // path 无效时保持空状态
    }
  }, [initialPath, playItem]);

  useEffect(() => {
    if (!isTauri() || !currentItem) return;
    void getCurrentWindow().setTitle(currentItem.name);
  }, [currentItem]);

  const handleClose = () => {
    setIsPlaying(false);
    if (isTauri()) {
      void getCurrentWindow().close();
      return;
    }
    window.close();
  };

  if (!currentItem || currentItem.type !== "video") {
    return (
      <div className="doc-viewer video-viewer video-viewer-frameless">
        <div className="doc-viewer-body video-viewer-body">
          <p className="doc-viewer-error">
            {initialPath ? "无法加载视频" : "未指定视频"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="video-window-root">
      <VideoViewer
        item={currentItem}
        isPlaying={isPlaying}
        replayNonce={replayNonce}
        onPlayingChange={setIsPlaying}
        onEnded={handleEnded}
        onClose={handleClose}
        mediaRef={videoRef}
        showHeader={false}
      />
    </div>
  );
}
