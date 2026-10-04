/** 与 Rust 侧 model.rs 一一对应的数据结构（通过 serde camelCase 序列化） */

export type ItemKind = "app" | "url";
export type Theme = "light" | "dark";

/** 图标：base64 图像数据（svg 直接原样保存，交给浏览器渲染） */
export interface IconData {
  mime: string;
  data: string;
}

export interface SubCategory {
  id: string;
  name: string;
  order: number;
}

export interface Category {
  id: string;
  name: string;
  order: number;
  subcategories: SubCategory[];
}

export interface Item {
  id: string;
  name: string;
  description: string;
  kind: ItemKind;
  /** 应用的路径，或网址的 URL */
  target: string;
  categoryId: string | null;
  subcategoryId: string | null;
  favorite: boolean;
  icon: IconData | null;
  order: number;
  createdAt: number;
}

export interface Settings {
  theme: Theme;
  /** 路径检查中「永久忽略」的条目 id */
  permanentlyIgnored: string[];
}

export interface AppData {
  version: number;
  categories: Category[];
  items: Item[];
  settings: Settings;
}

/** 路径检查结果 */
export interface MissingPath {
  id: string;
  name: string;
  path: string;
}

/** 数据文件位置：便携版在 exe 旁边，安装版在 %APPDATA% */
export interface DataLocation {
  path: string;
  portable: boolean;
}

/** 路径检查请求 */
export interface ItemCheck {
  id: string;
  name: string;
  kind: ItemKind;
  target: string;
}

/** 左侧栏的虚拟分类 id */
export const ALL_CATEGORY_ID = "__all__";
export const FAVORITES_CATEGORY_ID = "__favorites__";

/** 主区域当前显示的页面 */
export type ViewKey = "main" | "reminder" | "data" | "about";

export function emptyData(): AppData {
  return {
    version: 1,
    categories: [],
    items: [],
    settings: { theme: "light", permanentlyIgnored: [] },
  };
}
