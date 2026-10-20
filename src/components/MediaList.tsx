import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "../types/media";
import { formatDuration } from "../utils/media";
import { FileInfoDialog } from "./FileInfoDialog";

type MediaListProps = {
  items: MediaItem[];
  currentItem: MediaItem | null;
  isPlaying: boolean;
  onPlay: (item: MediaItem) => void;
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

export function MediaList({
  items,
  currentItem,
  isPlaying,
  onPlay,
  onRemove,
  onMoveToTrash,
}: MediaListProps) {
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
    <section className="media-list-section">
      <div className="media-list-header">
        <span>名称</span>
        <span>时长</span>
      </div>

      <ul className="media-list">
        {items.map((item) => {
          const isCurrent = currentItem?.id === item.id;
          const isPlayingCurrent = isCurrent && isPlaying;

          return (
            <li
              key={item.id}
              className="media-item-row"
              onContextMenu={(event) => {
                event.preventDefault();
                const { x, y } = clampMenuPosition(
                  event.clientX,
                  event.clientY,
                );
                setMenu({ item, x, y });
              }}
            >
              <button
                type="button"
                className={`media-item${isCurrent ? " active" : ""}`}
                onClick={() => onPlay(item)}
                title={item.name}
              >
                {isPlayingCurrent && (
                  <span className="media-playing-icon" aria-hidden>
                    ♪
                  </span>
                )}
                <span className="media-name">{item.name}</span>
              </button>

              <span className="media-duration">
                {formatDuration(item.duration)}
              </span>
            </li>
          );
        })}
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
              onPlay(menu.item);
              setMenu(null);
            }}
          >
            播放
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
