import { invoke } from "@tauri-apps/api/core";
import type { MediaItem } from "../types/media";
import { isPersistablePath, isTauri, mediaFileExists } from "./media";

export type LyricLine = {
  time: number;
  text: string;
};

export type LyricsData =
  | { kind: "synced"; lines: LyricLine[] }
  | { kind: "plain"; lines: string[] };

const TIME_TAG_PATTERN = String.raw`\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]`;

function createTimeTagRe() {
  return new RegExp(TIME_TAG_PATTERN, "g");
}

function parseTimeTag(match: RegExpMatchArray): number {
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const fraction = match[3]
    ? Number(match[3].padEnd(3, "0").slice(0, 3)) / 1000
    : 0;
  return minutes * 60 + seconds + fraction;
}

/** 解析 LRC；无时间轴时退回纯文本行 */
export function parseLyricsContent(content: string): LyricsData | null {
  const synced: LyricLine[] = [];
  const plain: string[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const tags = [...trimmed.matchAll(createTimeTagRe())];
    if (tags.length === 0) {
      // 跳过 [ti:]/[ar:] 等元信息
      if (/^\[[a-zA-Z]+:.*\]$/.test(trimmed)) continue;
      plain.push(trimmed);
      continue;
    }

    const text = trimmed.replace(createTimeTagRe(), "").trim();
    if (!text) continue;

    for (const tag of tags) {
      synced.push({ time: parseTimeTag(tag), text });
    }
  }

  if (synced.length > 0) {
    synced.sort((a, b) => a.time - b.time || a.text.localeCompare(b.text));
    return { kind: "synced", lines: synced };
  }

  if (plain.length > 0) {
    return { kind: "plain", lines: plain };
  }

  return null;
}

export function getLyricsPathCandidates(audioPath: string): string[] {
  const lastDot = audioPath.lastIndexOf(".");
  const lastSep = Math.max(
    audioPath.lastIndexOf("/"),
    audioPath.lastIndexOf("\\"),
  );
  if (lastDot <= lastSep) {
    return [`${audioPath}.lrc`, `${audioPath}.LRC`];
  }
  const base = audioPath.slice(0, lastDot);
  return [`${base}.lrc`, `${base}.LRC`];
}

export async function loadLyricsForMedia(
  item: MediaItem,
): Promise<LyricsData | null> {
  if (!isTauri() || !isPersistablePath(item.path)) return null;

  for (const path of getLyricsPathCandidates(item.path)) {
    const exists = await mediaFileExists(path);
    if (!exists) continue;

    try {
      const text = await invoke<string>("read_text_file", { path });
      const parsed = parseLyricsContent(text);
      if (parsed) return parsed;
    } catch {
      // 尝试下一个候选路径
    }
  }

  return null;
}

export function findActiveLyricIndex(
  lines: LyricLine[],
  currentTime: number,
): number {
  let active = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].time <= currentTime + 0.05) active = i;
    else break;
  }
  return active;
}
