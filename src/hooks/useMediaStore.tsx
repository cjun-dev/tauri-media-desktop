import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { confirm, message, open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { HistoryItem, MediaItem, PlayMode, Tab } from "../types/media";
import {
  createMediaItem,
  createMediaItemFromFile,
  getDialogFilters,
  getExtension,
  getMediaType,
  hydrateMediaItem,
  isPersistablePath,
  isTauri,
  mediaFileExists,
  probeMediaDuration,
  toPersistedMediaItem,
} from "../utils/media";

const HISTORY_KEY = "tauri-media-history";
const AUDIO_LIST_KEY = "tauri-media-audio-list";
const VIDEO_LIST_KEY = "tauri-media-video-list";
const IMAGE_LIST_KEY = "tauri-media-image-list";
const PDF_LIST_KEY = "tauri-media-pdf-list";
const MARKDOWN_LIST_KEY = "tauri-media-markdown-list";
const MAX_HISTORY = 100;

type DecryptNcmResult = {
  path: string;
  format: string;
  cached: boolean;
};

async function resolveImportAudioPath(path: string): Promise<string> {
  if (getExtension(path) !== "ncm") return path;
  const result = await invoke<DecryptNcmResult>("decrypt_ncm", { path });
  return result.path;
}

type SelectableMediaType = "audio" | "video" | "image" | "pdf" | "markdown";

type MediaStoreContextValue = {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  audioList: MediaItem[];
  videoList: MediaItem[];
  imageList: MediaItem[];
  pdfList: MediaItem[];
  markdownList: MediaItem[];
  history: HistoryItem[];
  currentItem: MediaItem | null;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  playMode: PlayMode;
  cyclePlayMode: () => void;
  replayNonce: number;
  playItem: (item: MediaItem) => void;
  togglePlay: () => void;
  stopPlay: () => void;
  playNext: () => void;
  playPrev: () => void;
  handleEnded: () => void;
  selectLocalFiles: (type: SelectableMediaType) => Promise<void>;
  addFilesFromPaths: (
    paths: string[],
    type: SelectableMediaType,
  ) => Promise<void>;
  addFilesFromInput: (files: FileList | null, type: SelectableMediaType) => void;
  removeFromList: (item: MediaItem) => void;
  moveSourceFileToTrash: (item: MediaItem) => Promise<void>;
  clearHistory: () => Promise<void>;
  getActiveList: () => MediaItem[];
  getFilteredList: () => MediaItem[];
};

const PLAY_MODES: PlayMode[] = ["loop", "single", "shuffle"];

const VALID_MEDIA_TYPES = new Set([
  "audio",
  "video",
  "image",
  "pdf",
  "markdown",
]);

const MediaStoreContext = createContext<MediaStoreContextValue | null>(null);

function loadMediaList(key: string): MediaItem[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MediaItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.path === "string" &&
          isPersistablePath(item.path) &&
          VALID_MEDIA_TYPES.has(item.type),
      )
      .map((item) => hydrateMediaItem(item));
  } catch {
    return [];
  }
}

function saveMediaList(key: string, list: MediaItem[]) {
  const persistable = list
    .filter((item) => isPersistablePath(item.path))
    .map(toPersistedMediaItem);
  localStorage.setItem(key, JSON.stringify(persistable));
}

/** 跳过首次写入，避免启动时把刚读出的列表再序列化一遍 */
function usePersistMediaList(key: string, list: MediaItem[]) {
  const skipFirst = useRef(true);
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    saveMediaList(key, list);
  }, [key, list]);
}

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => hydrateMediaItem(item));
  } catch {
    return [];
  }
}

function saveHistory(history: HistoryItem[]) {
  const persisted = history.map(({ playedAt, ...item }) => ({
    ...toPersistedMediaItem(item),
    playedAt,
  }));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(persisted));
}

function appendHistory(history: HistoryItem[], item: MediaItem): HistoryItem[] {
  const next = [
    { ...item, playedAt: Date.now() },
    ...history.filter((entry) => entry.path !== item.path),
  ].slice(0, MAX_HISTORY);
  saveHistory(next);
  return next;
}

function mergeMediaItems(existing: MediaItem[], incoming: MediaItem[]) {
  const seen = new Set(existing.map((item) => item.path));
  const merged = [...existing];
  for (const item of incoming) {
    if (!seen.has(item.path)) {
      seen.add(item.path);
      merged.push(item);
    }
  }
  return merged;
}

export function MediaStoreProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<Tab>("audio");
  const [searchQuery, setSearchQuery] = useState("");
  const [audioList, setAudioList] = useState<MediaItem[]>(() =>
    loadMediaList(AUDIO_LIST_KEY),
  );
  const [videoList, setVideoList] = useState<MediaItem[]>(() =>
    loadMediaList(VIDEO_LIST_KEY),
  );
  const [imageList, setImageList] = useState<MediaItem[]>(() =>
    loadMediaList(IMAGE_LIST_KEY),
  );
  const [pdfList, setPdfList] = useState<MediaItem[]>(() =>
    loadMediaList(PDF_LIST_KEY),
  );
  const [markdownList, setMarkdownList] = useState<MediaItem[]>(() =>
    loadMediaList(MARKDOWN_LIST_KEY),
  );
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory());
  const [currentItem, setCurrentItem] = useState<MediaItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>("loop");
  const [replayNonce, setReplayNonce] = useState(0);

  usePersistMediaList(AUDIO_LIST_KEY, audioList);
  usePersistMediaList(VIDEO_LIST_KEY, videoList);
  usePersistMediaList(IMAGE_LIST_KEY, imageList);
  usePersistMediaList(PDF_LIST_KEY, pdfList);
  usePersistMediaList(MARKDOWN_LIST_KEY, markdownList);

  const cyclePlayMode = useCallback(() => {
    setPlayMode((mode) => {
      const index = PLAY_MODES.indexOf(mode);
      return PLAY_MODES[(index + 1) % PLAY_MODES.length];
    });
  }, []);

  const replayCurrent = useCallback(() => {
    setReplayNonce((value) => value + 1);
    setIsPlaying(true);
  }, []);

  const pickRandomItem = useCallback(
    (list: MediaItem[], currentId: string) => {
      if (list.length === 1) return list[0];
      const others = list.filter((item) => item.id !== currentId);
      return others[Math.floor(Math.random() * others.length)];
    },
    [],
  );

  const getActiveList = useCallback((): MediaItem[] => {
    if (activeTab === "audio") return audioList;
    if (activeTab === "video") return videoList;
    if (activeTab === "image") return imageList;
    if (activeTab === "pdf") return pdfList;
    if (activeTab === "markdown") return markdownList;
    return history;
  }, [activeTab, audioList, videoList, imageList, pdfList, markdownList, history]);

  const getFilteredList = useCallback((): MediaItem[] => {
    const list = getActiveList();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return list;
    return list.filter((item) => item.name.toLowerCase().includes(query));
  }, [getActiveList, searchQuery]);

  const updateListByType = useCallback(
    (type: SelectableMediaType, updater: (prev: MediaItem[]) => MediaItem[]) => {
      switch (type) {
        case "audio":
          setAudioList(updater);
          break;
        case "video":
          setVideoList(updater);
          break;
        case "image":
          setImageList(updater);
          break;
        case "pdf":
          setPdfList(updater);
          break;
        case "markdown":
          setMarkdownList(updater);
          break;
      }
    },
    [],
  );

  const removeMissingItem = useCallback((item: MediaItem) => {
    updateListByType(item.type, (prev) =>
      prev.filter((entry) => entry.path !== item.path),
    );

    setHistory((prev) => {
      const next = prev.filter((entry) => entry.path !== item.path);
      saveHistory(next);
      return next;
    });

    setCurrentItem((current) => {
      if (current?.path !== item.path) return current;
      setIsPlaying(false);
      return null;
    });
  }, [updateListByType]);

  const playItem = useCallback(
    (item: MediaItem) => {
      // 先同步开播，保留点击手势，避免首次 play() 被浏览器拦截
      const playable = hydrateMediaItem(item);
      setActiveTab(item.type);
      setHistory((prev) => appendHistory(prev, playable));

      // 图片 / PDF / Markdown 仅浏览，不打断正在播放的音频
      if (item.type === "audio" || item.type === "video") {
        setCurrentItem(playable);
        setIsPlaying(true);
      }

      void (async () => {
        const exists = await mediaFileExists(item.path);
        if (exists) return;

        if (isTauri()) {
          await message("找不到资源", { title: "提示", kind: "error" });
        } else {
          window.alert("找不到资源");
        }
        removeMissingItem(item);
      })();
    },
    [removeMissingItem],
  );

  const getCurrentList = useCallback((): MediaItem[] => {
    if (!currentItem) return [];
    if (currentItem.type === "audio") return audioList;
    if (currentItem.type === "video") return videoList;
    if (currentItem.type === "image") return imageList;
    if (currentItem.type === "pdf") return pdfList;
    return markdownList;
  }, [currentItem, audioList, videoList, imageList, pdfList, markdownList]);

  const playNext = useCallback(() => {
    const list = getCurrentList();
    if (!currentItem || list.length === 0) {
      setIsPlaying(false);
      return;
    }

    // 视频不支持随机/单曲模式，始终按列表顺序
    if (currentItem.type === "audio" && playMode === "shuffle") {
      const next = pickRandomItem(list, currentItem.id);
      if (next.id === currentItem.id) {
        replayCurrent();
        return;
      }
      playItem(next);
      return;
    }

    const index = list.findIndex((item) => item.id === currentItem.id);
    if (index < 0) {
      setIsPlaying(false);
      return;
    }
    playItem(list[(index + 1) % list.length]);
  }, [currentItem, getCurrentList, pickRandomItem, playItem, playMode, replayCurrent]);

  const playPrev = useCallback(() => {
    const list = getCurrentList();
    if (!currentItem || list.length === 0) return;

    if (currentItem.type === "audio" && playMode === "shuffle") {
      const prev = pickRandomItem(list, currentItem.id);
      if (prev.id === currentItem.id) {
        replayCurrent();
        return;
      }
      playItem(prev);
      return;
    }

    const index = list.findIndex((item) => item.id === currentItem.id);
    if (index < 0) return;
    playItem(list[(index - 1 + list.length) % list.length]);
  }, [currentItem, getCurrentList, pickRandomItem, playItem, playMode, replayCurrent]);

  const handleEnded = useCallback(() => {
    if (currentItem?.type === "audio" && playMode === "single") {
      replayCurrent();
      return;
    }
    playNext();
  }, [currentItem, playMode, playNext, replayCurrent]);

  const togglePlay = useCallback(() => {
    if (!currentItem) return;
    setIsPlaying((prev) => !prev);
  }, [currentItem]);

  const stopPlay = useCallback(() => {
    setIsPlaying(false);
    setCurrentItem(null);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void listen<string>("menu-control", (event) => {
      switch (event.payload) {
        case "play-pause":
          togglePlay();
          break;
        case "play-prev":
          playPrev();
          break;
        case "play-next":
          playNext();
          break;
        case "cycle-play-mode":
          cyclePlayMode();
          break;
        case "help-about":
          void message("咸鱼影音播放器\n版本 0.1.0", {
            title: "关于",
            kind: "info",
          });
          break;
        default:
          break;
      }
    }).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [togglePlay, playPrev, playNext, cyclePlayMode]);

  const addMediaItems = useCallback(
    (items: MediaItem[], type: SelectableMediaType) => {
      updateListByType(type, (prev) => mergeMediaItems(prev, items));

      if (
        type === "video" ||
        type === "image" ||
        type === "pdf" ||
        type === "markdown"
      ) {
        return;
      }
      void Promise.all(
        items.map(async (item) => {
          if (!item.src || item.duration != null) return item;
          const duration = await probeMediaDuration(item.src, item.type);
          return duration == null ? item : { ...item, duration };
        }),
      ).then((resolved) => {
        const durationMap = new Map(
          resolved
            .filter((item) => item.duration != null)
            .map((item) => [item.id, item.duration as number]),
        );
        if (durationMap.size === 0) return;

        updateListByType(type, (prev) =>
          prev.map((entry) => {
            const duration = durationMap.get(entry.id);
            return duration == null ? entry : { ...entry, duration };
          }),
        );

        setCurrentItem((current) => {
          if (!current) return current;
          const duration = durationMap.get(current.id);
          return duration == null ? current : { ...current, duration };
        });
      });
    },
    [updateListByType],
  );

  const addFilesFromPaths = useCallback(
    async (paths: string[], type: SelectableMediaType) => {
      const items: MediaItem[] = [];
      const failures: string[] = [];

      for (const path of paths) {
        if (typeof path !== "string" || getMediaType(path) !== type) continue;

        try {
          const resolvedPath =
            type === "audio" ? await resolveImportAudioPath(path) : path;
          items.push(createMediaItem(resolvedPath, type));
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          const name = path.split(/[/\\]/).pop() ?? path;
          failures.push(`${name}：${detail}`);
        }
      }

      if (items.length > 0) {
        addMediaItems(items, type);
      }

      if (failures.length > 0 && isTauri()) {
        await message(`部分文件导入失败：\n${failures.join("\n")}`, {
          title: "提示",
          kind: "error",
        });
      }
    },
    [addMediaItems],
  );

  const selectLocalFiles = useCallback(
    async (type: SelectableMediaType) => {
      if (!isTauri()) return;

      const selected = await open({
        multiple: true,
        filters: getDialogFilters(type),
      });

      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];
      await addFilesFromPaths(
        paths.filter((path): path is string => typeof path === "string"),
        type,
      );
    },
    [addFilesFromPaths],
  );

  const addFilesFromInput = useCallback(
    (files: FileList | null, type: SelectableMediaType) => {
      if (!files) return;

      const items = Array.from(files)
        .filter((file) => {
          try {
            const item = createMediaItemFromFile(file);
            return item.type === type;
          } catch {
            return false;
          }
        })
        .map((file) => createMediaItemFromFile(file));

      addMediaItems(items, type);
    },
    [addMediaItems],
  );

  const removeFromList = useCallback(
    (item: MediaItem) => {
      updateListByType(item.type, (prev) =>
        prev.filter((entry) => entry.id !== item.id),
      );

      setCurrentItem((current) => {
        if (current?.id !== item.id) return current;
        setIsPlaying(false);
        return null;
      });
    },
    [updateListByType],
  );

  const moveSourceFileToTrash = useCallback(
    async (item: MediaItem) => {
      if (!isTauri() || !isPersistablePath(item.path)) {
        if (isTauri()) {
          await message("无法移动该文件（非本地路径）", {
            title: "提示",
            kind: "error",
          });
        } else {
          window.alert("当前环境不支持移动到废纸篓");
        }
        return;
      }

      const confirmed = await confirm(
        `确定要将「${item.name}」移动到废纸篓吗？`,
        {
          title: "移动到废纸篓",
          kind: "warning",
          okLabel: "移入废纸篓",
          cancelLabel: "取消",
        },
      );
      if (!confirmed) return;

      try {
        await invoke("move_source_file_to_trash", { path: item.path });
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        await message(`移入废纸篓失败：${text}`, {
          title: "提示",
          kind: "error",
        });
        return;
      }

      removeMissingItem(item);
    },
    [removeMissingItem],
  );

  const clearHistory = useCallback(async () => {
    const confirmed = isTauri()
      ? await confirm("确定要清空所有历史记录吗？此操作不可撤销。", {
          title: "清除记录",
          kind: "warning",
          okLabel: "清空",
          cancelLabel: "取消",
        })
      : window.confirm("确定要清空所有历史记录吗？此操作不可撤销。");

    if (!confirmed) return;

    setHistory([]);
    saveHistory([]);
    setSearchQuery("");
  }, []);

  const value = useMemo(
    () => ({
      activeTab,
      setActiveTab,
      searchQuery,
      setSearchQuery,
      audioList,
      videoList,
      imageList,
      pdfList,
      markdownList,
      history,
      currentItem,
      isPlaying,
      setIsPlaying,
      playMode,
      cyclePlayMode,
      replayNonce,
      playItem,
      togglePlay,
      stopPlay,
      playNext,
      playPrev,
      handleEnded,
      selectLocalFiles,
      addFilesFromPaths,
      addFilesFromInput,
      removeFromList,
      moveSourceFileToTrash,
      clearHistory,
      getActiveList,
      getFilteredList,
    }),
    [
      activeTab,
      searchQuery,
      audioList,
      videoList,
      imageList,
      pdfList,
      markdownList,
      history,
      currentItem,
      isPlaying,
      playMode,
      cyclePlayMode,
      replayNonce,
      playItem,
      togglePlay,
      stopPlay,
      playNext,
      playPrev,
      handleEnded,
      selectLocalFiles,
      addFilesFromPaths,
      addFilesFromInput,
      removeFromList,
      moveSourceFileToTrash,
      clearHistory,
      getActiveList,
      getFilteredList,
    ],
  );

  return (
    <MediaStoreContext.Provider value={value}>
      {children}
    </MediaStoreContext.Provider>
  );
}

export function useMediaStore() {
  const context = useContext(MediaStoreContext);
  if (!context) {
    throw new Error("useMediaStore must be used within MediaStoreProvider");
  }
  return context;
}
