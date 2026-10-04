/**
 * 与 Rust 后端的所有交互都收口在这里。
 * 浏览器里（没有 Tauri 运行时）会自动降级到 localStorage，方便纯前端预览样式；
 * 需要演示数据时用 ?demo=1 打开。
 */
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";

import { demoData } from "./demo";
import { emptyData } from "./types";
import type { AppData, IconData, ItemCheck, ItemKind, MissingPath, DataLocation } from "./types";
import { EXE_FILTER, IMAGE_FILTER } from "./util";

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const STORAGE_KEY = "quick-manage:data";

function demoMode(): boolean {
  return typeof location !== "undefined" && location.search.includes("demo=1");
}

/* ------------------------------- 数据读写 ------------------------------- */

export async function loadData(): Promise<AppData> {
  if (isTauri()) {
    return await invoke<AppData>("load_data");
  }
  if (demoMode()) {
    return demoData();
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as AppData;
    } catch {
      /* 解析失败则从空数据开始 */
    }
  }
  return emptyData();
}

export async function saveData(data: AppData): Promise<void> {
  if (isTauri()) {
    await invoke("save_data", { data });
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* ------------------------------- 系统调用 ------------------------------- */

export async function openItem(kind: ItemKind, target: string): Promise<void> {
  if (isTauri()) {
    await invoke("open_item", { kind, target });
    return;
  }
  if (kind === "url") {
    window.open(target.includes("://") ? target : `https://${target}`, "_blank");
  }
}

export async function revealInExplorer(path: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("reveal_in_explorer", { path });
}

/** 本地文件 -> 图标（图片直读，exe/lnk 提取系统图标） */
export async function pickIconFromPath(path: string): Promise<IconData> {
  if (!isTauri()) throw new Error("浏览器预览模式无法读取本地图标，请在桌面版中使用");
  return await invoke<IconData>("pick_icon_from_path", { path });
}

/** 网址 -> favicon */
export async function fetchFavicon(url: string): Promise<IconData> {
  if (!isTauri()) throw new Error("浏览器预览模式无法抓取 favicon，请在桌面版中使用");
  return await invoke<IconData>("fetch_favicon_icon", { url });
}

/** 检查应用条目路径是否存在 */
export async function checkPaths(items: ItemCheck[]): Promise<MissingPath[]> {
  if (!isTauri()) return [];
  return await invoke<MissingPath[]>("check_paths", { items });
}

export async function exportData(path: string, data: AppData): Promise<void> {
  if (isTauri()) {
    await invoke("export_data", { path, data });
    return;
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quick-manage-data.json";
  a.click();
  URL.revokeObjectURL(url);
}

export async function importData(path: string): Promise<AppData> {
  if (isTauri()) {
    return await invoke<AppData>("import_data", { path });
  }
  throw new Error("浏览器预览模式无法读取本地文件，请在桌面版中使用");
}

/** 当前数据文件位置与是否便携模式 */
export async function dataLocation(): Promise<DataLocation | null> {
  if (!isTauri()) return null;
  return await invoke<DataLocation>("data_location");
}

/* ----------------------------- 系统文件对话框 ----------------------------- */

export async function chooseExecutable(): Promise<string | null> {
  if (!isTauri()) return null;
  const picked = await openDialog({
    title: "选择应用",
    multiple: false,
    directory: false,
    filters: [{ name: "应用程序", extensions: EXE_FILTER }],
  });
  return typeof picked === "string" ? picked : null;
}

export async function chooseImage(): Promise<string | null> {
  if (!isTauri()) return null;
  const picked = await openDialog({
    title: "选择图标图片",
    multiple: false,
    directory: false,
    filters: [{ name: "图片", extensions: IMAGE_FILTER }],
  });
  return typeof picked === "string" ? picked : null;
}

/** 导出：系统「另存为」对话框 */
export async function chooseExportPath(): Promise<string | null> {
  if (!isTauri()) return "browser-download";
  const stamp = new Date().toISOString().slice(0, 10);
  const picked = await saveDialog({
    title: "导出全部数据",
    defaultPath: `快捷管理-备份-${stamp}.json`,
    filters: [{ name: "快捷管理数据", extensions: ["json"] }],
  });
  return picked ?? null;
}

/** 导入：系统「打开文件」对话框 */
export async function chooseImportPath(): Promise<string | null> {
  if (!isTauri()) return null;
  const picked = await openDialog({
    title: "选择要导入的数据文件",
    multiple: false,
    directory: false,
    filters: [{ name: "快捷管理数据", extensions: ["json"] }],
  });
  return typeof picked === "string" ? picked : null;
}
