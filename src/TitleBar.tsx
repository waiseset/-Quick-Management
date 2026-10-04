import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { isTauri } from "../api";
import { useApp } from "../store";
import { useContextMenu } from "./ContextMenu";

/** 参考文档：左上角标题（点击弹出菜单）、右上角 最小化/最大化/关闭 符号 */
export function TitleBar() {
  const { data, setTheme, selectedItem, view, setView, searchQuery, setSearchQuery } = useApp();
  const { open } = useContextMenu();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    const win = getCurrentWindow();
    let alive = true;
    win.isMaximized().then((value) => {
      if (alive) setMaximized(value);
    });
    const unlisten = win.onResized(() => {
      win.isMaximized().then((value) => {
        if (alive) setMaximized(value);
      });
    });
    return () => {
      alive = false;
      unlisten.then((fn) => fn());
    };
  }, []);

  const toggleMaximize = async () => {
    if (!isTauri()) return;
    await getCurrentWindow().toggleMaximize();
  };

  const openAppMenu = (event: React.MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const dark = data.settings.theme === "dark";
    open({
      x: rect.left,
      y: rect.bottom + 6,
      items: [
        { key: "reminder", label: "提醒", onSelect: () => setView("reminder") },
        { key: "data", label: "数据管理", onSelect: () => setView("data") },
        {
          key: "theme",
          label: dark ? "浅色模式" : "深色模式",
          onSelect: () => setTheme(dark ? "light" : "dark"),
        },
        { key: "about", label: "关于", onSelect: () => setView("about") },
      ],
    });
  };

  const description =
    view === "main"
      ? selectedItem?.description?.trim() || (selectedItem ? "该条目还没有描述" : "")
      : "";

  return (
    <header className="titlebar" data-tauri-drag-region>
      <button
        type="button"
        className="titlebar-brand"
        onClick={openAppMenu}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="titlebar-brand-text">快捷管理</span>
        <span className="titlebar-caret">▾</span>
      </button>

      <div className="titlebar-description" data-tauri-drag-region>
        {description}
      </div>

      <div className="titlebar-search" onMouseDown={(event) => event.stopPropagation()}>
        <svg
          className="titlebar-search-icon"
          width="13"
          height="13"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10.8 10.8 14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          className="titlebar-search-input"
          value={searchQuery}
          placeholder="搜索名称或描述"
          aria-label="搜索条目"
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setSearchQuery("");
          }}
        />
        {searchQuery ? (
          <button
            type="button"
            className="titlebar-search-clear"
            aria-label="清除搜索"
            onClick={() => setSearchQuery("")}
          >
            ✕
          </button>
        ) : null}
      </div>

      <div className="titlebar-actions" onMouseDown={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="window-button"
          aria-label="最小化"
          onClick={() => {
            if (isTauri()) void getCurrentWindow().minimize();
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
        <button type="button" className="window-button" aria-label="最大化" onClick={toggleMaximize}>
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect x="1" y="2.6" width="6.4" height="6.4" rx="1" fill="none" stroke="currentColor" strokeWidth="1.1" />
              <path d="M3.4 2.4V1.8c0-.4.3-.8.8-.8h4c.5 0 .8.4.8.8v4c0 .5-.3.8-.8.8h-.6" fill="none" stroke="currentColor" strokeWidth="1.1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect x="1.2" y="1.2" width="7.6" height="7.6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.1" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="window-button window-button-close"
          aria-label="关闭"
          onClick={() => {
            if (isTauri()) void getCurrentWindow().close();
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M1.6 1.6 8.4 8.4M8.4 1.6 1.6 8.4" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
        </button>
      </div>
    </header>
  );
}
