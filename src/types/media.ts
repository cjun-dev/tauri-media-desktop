export type Tab = "audio" | "video" | "image" | "pdf" | "markdown" | "history";

export type MediaType = "audio" | "video" | "image" | "pdf" | "markdown";

/** 列表循环 | 单曲循环 | 随机播放 */
export type PlayMode = "loop" | "single" | "shuffle";

export type MediaItem = {
  id: string;
  path: string;
  name: string;
  type: MediaType;
  src?: string;
  /** 秒 */
  duration?: number;
};

export type HistoryItem = MediaItem & {
  playedAt: number;
};
