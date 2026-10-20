import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "../types/media";

type ImageViewerProps = {
  item: MediaItem;
  onClose: () => void;
  /** 独立窗口已有系统标题栏时隐藏关闭按钮，且点击背景不关闭 */
  showChrome?: boolean;
};

const MIN_SCALE = 0.25;
const MAX_SCALE = 5;
const SCALE_STEP = 0.12;

export function ImageViewer({
  item,
  onClose,
  showChrome = true,
}: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [dragging, setDragging] = useState(false);

  const lightboxRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(offset);
  const dragStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const didDragRef = useRef(false);

  offsetRef.current = offset;

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setDragging(false);
    didDragRef.current = false;
  }, [item.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (showChrome && event.key === "Escape") {
        onClose();
        return;
      }

      if (event.code === "Space" && !event.repeat) {
        event.preventDefault();
        setSpacePressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      event.preventDefault();
      setSpacePressed(false);
      setDragging(false);
    };

    const handleBlur = () => {
      setSpacePressed(false);
      setDragging(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [onClose, showChrome]);

  useEffect(() => {
    const node = lightboxRef.current;
    if (!node) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const direction = event.deltaY < 0 ? 1 : -1;
      setScale((prev) => {
        const next = prev + direction * SCALE_STEP * prev;
        return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
      });
    };

    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleWheel);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const dx = event.clientX - dragStartRef.current.x;
      const dy = event.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        didDragRef.current = true;
      }
      setOffset({
        x: dragStartRef.current.ox + dx,
        y: dragStartRef.current.oy + dy,
      });
    };

    const handlePointerUp = () => {
      setDragging(false);
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragging]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!spacePressed || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    didDragRef.current = false;
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      ox: offsetRef.current.x,
      oy: offsetRef.current.y,
    };
    setDragging(true);
  };

  const handleBackdropClick = () => {
    if (!showChrome) return;
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    onClose();
  };

  const cursorClass = dragging
    ? " is-dragging"
    : spacePressed
      ? " is-panning"
      : "";
  const chromeClass = showChrome ? "" : " image-viewer-frameless";

  return (
    <div
      ref={lightboxRef}
      className={`image-lightbox${chromeClass}${cursorClass}`}
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
      onClick={handleBackdropClick}
      onPointerDown={handlePointerDown}
    >
      {showChrome && (
        <button
          type="button"
          className="image-lightbox-close"
          aria-label="关闭"
          onClick={onClose}
          onPointerDown={(event) => event.stopPropagation()}
        >
          ×
        </button>
      )}
      <div
        className="image-lightbox-content"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={handlePointerDown}
      >
        {item.src ? (
          <img
            className="image-lightbox-img"
            src={item.src}
            alt={item.name}
            draggable={false}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transition: dragging ? "none" : undefined,
            }}
          />
        ) : (
          <p className="image-lightbox-error">无法加载图片</p>
        )}
      </div>
    </div>
  );
}
