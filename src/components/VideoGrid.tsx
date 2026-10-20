import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "../types/media";
import { FileInfoDialog } from "./FileInfoDialog";

type VideoGridProps = {
  items: MediaItem[];
  onOpen: (item: MediaItem) => void;
  onRemove: (item: MediaItem) => void;
  onMoveToTrash: (item: MediaItem) => void;
};

type ContextMenuState = {
  item: MediaItem;
  x: number;
  y: number;
};

const MENU_WIDTH = 160;
const MENU_HEIGHT = 156;
const MENU_PADDING = 8;
const THUMB_MAX_EDGE = 224;

/** 会话内缓存，避免网格重渲染时重复解码 */
const thumbCache = new Map<string, string>();

function clampMenuPosition(x: number, y: number) {
  return {
    x: Math.min(
      Math.max(MENU_PADDING, x),
      window.innerWidth - MENU_WIDTH - MENU_PADDING,
    ),
    y: Math.min(
      Math.max(MENU_PADDING, y),
      window.innerHeight - MENU_HEIGHT - MENU_PADDING,
    ),
  };
}

function captureVideoFrame(video: HTMLVideoElement): string | null {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;

  const scale = Math.min(1, THUMB_MAX_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

function VideoThumb({ src, name }: { src: string; name: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [thumb, setThumb] = useState<string | null>(
    () => thumbCache.get(src) ?? null,
  );
  const [frameReady, setFrameReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const cached = thumbCache.get(src);
    if (cached) {
      setThumb(cached);
      setFrameReady(true);
      setFailed(false);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    setThumb(null);
    setFrameReady(false);
    setFailed(false);

    const showFrame = () => {
      if (cancelled) return;

      try {
        const dataUrl = captureVideoFrame(video);
        if (dataUrl) {
          thumbCache.set(src, dataUrl);
          setThumb(dataUrl);
        }
      } catch {
        // asset 协议可能导致 canvas 污染，继续用 video 帧显示
      }

      setFrameReady(true);
    };

    const onLoaded = () => {
      const duration = video.duration;
      const seekTo =
        Number.isFinite(duration) && duration > 0
          ? Math.min(0.5, Math.max(0.05, duration * 0.02))
          : 0.1;
      try {
        video.currentTime = seekTo;
      } catch {
        showFrame();
      }
    };

    const onError = () => {
      if (!cancelled) setFailed(true);
    };

    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("seeked", showFrame);
    video.addEventListener("error", onError);
    video.src = src;
    video.load();

    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("seeked", showFrame);
      video.removeEventListener("error", onError);
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  if (thumb) {
    return (
      <>
        <img
          className="image-thumb-img"
          src={thumb}
          alt={name}
          draggable={false}
        />
        <span className="video-thumb-badge" aria-hidden>
          ▶
        </span>
      </>
    );
  }

  return (
    <>
      <video
        ref={videoRef}
        className={`image-thumb-img${frameReady && !failed ? " is-ready" : ""}`}
        muted
        playsInline
        preload="auto"
        draggable={false}
      />
      {(!frameReady || failed) && (
        <span className="image-thumb-fallback video-thumb-placeholder" aria-hidden>
          ▶
        </span>
      )}
      <span className="video-thumb-badge" aria-hidden>
        ▶
      </span>
    </>
  );
}

export function VideoGrid({
  items,
  onOpen,
  onRemove,
  onMoveToTrash,
}: VideoGridProps) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [infoItem, setInfoItem] = useState<MediaItem | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;

    const close = () => setMenu(null);

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      close();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    const handleScroll = () => close();

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  return (
    <section className="image-grid-section">
      <ul className="image-grid">
        {items.map((item) => (
          <li key={item.id} className="image-grid-item">
            <button
              type="button"
              className="image-thumb-button"
              title={item.name}
              onDoubleClick={() => onOpen(item)}
              onContextMenu={(event) => {
                event.preventDefault();
                const { x, y } = clampMenuPosition(event.clientX, event.clientY);
                setMenu({ item, x, y });
              }}
            >
              <span className="image-thumb-frame video-thumb-frame">
                {item.src ? (
                  <VideoThumb src={item.src} name={item.name} />
                ) : (
                  <span className="image-thumb-fallback" aria-hidden>
                    ▶
                  </span>
                )}
              </span>
              <span className="image-thumb-name">{item.name}</span>
            </button>
          </li>
        ))}
      </ul>

      {menu && (
        <div
          ref={menuRef}
          className="image-context-menu"
          role="menu"
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onOpen(menu.item);
              setMenu(null);
            }}
          >
            播放视频
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setInfoItem(menu.item);
              setMenu(null);
            }}
          >
            文件信息
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onRemove(menu.item);
              setMenu(null);
            }}
          >
            从列表中移除
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              void onMoveToTrash(menu.item);
              setMenu(null);
            }}
          >
            移动到废纸篓
          </button>
        </div>
      )}

      {infoItem && (
        <FileInfoDialog item={infoItem} onClose={() => setInfoItem(null)} />
      )}
    </section>
  );
}
