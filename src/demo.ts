/**
 * 演示数据：仅在浏览器里以 ?demo=1 打开时使用（方便调样式/预览），
 * 桌面版始终走 Tauri 命令，不会碰到这里。
 */
import type { AppData } from "./types";
import { textToBase64 } from "./util";

export function demoData(): AppData {
  const icon = (bg: string, label: string) => ({
    mime: "image/svg+xml",
    data: textToBase64(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="${bg}"/><text x="32" y="43" font-family="Segoe UI, sans-serif" font-size="28" font-weight="600" fill="#ffffff" text-anchor="middle">${label}</text></svg>`,
    ),
  });

  const cat = (id: string, name: string, order: number, subs: Array<[string, string]> = []) => ({
    id,
    name,
    order,
    subcategories: subs.map(([sid, sname], i) => ({ id: sid, name: sname, order: i })),
  });

  const item = (
    id: string,
    name: string,
    description: string,
    kind: "app" | "url",
    target: string,
    categoryId: string | null,
    subcategoryId: string | null,
    order: number,
    favorite: boolean,
    color: string,
    label: string,
  ) => ({
    id,
    name,
    description,
    kind,
    target,
    categoryId,
    subcategoryId,
    favorite,
    icon: icon(color, label),
    order,
    createdAt: Date.now() - order * 86_400_000,
  });

  return {
    version: 1,
    categories: [
      cat("c-dev", "开发工具", 0, [
        ["s-editor", "编辑器"],
        ["s-terminal", "终端"],
      ]),
      cat("c-design", "设计", 1, [
        ["s-graphics", "图形"],
        ["s-color", "配色"],
        ["s-doc2", "文档"],
      ]),
      cat("c-study", "学习", 2, [["s-doc", "文档"]]),
    ],
    items: [
      item("i-1", "Visual Studio Code", "写代码的主力编辑器，装了 Vim 与 Rust 插件。", "app", "C:\\Program Files\\Microsoft VS Code\\Code.exe", "c-dev", "s-editor", 0, true, "#2f7ce0", "VS"),
      item("i-2", "Windows Terminal", "多标签终端，默认开 PowerShell 7。", "app", "C:\\Program Files\\WindowsApps\\wt.exe", "c-dev", "s-terminal", 1, true, "#3d3d3d", ">_"),
      item("i-3", "Figma", "在线设计稿，团队共享链接在这里。", "url", "https://www.figma.com", "c-design", "s-graphics", 2, true, "#a259ff", "F"),
      item("i-4", "Coolors", "快速生成配色方案。", "url", "https://coolors.co", "c-design", "s-color", 3, false, "#1f9d8f", "C"),
      item("i-5", "Rust 官方文档", "标准库与 The Book 的入口。", "url", "https://doc.rust-lang.org", "c-study", "s-doc", 4, false, "#c1571a", "R"),
      item("i-6", "MDN Web Docs", "前端 API 查询首选。", "url", "https://developer.mozilla.org", "c-study", "s-doc", 5, false, "#4b5563", "M"),
      item("i-7", "7-Zip", "压缩包处理。", "app", "C:\\Program Files\\7-Zip\\7zFM.exe", "c-dev", null, 6, false, "#3b7d0f", "7z"),
      item("i-8", "记事本", "临时记录。", "app", "C:\\Windows\\System32\\notepad.exe", null, null, 7, false, "#5b7fa6", "N"),
      item("i-9", "设计规范", "团队设计规范的在线文档，和「学习」下的文档同名子分类。", "url", "https://example.com/design-spec", "c-design", "s-doc2", 8, false, "#6b7280", "D"),
    ],
    settings: { theme: "light", permanentlyIgnored: ["i-7"] },
  };
}
