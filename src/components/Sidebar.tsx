import { useState } from "react";
import type { Tab } from "../types/media";
import { useMediaStore } from "../hooks/useMediaStore";

const menuItems: { id: Tab; label: string; icon: string }[] = [
  { id: "audio", label: "音频", icon: "♪" },
  { id: "video", label: "视频", icon: "▶" },
  { id: "image", label: "图片", icon: "▣" },
  { id: "pdf", label: "PDF", icon: "▥" },
  { id: "markdown", label: "Markdown", icon: "☰" },
  { id: "history", label: "历史记录", icon: "◷" },
];

export function Sidebar() {
  const { activeTab, setActiveTab } = useMediaStore();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item ${activeTab === item.id ? "active" : ""}`}
            onClick={() => setActiveTab(item.id)}
            title={item.label}
            aria-label={item.label}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "展开菜单栏" : "收起菜单栏"}
          title={collapsed ? "展开" : "收起"}
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>
    </aside>
  );
}
