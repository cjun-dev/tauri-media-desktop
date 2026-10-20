import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import type { MediaItem, MediaType } from "../types/media";

export const AUDIO_EXTENSIONS = [
  "mp3",
  "wav",
  "flac",
  "m4a",
  "aac",
  "ogg",
  "wma",
  "ncm",
];

export const VIDEO_EXTENSIONS = [
  "mp4",
  "webm",
  "mkv",
  "avi",
  "mov",
  "m4v",
];

export const IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "svg",
];

export const PDF_EXTENSIONS = ["pdf"];

export const MARKDOWN_EXTENSIONS = ["md", "markdown", "mdown", "mkd"];

export { isTauri };

export function getExtension(path: string): string {
  const name = path.split(/[/\\]/).pop() ?? path;
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function getMediaType(path: string): MediaType | null {
  const ext = getExtension(path);
  if (AUDIO_EXTENSIONS.includes(ext)) return "audio";
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  if (PDF_EXTENSIONS.includes(ext)) return "pdf";
  if (MARKDOWN_EXTENSIONS.includes(ext)) return "markdown";
  return null;
}

export function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}

/** 展示用名称：去掉文件后缀 */
export function getDisplayName(name: string): string {
  const fileName = getFileName(name);
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return fileName;
  return fileName.slice(0, dot);
}

export function createMediaItem(
  path: string,
  type?: MediaType,
  src?: string,
): MediaItem {
  const mediaType = type ?? getMediaType(path);
  if (!mediaType) {
    throw new Error(`Unsupported media file: ${path}`);
  }

  return {
    id: `${mediaType}-${path}`,
    path,
    name: getFileName(path),
    type: mediaType,
    src: src ?? (isTauri() ? convertFileSrc(path) : undefined),
  };
}

export function createMediaItemFromFile(file: File): MediaItem {
  const mediaType = getMediaType(file.name);
  if (!mediaType) {
    throw new Error(`Unsupported media file: ${file.name}`);
  }

  return {
    id: `${mediaType}-${file.name}-${file.lastModified}`,
    path: file.name,
    name: file.name,
    type: mediaType,
    src: URL.createObjectURL(file),
  };
}

/** 仅本地绝对路径可持久化（浏览器 File 只有文件名） */
export function isPersistablePath(path: string): boolean {
  return path.includes("/") || path.includes("\\");
}

export function hydrateMediaItem<T extends MediaItem>(item: T): T {
  if (!isPersistablePath(item.path) || !isTauri()) return item;
  return { ...item, src: convertFileSrc(item.path) };
}

export function toPersistedMediaItem(item: MediaItem): MediaItem {
  return {
    id: item.id,
    path: item.path,
    name: item.name,
    type: item.type,
    duration: item.duration,
  };
}

export async function mediaFileExists(path: string): Promise<boolean> {
  if (!isPersistablePath(path)) return true;
  if (!isTauri()) return true;

  try {
    return await invoke<boolean>("path_exists", { path });
  } catch {
    return false;
  }
}

const COVER_FILE_NAMES = ["cover", "folder", "AlbumArt", "album"];

/** 与音频同名的封面图，或同目录 cover/folder 等常见命名 */
export function getCoverPathCandidates(audioPath: string): string[] {
  const lastDot = audioPath.lastIndexOf(".");
  const lastSep = Math.max(
    audioPath.lastIndexOf("/"),
    audioPath.lastIndexOf("\\"),
  );
  const base = lastDot > lastSep ? audioPath.slice(0, lastDot) : audioPath;
  const dir = lastSep >= 0 ? audioPath.slice(0, lastSep + 1) : "";
  const candidates: string[] = [];

  for (const ext of IMAGE_EXTENSIONS) {
    if (ext === "svg" || ext === "gif") continue;
    candidates.push(`${base}.${ext}`);
  }

  for (const name of COVER_FILE_NAMES) {
    for (const ext of IMAGE_EXTENSIONS) {
      if (ext === "svg" || ext === "gif") continue;
      candidates.push(`${dir}${name}.${ext}`);
    }
  }

  return candidates;
}

/** LRC 不含图片；查找同名/同目录封面图，返回可展示的 src */
export async function loadCoverSrcForMedia(
  item: MediaItem,
): Promise<string | null> {
  if (!isTauri() || !isPersistablePath(item.path)) return null;

  for (const path of getCoverPathCandidates(item.path)) {
    const exists = await mediaFileExists(path);
    if (!exists) continue;
    return convertFileSrc(path);
  }

  return null;
}

/** 读取本地文本文件内容（Markdown 预览） */
export async function readTextFileContent(item: MediaItem): Promise<string> {
  if (isTauri() && isPersistablePath(item.path)) {
    return invoke<string>("read_text_file", { path: item.path });
  }

  if (item.src) {
    const response = await fetch(item.src);
    if (!response.ok) {
      throw new Error(`读取失败（${response.status}）`);
    }
    return response.text();
  }

  throw new Error("无法读取文件内容");
}

const TYPE_EXTENSIONS: Record<MediaType, string[]> = {
  audio: AUDIO_EXTENSIONS,
  video: VIDEO_EXTENSIONS,
  image: IMAGE_EXTENSIONS,
  pdf: PDF_EXTENSIONS,
  markdown: MARKDOWN_EXTENSIONS,
};

const TYPE_FILTER_NAMES: Record<MediaType, string> = {
  audio: "音频文件（含 NCM）",
  video: "视频文件",
  image: "图片文件",
  pdf: "PDF 文件",
  markdown: "Markdown 文件",
};

export function getDialogFilters(type: MediaType) {
  return [{ name: TYPE_FILTER_NAMES[type], extensions: TYPE_EXTENSIONS[type] }];
}

export function getAcceptAttribute(type: MediaType): string {
  return TYPE_EXTENSIONS[type].map((ext) => `.${ext}`).join(",");
}

export function formatDuration(seconds?: number): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function probeMediaDuration(
  src: string,
  type: MediaType,
): Promise<number | undefined> {
  if (type === "image" || type === "pdf" || type === "markdown") {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    const media = document.createElement(type === "video" ? "video" : "audio");
    media.preload = "metadata";

    const cleanup = () => {
      media.removeAttribute("src");
      media.load();
      media.remove();
    };

    media.onloadedmetadata = () => {
      const duration = media.duration;
      cleanup();
      resolve(Number.isFinite(duration) ? duration : undefined);
    };

    media.onerror = () => {
      cleanup();
      resolve(undefined);
    };

    media.src = src;
  });
}

export const TAB_LABELS: Record<import("../types/media").Tab, string> = {
  audio: "音频",
  video: "视频",
  image: "图片",
  pdf: "PDF",
  markdown: "Markdown",
  history: "历史记录",
};

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  audio: "音频",
  video: "视频",
  image: "图片",
  pdf: "PDF",
  markdown: "Markdown",
};
