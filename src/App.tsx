import { useCallback, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

import { fetchFavicon, isTauri, pickIconFromPath } from "./api";
import { AboutView } from "./components/AboutView";
import { ContextMenuProvider } from "./components/ContextMenu";
import { DataView } from "./components/DataView";
import { ItemGrid } from "./components/ItemGrid";
import { ReminderView } from "./components/ReminderView";
import { Sidebar } from "./components/Sidebar";
import { SubCategoryBar } from "./components/SubCategoryBar";
import { TitleBar } from "./components/TitleBar";
import { VaultView } from "./components/VaultView";
import { AppProvider, useApp } from "./store";
import { ALL_CATEGORY_ID, FAVORITES_CATEGORY_ID } from "./types";
import type { DroppedEntry, IconData } from "./types";
import { UiProvider } from "./ui";
import { uid } from "./util";

/**
 * 整体骨架与参考文档一致：
 * 顶部自定义标题栏（左上角应用名 -> 菜单，右上角窗口按钮），
 * 左侧 A 列分类栏，右侧依次是二级分类胶囊行与内容区。
 */
function Shell() {
  const { ready, view, setView, toast, data, addItem, selectedCategoryId, showToast } = useApp();

  /** 从资源管理器拖进来的文件：Rust 已解析好快捷方式，这里取图标并建条目 */
  const handleDropped = useCallback(
    async (entries: DroppedEntry[]) => {
      if (!entries.length) return;
      setView("main");
      const inCategory =
        selectedCategoryId !== ALL_CATEGORY_ID && selectedCategoryId !== FAVORITES_CATEGORY_ID;
      let order = data.items.reduce((max, item) => Math.max(max, item.order + 1), 0);
      let added = 0;
      for (const entry of entries) {
        let icon: IconData | null = null;
        try {
          icon =
            entry.kind === "url"
              ? await fetchFavicon(entry.target)
              : await pickIconFromPath(entry.target);
        } catch {
          icon = null;
        }
        addItem({
          id: uid(),
          name: entry.name,
          description: "",
          kind: entry.kind === "url" ? "url" : entry.kind === "file" ? "file" : "app",
          target: entry.target,
          categoryIds: inCategory ? [selectedCategoryId] : [],
          subcategoryIds: [],
          favorite: false,
          hidden: false,
          icon,
          order: order++,
          createdAt: Date.now(),
        });
        added += 1;
      }
      showToast(`已从拖入的文件添加 ${added} 个条目`);
    },
    [addItem, data.items, selectedCategoryId, setView, showToast],
  );

  useEffect(() => {
    if (!isTauri()) return;
    let alive = true;
    let unlisten: (() => void) | undefined;
    void listen<DroppedEntry[]>("files-dropped", (event) => {
      void handleDropped(event.payload);
    }).then((fn) => {
      if (alive) unlisten = fn;
      else fn();
    });
    return () => {
      alive = false;
      unlisten?.();
    };
  }, [handleDropped]);

  // Esc 返回主视图；有弹窗开着时交给弹窗自己处理
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector(".modal-backdrop, .context-menu")) return;
      if (view !== "main") setView("main");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, setView]);

  return (
    <div className="app">
      <TitleBar />
      <div className="app-body">
        <Sidebar />
        <main className="content">
          {/* 二级分类在主页与隐藏页都用得上；提醒 / 数据管理 / 关于 不需要 */}
          {view === "main" || view === "vault" ? <SubCategoryBar /> : null}
          {view === "main" ? <ItemGrid /> : null}
          {view === "reminder" ? <ReminderView /> : null}
          {view === "vault" ? <VaultView /> : null}
          {view === "data" ? <DataView /> : null}
          {view === "about" ? <AboutView /> : null}
        </main>
      </div>
      {toast ? <div className="toast">{toast}</div> : null}
      {!ready ? <div className="boot">正在载入数据…</div> : null}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <UiProvider>
        <ContextMenuProvider>
          <Shell />
        </ContextMenuProvider>
      </UiProvider>
    </AppProvider>
  );
}
