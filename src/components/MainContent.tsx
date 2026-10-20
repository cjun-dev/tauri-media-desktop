import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import type { MediaItem, MediaType } from "../types/media";
import { useMediaStore } from "../hooks/useMediaStore";
import { getAcceptAttribute, hydrateMediaItem, isTauri, TAB_LABELS } from "../utils/media";
import { openImageInNewWindow } from "../utils/imageWindow";
import { openMdInNewWindow } from "../utils/mdWindow";
import { openPdfInNewWindow } from "../utils/pdfWindow";
import { openVideoInNewWindow } from "../utils/videoWindow";
import { EmptyState } from "./EmptyState";
import { MediaList } from "./MediaList";

const HistoryList = lazy(() =>
  import("./HistoryList").then((m) => ({ default: m.HistoryList })),
);
const AudioPlayer = lazy(() =>
  import("./AudioPlayer").then((m) => ({ default: m.AudioPlayer })),
);
const ImageGrid = lazy(() =>
  import("./ImageGrid").then((m) => ({ default: m.ImageGrid })),
);
const ImageViewer = lazy(() =>
  import("./ImageViewer").then((m) => ({ default: m.ImageViewer })),
);
const PdfGrid = lazy(() =>
  import("./PdfGrid").then((m) => ({ default: m.PdfGrid })),
);
const PdfViewer = lazy(() =>
  import("./PdfViewer").then((m) => ({ default: m.PdfViewer })),
);
const MarkdownGrid = lazy(() =>
  import("./MarkdownGrid").then((m) => ({ default: m.MarkdownGrid })),
);
const MarkdownViewer = lazy(() =>
  import("./MarkdownViewer").then((m) => ({ default: m.MarkdownViewer })),
);
const VideoGrid = lazy(() =>
  import("./VideoGrid").then((m) => ({ default: m.VideoGrid })),
);
const VideoViewer = lazy(() =>
  import("./VideoViewer").then((m) => ({ default: m.VideoViewer })),
);

type MainContentProps = {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
};

const SELECTABLE_TABS: MediaType[] = [
  "audio",
  "video",
  "image",
  "pdf",
  "markdown",
];

const EMPTY_COPY: Record<MediaType, { message: string; icon: string }> = {
  audio: { message: "暂无音频", icon: "♫" },
  video: { message: "暂无视频", icon: "▶" },
  image: { message: "暂无图片", icon: "▣" },
  pdf: { message: "暂无 PDF", icon: "▥" },
  markdown: { message: "暂无 Markdown", icon: "☰" },
};

function isSelectableTab(tab: string): tab is MediaType {
  return SELECTABLE_TABS.includes(tab as MediaType);
}

export function MainContent({ audioRef, videoRef }: MainContentProps) {
  const {
    activeTab,
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
    replayNonce,
    playItem,
    handleEnded,
    selectLocalFiles,
    addFilesFromPaths,
    addFilesFromInput,
    removeFromList,
    moveSourceFileToTrash,
    clearHistory,
    getFilteredList,
  } = useMediaStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeTabRef = useRef(activeTab);
  const dragDepthRef = useRef(0);
  const [previewVideo, setPreviewVideo] = useState(false);
  const [previewImage, setPreviewImage] = useState<MediaItem | null>(null);
  const [previewPdf, setPreviewPdf] = useState<MediaItem | null>(null);
  const [previewMarkdown, setPreviewMarkdown] = useState<MediaItem | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  activeTabRef.current = activeTab;

  useEffect(() => {
    if (activeTab !== "video") setPreviewVideo(false);
    if (activeTab !== "image") setPreviewImage(null);
    if (activeTab !== "pdf") setPreviewPdf(null);
    if (activeTab !== "markdown") setPreviewMarkdown(null);
    setIsDragOver(false);
    dragDepthRef.current = 0;
  }, [activeTab]);

  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void getCurrentWebview()
      .onDragDropEvent((event) => {
        const tab = activeTabRef.current;
        if (!isSelectableTab(tab)) {
          setIsDragOver(false);
          return;
        }

        const { type } = event.payload;
        if (type === "enter" || type === "over") {
          setIsDragOver(true);
          return;
        }

        setIsDragOver(false);
        if (type === "drop") {
          void addFilesFromPaths(event.payload.paths, tab);
        }
      })
      .then((fn) => {
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
  }, [addFilesFromPaths]);

  const list =
    activeTab === "audio"
      ? audioList
      : activeTab === "video"
        ? videoList
        : activeTab === "image"
          ? imageList
          : activeTab === "pdf"
            ? pdfList
            : activeTab === "markdown"
              ? markdownList
              : history;
  const filteredList = getFilteredList();
  const isEmpty = list.length === 0;
  const searchPlaceholder =
    activeTab === "history" ? "在历史记录中查找" : `在${TAB_LABELS[activeTab]}中查找`;

  const handleSelectFiles = async () => {
    if (!isSelectableTab(activeTab)) return;

    if (isTauri()) {
      await selectLocalFiles(activeTab);
      return;
    }

    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isSelectableTab(activeTab)) {
      addFilesFromInput(event.target.files, activeTab);
    }
    event.target.value = "";
  };

  const canAcceptDrop = isSelectableTab(activeTab);

  const handleBrowserDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!canAcceptDrop || isTauri()) return;
    if (![...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDragOver(true);
  };

  const handleBrowserDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!canAcceptDrop || isTauri()) return;
    if (![...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleBrowserDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!canAcceptDrop || isTauri()) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleBrowserDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!canAcceptDrop || isTauri()) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragOver(false);
    addFilesFromInput(event.dataTransfer.files, activeTab);
  };

  const showAudioPlayer = currentItem?.type === "audio";
  const showAudioPlayerUi = showAudioPlayer && activeTab === "audio";

  const handleOpenVideo = (item: MediaItem) => {
    // 播放视频时打断当前音频
    audioRef.current?.pause();
    const playable = hydrateMediaItem(item);
    playItem(playable);

    if (isTauri()) {
      void openVideoInNewWindow(playable).catch((error: unknown) => {
        console.error("打开视频窗口失败", error);
        setPreviewVideo(true);
      });
      return;
    }

    setPreviewVideo(true);
  };

  const handleCloseVideo = () => {
    setIsPlaying(false);
    setPreviewVideo(false);
  };

  const handleOpenImage = (item: MediaItem) => {
    const playable = hydrateMediaItem(item);
    playItem(playable);

    if (isTauri()) {
      void openImageInNewWindow(playable).catch((error: unknown) => {
        console.error("打开图片窗口失败", error);
        setPreviewImage(playable);
      });
      return;
    }

    setPreviewImage(playable);
  };

  const handleOpenPdf = (item: MediaItem) => {
    const playable = hydrateMediaItem(item);
    playItem(playable);

    if (isTauri()) {
      void openPdfInNewWindow(playable).catch((error: unknown) => {
        console.error("打开 PDF 窗口失败", error);
        setPreviewPdf(playable);
      });
      return;
    }

    setPreviewPdf(playable);
  };

  const handleOpenMarkdown = (item: MediaItem) => {
    const playable = hydrateMediaItem(item);
    playItem(playable);

    if (isTauri()) {
      void openMdInNewWindow(playable).catch((error: unknown) => {
        console.error("打开 Markdown 窗口失败", error);
        setPreviewMarkdown(playable);
      });
      return;
    }

    setPreviewMarkdown(playable);
  };

  const emptyCopy =
    isSelectableTab(activeTab)
      ? EMPTY_COPY[activeTab]
      : { message: "暂无内容", icon: "◦" };

  return (
    <main className="main-content">
      <header className="main-header">
        <h2 className="main-title">
          {TAB_LABELS[activeTab]}({list.length})
        </h2>
        <div className="main-header-actions">
          {activeTab !== "history" ? (
            <button
              type="button"
              className="text-button"
              onClick={handleSelectFiles}
            >
              + 添加
            </button>
          ) : (
            <button
              type="button"
              className="text-button"
              disabled={isEmpty}
              onClick={() => void clearHistory()}
            >
              清除记录
            </button>
          )}
          <div className="search-box">
            <span className="search-icon">⌕</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={searchPlaceholder}
            />
          </div>
        </div>
      </header>

      <div
        className={`main-body${isDragOver && canAcceptDrop ? " is-drag-over" : ""}`}
        onDragEnter={handleBrowserDragEnter}
        onDragOver={handleBrowserDragOver}
        onDragLeave={handleBrowserDragLeave}
        onDrop={handleBrowserDrop}
      >
        {isDragOver && canAcceptDrop && (
          <div className="drop-zone-overlay" aria-hidden>
            <span className="drop-zone-hint">松开以导入文件</span>
          </div>
        )}

        {/* 保持 <audio> 挂载，切 tab 不中断；仅音频页显示播放器 UI */}
        {showAudioPlayer && currentItem.type === "audio" && (
          <Suspense fallback={null}>
            <div
              className="audio-playback-host"
              hidden={!showAudioPlayerUi}
              aria-hidden={!showAudioPlayerUi}
            >
              <AudioPlayer
                item={currentItem}
                isPlaying={isPlaying}
                replayNonce={replayNonce}
                onPlayingChange={setIsPlaying}
                onEnded={handleEnded}
                mediaRef={audioRef}
              />
            </div>
          </Suspense>
        )}

        <Suspense
          fallback={
            <div className="content-loading" role="status" aria-live="polite">
              <div className="content-loading-spinner" aria-hidden="true" />
              <p>加载中…</p>
            </div>
          }
        >
          {activeTab === "history" ? (
            isEmpty ? (
              <EmptyState
                message="暂无历史记录"
                icon="◷"
                showButton={false}
                onSelectFiles={() => undefined}
              />
            ) : (
              <HistoryList
                items={filteredList}
                onPlay={(item) => {
                  if (item.type === "video") {
                    handleOpenVideo(item);
                    return;
                  }
                  if (item.type === "image") {
                    handleOpenImage(item);
                    return;
                  }
                  if (item.type === "pdf") {
                    handleOpenPdf(item);
                    return;
                  }
                  if (item.type === "markdown") {
                    handleOpenMarkdown(item);
                    return;
                  }
                  playItem(item);
                }}
              />
            )
          ) : isEmpty ? (
            <EmptyState
              message={emptyCopy.message}
              icon={emptyCopy.icon}
              showButton
              onSelectFiles={handleSelectFiles}
            />
          ) : activeTab === "video" ? (
            <VideoGrid
              items={filteredList}
              onOpen={handleOpenVideo}
              onRemove={removeFromList}
              onMoveToTrash={moveSourceFileToTrash}
            />
          ) : activeTab === "image" ? (
            <ImageGrid
              items={filteredList}
              onOpen={handleOpenImage}
              onRemove={removeFromList}
              onMoveToTrash={moveSourceFileToTrash}
            />
          ) : activeTab === "pdf" ? (
            <PdfGrid
              items={filteredList}
              onOpen={handleOpenPdf}
              onRemove={removeFromList}
              onMoveToTrash={moveSourceFileToTrash}
            />
          ) : activeTab === "markdown" ? (
            <MarkdownGrid
              items={filteredList}
              onOpen={handleOpenMarkdown}
              onRemove={removeFromList}
              onMoveToTrash={moveSourceFileToTrash}
            />
          ) : (
            <MediaList
              items={filteredList}
              currentItem={currentItem}
              isPlaying={isPlaying}
              onPlay={playItem}
              onRemove={removeFromList}
              onMoveToTrash={moveSourceFileToTrash}
            />
          )}
        </Suspense>
      </div>

      {isSelectableTab(activeTab) && (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={getAcceptAttribute(activeTab)}
          className="hidden-input"
          onChange={handleFileChange}
        />
      )}

      <Suspense fallback={null}>
        {previewVideo &&
          activeTab === "video" &&
          currentItem?.type === "video" && (
            <VideoViewer
              item={currentItem}
              isPlaying={isPlaying}
              replayNonce={replayNonce}
              onPlayingChange={setIsPlaying}
              onEnded={handleEnded}
              onClose={handleCloseVideo}
              mediaRef={videoRef}
            />
          )}

        {previewImage && activeTab === "image" && (
          <ImageViewer item={previewImage} onClose={() => setPreviewImage(null)} />
        )}

        {previewPdf && activeTab === "pdf" && (
          <PdfViewer item={previewPdf} onClose={() => setPreviewPdf(null)} />
        )}

        {previewMarkdown && activeTab === "markdown" && (
          <MarkdownViewer
            item={previewMarkdown}
            onClose={() => setPreviewMarkdown(null)}
          />
        )}
      </Suspense>
    </main>
  );
}
