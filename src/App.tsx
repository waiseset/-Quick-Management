import { AboutView } from "./components/AboutView";
import { ContextMenuProvider } from "./components/ContextMenu";
import { DataView } from "./components/DataView";
import { ItemGrid } from "./components/ItemGrid";
import { ReminderView } from "./components/ReminderView";
import { Sidebar } from "./components/Sidebar";
import { SubCategoryBar } from "./components/SubCategoryBar";
import { TitleBar } from "./components/TitleBar";
import { AppProvider, useApp } from "./store";
import { UiProvider } from "./ui";

/**
 * 整体骨架与参考文档一致：
 * 顶部自定义标题栏（左上角应用名 -> 菜单，右上角窗口按钮），
 * 左侧 A 列分类栏，右侧依次是二级分类胶囊行与内容区。
 */
function Shell() {
  const { ready, view, toast } = useApp();

  return (
    <div className="app">
      <TitleBar />
      <div className="app-body">
        <Sidebar />
        <main className="content">
          <SubCategoryBar />
          {view === "main" ? <ItemGrid /> : null}
          {view === "reminder" ? <ReminderView /> : null}
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
