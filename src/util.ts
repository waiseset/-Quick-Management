import type { IconData, ItemKind } from "./types";

/** 生成 id */
export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** 按 order 排序（order 相同时用 id 兜底，保证顺序稳定） */
export function sortByOrder<T extends { order: number; id: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** IconData -> 可直接放进 <img src> 的地址 */
export function iconSrc(icon: IconData | null | undefined): string | null {
  if (!icon || !icon.data) return null;
  return `data:${icon.mime};base64,${icon.data}`;
}

export function itemKindLabel(kind: ItemKind): string {
  if (kind === "app") return "应用";
  if (kind === "file") return "文件";
  return "网址";
}

/** 含扩展名的文件名，文件类条目用它作默认名称 */
export function fileName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/** 去重键：类型 + 名称 + 路径都一致视为同一条 */
export function uniqueKey(item: { kind: string; name: string; target: string }): string {
  return `${item.kind}|${item.name}|${item.target}`;
}

/** 统计条目数量时把完全重复的算作一个 */
export function countUnique(items: Array<{ kind: string; name: string; target: string }>): number {
  return new Set(items.map(uniqueKey)).size;
}

/** 从完整路径里取文件名（去掉扩展名），用于自动填充条目名称 */
export function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  const last = parts[parts.length - 1] ?? path;
  return last.replace(/\.(exe|lnk|bat|cmd|url)$/i, "") || last;
}

/** 从网址里取主机名，用于自动填充条目名称 */
export function hostOf(url: string): string {
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** 文本 -> base64（用于内联 SVG 图标） */
export function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** 把路径/网址截断显示，避免撑破布局 */
export function ellipsis(text: string, max = 48): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

/** 应用版本号（显示用；打包版本号见 tauri.conf.json） */
export const APP_VERSION = "3.2";

/** 项目主页 */
export const PROJECT_URL = "https://github.com/waiseset/Quick-Management";

/** 常用应用后缀 -> 选择文件时使用的过滤器 */
export const EXE_FILTER = ["exe", "lnk", "bat", "cmd"];
export const IMAGE_FILTER = ["png", "jpg", "jpeg", "gif", "bmp", "webp", "ico"];
