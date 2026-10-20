import { useRef } from "react";
import { useMediaStore } from "../hooks/useMediaStore";
import { Sidebar } from "./Sidebar";
import { MainContent } from "./MainContent";
import { PlayerBar } from "./PlayerBar";

export function AppShell() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { currentItem } = useMediaStore();
  // 音频后台播放时也保留控制栏，切换 tab 不中断
  const showPlayerBar = currentItem?.type === "audio";

  return (
    <div className="app">
      <Sidebar />
      <div className="app-main">
        <MainContent audioRef={audioRef} videoRef={videoRef} />
        {showPlayerBar && (
          <PlayerBar audioRef={audioRef} videoRef={videoRef} />
        )}
      </div>
    </div>
  );
}
