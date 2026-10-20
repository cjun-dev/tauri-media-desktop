import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "../types/media";
import { FileInfoDialog } from "./FileInfoDialog";

type MarkdownGridProps = {
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

export function MarkdownGrid({
  items,
  onOpen,
  onRemove,
  onMoveToTrash,
}: MarkdownGridProps) {
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
              <span className="image-thumb-frame doc-thumb-frame md-thumb-frame">
                <span className="doc-thumb-icon" aria-hidden>
                  MD
                </span>
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
            预览文档
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
