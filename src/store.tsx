/**
 * 全局状态：数据（AppData）走 reducer + 自动保存，界面状态用普通 state。
 * 所有对数据的修改都会在 400ms 后写入本地 JSON。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import * as api from "./api";
import { ALL_CATEGORY_ID, FAVORITES_CATEGORY_ID, emptyData } from "./types";
import type { AppData, Category, Item, SubCategory, Theme, ViewKey } from "./types";
import { sortByOrder, uid } from "./util";

/* ------------------------------- reducer ------------------------------- */

type Action =
  | { type: "load"; data: AppData }
  | { type: "setTheme"; theme: Theme }
  | { type: "toggleFavorite"; id: string }
  | { type: "addCategory"; name: string }
  | { type: "renameCategory"; id: string; name: string }
  | { type: "removeCategory"; id: string; mode: "delete-items" | "keep-items" }
  | { type: "addSubCategory"; categoryId: string; name: string }
  | { type: "renameSubCategory"; categoryId: string; id: string; name: string }
  | {
      type: "removeSubCategory";
      categoryId: string;
      id: string;
      mode: "delete-items" | "keep-items";
    }
  | { type: "reorderCategories"; ids: string[] }
  | { type: "reorderSubCategories"; categoryId: string; ids: string[] }
  | { type: "addItem"; item: Item }
  | { type: "updateItem"; id: string; patch: Partial<Item> }
  | { type: "removeItem"; id: string }
  | { type: "reorderItems"; ids: string[] }
  | { type: "setPermanentlyIgnored"; ids: string[] }
  | { type: "clearData" };

function nextOrder(list: Array<{ order: number }>): number {
  return list.length ? Math.max(...list.map((entry) => entry.order)) + 1 : 0;
}

function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case "load":
      return action.data;

    case "setTheme":
      return { ...state, settings: { ...state.settings, theme: action.theme } };

    case "toggleFavorite":
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, favorite: !item.favorite } : item,
        ),
      };

    case "addCategory": {
      const category: Category = {
        id: uid(),
        name: action.name,
        order: nextOrder(state.categories),
        subcategories: [],
      };
      return { ...state, categories: [...state.categories, category] };
    }

    case "renameCategory":
      return {
        ...state,
        categories: state.categories.map((c) =>
          c.id === action.id ? { ...c, name: action.name } : c,
        ),
      };

    case "removeCategory": {
      const categories = state.categories.filter((c) => c.id !== action.id);
      const items =
        action.mode === "delete-items"
          ? state.items.filter((i) => i.categoryId !== action.id)
          : state.items.map((i) =>
              i.categoryId === action.id
                ? { ...i, categoryId: null, subcategoryId: null }
                : i,
            );
      return { ...state, categories, items };
    }

    case "addSubCategory": {
      const category = state.categories.find((c) => c.id === action.categoryId);
      if (!category) return state;
      const sub: SubCategory = {
        id: uid(),
        name: action.name,
        order: nextOrder(category.subcategories),
      };
      return {
        ...state,
        categories: state.categories.map((c) =>
          c.id === action.categoryId ? { ...c, subcategories: [...c.subcategories, sub] } : c,
        ),
      };
    }

    case "renameSubCategory":
      return {
        ...state,
        categories: state.categories.map((c) =>
          c.id === action.categoryId
            ? {
                ...c,
                subcategories: c.subcategories.map((s) =>
                  s.id === action.id ? { ...s, name: action.name } : s,
                ),
              }
            : c,
        ),
      };

    case "removeSubCategory": {
      const items =
        action.mode === "delete-items"
          ? state.items.filter((i) => i.subcategoryId !== action.id)
          : state.items.map((i) =>
              i.subcategoryId === action.id ? { ...i, subcategoryId: null } : i,
            );
      return {
        ...state,
        items,
        categories: state.categories.map((c) =>
          c.id === action.categoryId
            ? { ...c, subcategories: c.subcategories.filter((s) => s.id !== action.id) }
            : c,
        ),
      };
    }

    case "reorderCategories": {
      const order = new Map(action.ids.map((id, index) => [id, index]));
      return {
        ...state,
        categories: state.categories.map((c) =>
          order.has(c.id) ? { ...c, order: order.get(c.id) as number } : c,
        ),
      };
    }

    case "reorderSubCategories": {
      const order = new Map(action.ids.map((id, index) => [id, index]));
      return {
        ...state,
        categories: state.categories.map((c) =>
          c.id === action.categoryId
            ? {
                ...c,
                subcategories: c.subcategories.map((s) =>
                  order.has(s.id) ? { ...s, order: order.get(s.id) as number } : s,
                ),
              }
            : c,
        ),
      };
    }

    case "addItem":
      return { ...state, items: [...state.items, action.item] };

    case "updateItem":
      return {
        ...state,
        items: state.items.map((i) => (i.id === action.id ? { ...i, ...action.patch } : i)),
      };

    case "removeItem":
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };

    case "reorderItems": {
      // 只重新分配这批条目原本占用的 order 槽位，其它视图的顺序不受影响
      const affected = state.items.filter((i) => action.ids.includes(i.id));
      const slots = affected.map((i) => i.order).sort((a, b) => a - b);
      const assign = new Map<string, number>();
      action.ids.forEach((id, index) => assign.set(id, slots[index] ?? index));
      return {
        ...state,
        items: state.items.map((i) =>
          assign.has(i.id) ? { ...i, order: assign.get(i.id) as number } : i,
        ),
      };
    }

    case "setPermanentlyIgnored":
      return { ...state, settings: { ...state.settings, permanentlyIgnored: action.ids } };

    // 清空所有数据：分类、子分类、条目与忽略记录，主题等偏好保留
    case "clearData":
      return {
        ...state,
        categories: [],
        items: [],
        settings: { ...state.settings, permanentlyIgnored: [] },
      };

    default:
      return state;
  }
}

/* ------------------------------- context ------------------------------- */

/** 复制 / 剪切的内部剪贴板，只在本次运行内有效 */
export interface ClipboardEntry {
  mode: "copy" | "cut";
  item: Item;
}

interface AppContextValue {
  ready: boolean;
  data: AppData;
  categories: Category[];
  visibleItems: Item[];
  selectedItem: Item | null;
  selectedCategoryId: string;
  /** 选中的二级分类名称：「全部」视图会把同名子分类合并成一个胶囊 */
  selectedSubCategoryName: string | null;
  view: ViewKey;
  searchQuery: string;
  sessionIgnored: string[];
  permanentlyIgnored: string[];
  toast: string | null;
  showToast: (text: string) => void;
  setView: (view: ViewKey) => void;
  selectCategory: (id: string) => void;
  selectSubCategory: (name: string | null) => void;
  setSearchQuery: (query: string) => void;
  selectItem: (id: string | null) => void;
  setTheme: (theme: Theme) => void;
  toggleFavorite: (id: string) => void;
  addCategory: (name: string) => void;
  renameCategory: (id: string, name: string) => void;
  removeCategory: (id: string, mode: "delete-items" | "keep-items") => void;
  addSubCategory: (categoryId: string, name: string) => void;
  renameSubCategory: (categoryId: string, id: string, name: string) => void;
  removeSubCategory: (categoryId: string, id: string, mode: "delete-items" | "keep-items") => void;
  reorderCategories: (ids: string[]) => void;
  reorderSubCategories: (categoryId: string, ids: string[]) => void;
  reorderItems: (ids: string[]) => void;
  addItem: (item: Item) => void;
  updateItem: (id: string, patch: Partial<Item>) => void;
  removeItem: (id: string) => void;
  ignoreOnce: (id: string) => void;
  ignoreForever: (id: string) => void;
  restoreIgnored: (id: string) => void;
  clearData: () => void;
  replaceAll: (data: AppData) => void;
  clipboard: ClipboardEntry | null;
  copyItem: (id: string) => void;
  cutItem: (id: string) => void;
  pasteItem: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, emptyData);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<ViewKey>("main");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(ALL_CATEGORY_ID);
  const [selectedSubCategoryName, setSelectedSubCategoryName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [sessionIgnored, setSessionIgnored] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<ClipboardEntry | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);

  // 启动时读取本地数据
  useEffect(() => {
    let alive = true;
    api
      .loadData()
      .then((loaded) => {
        if (alive) dispatch({ type: "load", data: loaded });
      })
      .catch(() => {
        if (alive) dispatch({ type: "load", data: emptyData() });
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 自动保存（防抖）
  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      api.saveData(data).catch(() => undefined);
    }, 400);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [data, ready]);

  // 主题
  useEffect(() => {
    document.documentElement.dataset.theme = data.settings.theme;
  }, [data.settings.theme]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const categories = useMemo(() => sortByOrder(data.categories), [data.categories]);

  // 子分类 id -> 名称：「全部」视图把同名子分类合并成一个胶囊，筛选时按名称匹配
  const subcategoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of data.categories) {
      for (const sub of category.subcategories) map.set(sub.id, sub.name);
    }
    return map;
  }, [data.categories]);

  const visibleItems = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    let list = data.items;

    if (keyword) {
      // 搜索：跨全部分类，名称或描述命中即可
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(keyword) ||
          item.description.toLowerCase().includes(keyword),
      );
    } else {
      if (selectedCategoryId === FAVORITES_CATEGORY_ID) {
        list = list.filter((item) => item.favorite);
      } else if (selectedCategoryId !== ALL_CATEGORY_ID) {
        list = list.filter((item) => item.categoryId === selectedCategoryId);
      }
      if (selectedSubCategoryName) {
        list = list.filter(
          (item) =>
            item.subcategoryId !== null &&
            subcategoryNameById.get(item.subcategoryId) === selectedSubCategoryName,
        );
      }
    }
    return sortByOrder(list);
  }, [
    data.items,
    selectedCategoryId,
    selectedSubCategoryName,
    subcategoryNameById,
    searchQuery,
  ]);

  const selectedItem = useMemo(
    () => data.items.find((item) => item.id === selectedItemId) ?? null,
    [data.items, selectedItemId],
  );

  const selectCategory = useCallback((id: string) => {
    setSelectedCategoryId(id);
    setSelectedSubCategoryName(null);
    setSelectedItemId(null);
    setView("main");
  }, []);

  const copyItem = useCallback(
    (id: string) => {
      const item = data.items.find((entry) => entry.id === id);
      if (item) setClipboard({ mode: "copy", item });
    },
    [data.items],
  );

  const cutItem = useCallback(
    (id: string) => {
      const item = data.items.find((entry) => entry.id === id);
      if (item) setClipboard({ mode: "cut", item });
    },
    [data.items],
  );

  /** 粘贴：生成一份新条目；若来自剪切，则粘贴成功后删除原条目 */
  const pasteItem = useCallback(() => {
    if (!clipboard) return;
    const inCategory =
      selectedCategoryId !== ALL_CATEGORY_ID && selectedCategoryId !== FAVORITES_CATEGORY_ID;
    const order = data.items.reduce((max, entry) => Math.max(max, entry.order + 1), 0);
    // 二级分类按名称记录，这里换算回目标分类下的具体 id
    const targetSubcategoryId =
      inCategory && selectedSubCategoryName
        ? (data.categories
            .find((entry) => entry.id === selectedCategoryId)
            ?.subcategories.find((sub) => sub.name === selectedSubCategoryName)?.id ?? null)
        : clipboard.item.subcategoryId;
    const copy: Item = {
      ...clipboard.item,
      id: uid(),
      categoryId: inCategory ? selectedCategoryId : clipboard.item.categoryId,
      subcategoryId: targetSubcategoryId,
      order,
      createdAt: Date.now(),
    };
    dispatch({ type: "addItem", item: copy });
    if (clipboard.mode === "cut") {
      dispatch({ type: "removeItem", id: clipboard.item.id });
      setClipboard(null);
    }
  }, [clipboard, data.items, selectedCategoryId, selectedSubCategoryName]);

  const value: AppContextValue = {
    ready,
    data,
    categories,
    visibleItems,
    selectedItem,
    selectedCategoryId,
    selectedSubCategoryName,
    view,
    searchQuery,
    sessionIgnored,
    permanentlyIgnored: data.settings.permanentlyIgnored,
    toast,
    showToast: setToast,
    setView,
    selectCategory,
    // 点击二级分类时回到主视图，否则在提醒 / 数据管理等页面点胶囊看不到结果
    selectSubCategory: (name) => {
      setSelectedSubCategoryName(name);
      setSearchQuery("");
      setView("main");
    },
    setSearchQuery,
    selectItem: setSelectedItemId,
    setTheme: (theme) => dispatch({ type: "setTheme", theme }),
    toggleFavorite: (id) => dispatch({ type: "toggleFavorite", id }),
    addCategory: (name) => dispatch({ type: "addCategory", name }),
    renameCategory: (id, name) => dispatch({ type: "renameCategory", id, name }),
    removeCategory: (id, mode) => dispatch({ type: "removeCategory", id, mode }),
    addSubCategory: (categoryId, name) => dispatch({ type: "addSubCategory", categoryId, name }),
    renameSubCategory: (categoryId, id, name) =>
      dispatch({ type: "renameSubCategory", categoryId, id, name }),
    removeSubCategory: (categoryId, id, mode) =>
      dispatch({ type: "removeSubCategory", categoryId, id, mode }),
    reorderCategories: (ids) => dispatch({ type: "reorderCategories", ids }),
    reorderSubCategories: (categoryId, ids) =>
      dispatch({ type: "reorderSubCategories", categoryId, ids }),
    reorderItems: (ids) => dispatch({ type: "reorderItems", ids }),
    addItem: (item) => dispatch({ type: "addItem", item }),
    updateItem: (id, patch) => dispatch({ type: "updateItem", id, patch }),
    removeItem: (id) => dispatch({ type: "removeItem", id }),
    ignoreOnce: (id) => setSessionIgnored((list) => (list.includes(id) ? list : [...list, id])),
    ignoreForever: (id) =>
      dispatch({
        type: "setPermanentlyIgnored",
        ids: data.settings.permanentlyIgnored.includes(id)
          ? data.settings.permanentlyIgnored
          : [...data.settings.permanentlyIgnored, id],
      }),
    restoreIgnored: (id) =>
      dispatch({
        type: "setPermanentlyIgnored",
        ids: data.settings.permanentlyIgnored.filter((entry) => entry !== id),
      }),
    clearData: () => {
      dispatch({ type: "clearData" });
      setSelectedSubCategoryName(null);
      setSelectedItemId(null);
      setSessionIgnored([]);
      setClipboard(null);
      setSearchQuery("");
    },
    replaceAll: (next) => {
      dispatch({ type: "load", data: next });
      setSelectedCategoryId(ALL_CATEGORY_ID);
      setSelectedSubCategoryName(null);
      setSelectedItemId(null);
      setSessionIgnored([]);
      setClipboard(null);
      setSearchQuery("");
    },
    clipboard,
    copyItem,
    cutItem,
    pasteItem,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp 必须在 AppProvider 内使用");
  return ctx;
}
