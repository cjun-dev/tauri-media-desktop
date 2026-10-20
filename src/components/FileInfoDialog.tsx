import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { MediaItem } from "../types/media";
import {
  formatDuration,
  getExtension,
  getFileName,
  isPersistablePath,
  isTauri,
  MEDIA_TYPE_LABELS,
} from "../utils/media";

type FileInfoDialogProps = {
  item: MediaItem;
  onClose: () => void;
};

type NativeFileInfo = {
  name: string;
  path: string;
  size: number;
  format: string;
  createdAt?: number | null;
  modifiedAt?: number | null;
};

type MediaMeta = {
  width?: number;
  height?: number;
  duration?: number;
};

function formatFileSize(bytes?: number | null) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDateTime(timestamp?: number | null) {
  if (timestamp == null || !Number.isFinite(timestamp)) return "—";
  return new Date(timestamp).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function loadMediaMeta(item: MediaItem): Promise<MediaMeta | null> {
  const src = item.src;
  if (!src) {
    return Promise.resolve(
      item.duration != null ? { duration: item.duration } : null,
    );
  }

  if (item.type === "image") {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      };
      image.onerror = () => resolve(null);
      image.src = src;
    });
  }

  if (item.type === "pdf" || item.type === "markdown") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const media = document.createElement(
      item.type === "video" ? "video" : "audio",
    );
    media.preload = "metadata";

    const cleanup = () => {
      media.removeAttribute("src");
      media.load();
      media.remove();
    };

    media.onloadedmetadata = () => {
      const meta: MediaMeta = {
        duration: Number.isFinite(media.duration) ? media.duration : undefined,
      };
      if (item.type === "video") {
        const video = media as HTMLVideoElement;
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          meta.width = video.videoWidth;
          meta.height = video.videoHeight;
        }
      }
      cleanup();
      resolve(meta);
    };

    media.onerror = () => {
      cleanup();
      resolve(item.duration != null ? { duration: item.duration } : null);
    };

    media.src = src;
  });
}

export function FileInfoDialog({ item, onClose }: FileInfoDialogProps) {
  const [fileInfo, setFileInfo] = useState<NativeFileInfo | null>(null);
  const [mediaMeta, setMediaMeta] = useState<MediaMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealError, setRevealError] = useState<string | null>(null);

  const title = `${MEDIA_TYPE_LABELS[item.type]}信息`;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    async function loadInfo() {
      setLoading(true);
      setError(null);
      setRevealError(null);

      const metaPromise = loadMediaMeta(item);

      try {
        if (isTauri() && isPersistablePath(item.path)) {
          const info = await invoke<NativeFileInfo>("get_file_info", {
            path: item.path,
          });
          if (!cancelled) setFileInfo(info);
        } else if (!cancelled) {
          const ext = getExtension(item.name || item.path);
          setFileInfo({
            name: getFileName(item.name || item.path),
            path: item.path,
            size: 0,
            format: ext ? ext.toUpperCase() : "未知",
            createdAt: null,
            modifiedAt: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }

      const meta = await metaPromise;
      if (!cancelled) {
        setMediaMeta(meta);
        setLoading(false);
      }
    }

    void loadInfo();
    return () => {
      cancelled = true;
    };
  }, [item]);

  const canReveal = isTauri() && isPersistablePath(item.path);

  const handleReveal = async () => {
    if (!canReveal) return;
    setRevealError(null);
    try {
      await invoke("reveal_in_folder", { path: item.path });
    } catch (err) {
      setRevealError(err instanceof Error ? err.message : String(err));
    }
  };

  const name = fileInfo?.name ?? getFileName(item.name || item.path);
  const format =
    fileInfo?.format ??
    (getExtension(item.name || item.path).toUpperCase() || "未知");
  const sizeLabel =
    fileInfo && fileInfo.size > 0
      ? formatFileSize(fileInfo.size)
      : isPersistablePath(item.path)
        ? loading
          ? "读取中…"
          : "—"
        : "—";

  const durationValue = mediaMeta?.duration ?? item.duration;
  const durationLabel = loading && durationValue == null
    ? "读取中…"
    : formatDuration(durationValue);

  const dimensionLabel =
    mediaMeta?.width && mediaMeta?.height
      ? `${mediaMeta.width} × ${mediaMeta.height}`
      : loading
        ? "读取中…"
        : "—";

  const rows: { label: string; value: string }[] = [
    { label: "名称", value: name },
    { label: "类型", value: MEDIA_TYPE_LABELS[item.type] },
    { label: "格式", value: format },
  ];

  if (item.type === "image" || item.type === "video") {
    rows.push({ label: "尺寸", value: dimensionLabel });
  }

  if (item.type === "audio" || item.type === "video") {
    rows.push({ label: "时长", value: durationLabel });
  }

  rows.push(
    { label: "大小", value: sizeLabel },
    { label: "创建时间", value: formatDateTime(fileInfo?.createdAt) },
    { label: "修改时间", value: formatDateTime(fileInfo?.modifiedAt) },
  );

  return (
    <div
      className="file-info-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="file-info-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="file-info-header">
          <h3>{title}</h3>
          <button
            type="button"
            className="file-info-close"
            aria-label="关闭"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {error ? (
          <p className="file-info-error">{error}</p>
        ) : (
          <dl className="file-info-list">
            {rows.map((row) => (
              <div key={row.label} className="file-info-row">
                <dt>{row.label}</dt>
                <dd title={row.value}>{row.value}</dd>
              </div>
            ))}

            <div className="file-info-row file-info-path-row">
              <dt>位置</dt>
              <dd>
                <span className="file-info-path" title={item.path}>
                  {isPersistablePath(item.path)
                    ? item.path
                    : "浏览器本地文件（无完整路径）"}
                </span>
                {canReveal && (
                  <button
                    type="button"
                    className="file-info-reveal"
                    onClick={() => void handleReveal()}
                  >
                    打开所在文件夹
                  </button>
                )}
              </dd>
            </div>
          </dl>
        )}

        {revealError && <p className="file-info-error">{revealError}</p>}
      </div>
    </div>
  );
}
