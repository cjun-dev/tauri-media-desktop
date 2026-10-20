import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MediaItem } from "../types/media";
import { createMediaItem, isTauri } from "../utils/media";
import { PdfViewer } from "./PdfViewer";

type PdfViewerWindowProps = {
  initialPath: string | null;
};

export function PdfViewerWindow({ initialPath }: PdfViewerWindowProps) {
  const [item, setItem] = useState<MediaItem | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || !initialPath) return;
    startedRef.current = true;
    try {
      setItem(createMediaItem(initialPath, "pdf"));
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

  if (!item || item.type !== "pdf") {
    return (
      <div className="doc-viewer pdf-viewer-frameless">
        <div className="doc-viewer-body">
          <p className="doc-viewer-error">
            {initialPath ? "无法加载 PDF" : "未指定 PDF"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pdf-window-root">
      <PdfViewer item={item} onClose={handleClose} showHeader={false} />
    </div>
  );
}
