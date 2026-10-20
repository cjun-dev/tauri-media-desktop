import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MediaItem } from "../types/media";
import { createMediaItem, isTauri } from "../utils/media";
import { ImageViewer } from "./ImageViewer";

type ImageViewerWindowProps = {
  initialPath: string | null;
};

export function ImageViewerWindow({ initialPath }: ImageViewerWindowProps) {
  const [item, setItem] = useState<MediaItem | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || !initialPath) return;
    startedRef.current = true;
    try {
      setItem(createMediaItem(initialPath, "image"));
    } catch {
      setItem(null);
    }
  }, [initialPath]);

  useEffect(() => {
    if (!isTauri() || !item) return;
    void getCurrentWindow().setTitle(item.name);
  }, [item]);

  const handleClose = () => {
    if (isTauri()) {
      void getCurrentWindow().close();
      return;
    }
    window.close();
  };

  if (!item || item.type !== "image") {
    return (
      <div className="image-lightbox image-viewer-frameless">
        <p className="image-lightbox-error">
          {initialPath ? "无法加载图片" : "未指定图片"}
        </p>
      </div>
    );
  }

  return (
    <div className="image-window-root">
      <ImageViewer item={item} onClose={handleClose} showChrome={false} />
    </div>
  );
}
