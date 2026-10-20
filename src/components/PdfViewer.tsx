import { useEffect } from "react";
import type { MediaItem } from "../types/media";

type PdfViewerProps = {
  item: MediaItem;
  onClose: () => void;
  /** 独立窗口已有系统标题栏时隐藏内部标题/关闭 */
  showHeader?: boolean;
};

export function PdfViewer({ item, onClose, showHeader = true }: PdfViewerProps) {
  useEffect(() => {
    if (!showHeader) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, showHeader]);

  return (
    <div
      className={`doc-viewer${showHeader ? "" : " pdf-viewer-frameless"}`}
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

      <div className="doc-viewer-body">
        {item.src ? (
          <iframe
            className="pdf-viewer-frame"
            src={item.src}
            title={item.name}
          />
        ) : (
          <p className="doc-viewer-error">无法加载 PDF</p>
        )}
      </div>
    </div>
  );
}
