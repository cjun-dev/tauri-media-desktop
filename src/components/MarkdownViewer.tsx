import { useEffect, useState } from "react";
import { marked } from "marked";
import type { MediaItem } from "../types/media";
import { readTextFileContent } from "../utils/media";

type MarkdownViewerProps = {
  item: MediaItem;
  onClose: () => void;
  /** 独立窗口已有系统标题栏时隐藏内部标题/关闭 */
  showHeader?: boolean;
};

export function MarkdownViewer({
  item,
  onClose,
  showHeader = true,
}: MarkdownViewerProps) {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!showHeader) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, showHeader]);

  useEffect(() => {
    let cancelled = false;

    async function loadMarkdown() {
      setLoading(true);
      setError(null);
      setHtml("");

      try {
        const text = await readTextFileContent(item);
        const rendered = await marked.parse(text, { async: true });
        if (!cancelled) {
          setHtml(rendered);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    }

    void loadMarkdown();
    return () => {
      cancelled = true;
    };
  }, [item]);

  return (
    <div
      className={`doc-viewer${showHeader ? "" : " md-viewer-frameless"}`}
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

      <div className="doc-viewer-body markdown-viewer-body">
        {loading ? (
          <p className="doc-viewer-status">加载中…</p>
        ) : error ? (
          <p className="doc-viewer-error">{error}</p>
        ) : (
          <article
            className="markdown-body"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  );
}
