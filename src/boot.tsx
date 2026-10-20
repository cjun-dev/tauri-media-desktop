import { useEffect, type ReactNode } from "react";

const SPLASH_ID = "boot-splash";

let splashHidden = false;

/** 首屏就绪后淡出 HTML 启动页，避免长时间空白 */
export function hideBootSplash() {
  if (splashHidden) return;
  splashHidden = true;

  const splash = document.getElementById(SPLASH_ID);
  if (!splash) return;

  const remove = () => {
    splash.remove();
  };

  splash.classList.add("is-hidden");
  splash.setAttribute("aria-hidden", "true");
  splash.addEventListener("transitionend", remove, { once: true });
  window.setTimeout(remove, 400);
}

/** 等子树完成首屏绘制后再撤掉启动页 */
export function BootReady({ children }: { children: ReactNode }) {
  useEffect(() => {
    let frame2 = 0;
    const frame1 = window.requestAnimationFrame(() => {
      frame2 = window.requestAnimationFrame(() => {
        hideBootSplash();
      });
    });

    return () => {
      window.cancelAnimationFrame(frame1);
      window.cancelAnimationFrame(frame2);
    };
  }, []);

  return children;
}
