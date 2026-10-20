import type { HistoryItem, MediaItem, MediaType } from "../types/media";

type HistoryListProps = {
  items: MediaItem[];
  onPlay: (item: MediaItem) => void;
};

const TYPE_ICONS: Record<MediaType, string> = {
  audio: "♪",
  video: "▶",
  image: "▣",
  pdf: "▥",
  markdown: "☰",
};

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoryList({ items, onPlay }: HistoryListProps) {
  return (
    <section className="media-list-section">
      <ul className="media-list">
        {(items as HistoryItem[]).map((item) => (
          <li key={`${item.id}-${item.playedAt}`}>
            <button
              type="button"
              className="media-item"
              onClick={() => onPlay(item)}
            >
              <span className="media-icon">{TYPE_ICONS[item.type] ?? "◦"}</span>
              <span className="media-name">{item.name}</span>
              <span className="media-time">{formatTime(item.playedAt)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
