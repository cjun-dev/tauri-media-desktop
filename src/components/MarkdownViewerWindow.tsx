import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MediaItem } from "../types/media";
import { createMediaItem, isTauri } from "../utils/media";
import { MarkdownViewer } from "./MarkdownViewer";

type MarkdownViewerWindowProps = {
  initialPath: string | null;
};

export function MarkdownViewerWindow({ initialPath }: MarkdownViewerWindowProps) {
  const [item, setItem] = useState<MediaItem | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || !initialPath) return;
    startedRef.current = true;
    try {
      setItem(createMediaItem(initialPath, "markdown"));
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

  if (!item || item.type !== "markdown") {
    return (
      <div className="doc-viewer md-viewer-frameless">
        <div className="doc-viewer-body">
          <p className="doc-viewer-error">
            {initialPath ? "无法加载 Markdown" : "未指定 Markdown"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="md-window-root">
      <MarkdownViewer item={item} onClose={handleClose} showHeader={false} />
    </div>
  );
}
