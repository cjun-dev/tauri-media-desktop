import type { MediaItem } from "../types/media";
import { isTauri } from "./media";

export const MD_WINDOW_LABEL_PREFIX = "md-viewer";

/** 由路径生成稳定 label，同文件复用窗口、不同文件各自开窗 */
export function mdWindowLabelForPath(path: string): string {
  return `${MD_WINDOW_LABEL_PREFIX}-${hashPath(path)}`;
}

export function isMdViewerRoute(): boolean {
  return window.location.hash.startsWith("#/md-viewer");
}

export function getMdViewerPathFromHash(): string | null {
  const hash = window.location.hash;
  if (!hash.startsWith("#/md-viewer")) return null;
  const queryIndex = hash.indexOf("?");
  if (queryIndex < 0) return null;
  return new URLSearchParams(hash.slice(queryIndex + 1)).get("path");
}

function hashPath(path: string): string {
  let hash = 5381;
  for (let i = 0; i < path.length; i += 1) {
    hash = (hash * 33) ^ path.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export async function openMdInNewWindow(item: MediaItem): Promise<void> {
  if (!isTauri()) return;

  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const label = mdWindowLabelForPath(item.path);
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.setFocus();
    return;
  }

  const url = `/#/md-viewer?path=${encodeURIComponent(item.path)}`;
  const win = new WebviewWindow(label, {
    url,
    title: item.name,
    width: 960,
    height: 720,
    minWidth: 480,
    minHeight: 360,
    center: true,
    focus: true,
    backgroundColor: "#ffffff",
  });

  await new Promise<void>((resolve, reject) => {
    win.once("tauri://created", () => resolve());
    win.once("tauri://error", (event) => {
      reject(new Error(String(event.payload ?? "创建 md window failed")));
    });
  });
}
