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
import type { AppData, Category, Item, SubCategory, Theme, Vault, ViewKey } from "./types";
import { sortByOrder, uid } from "./util";

/* ------------------------------- reducer ------------------------------- */

type Action =
  | { type: "load"; data: AppData }
  | { type: "setTheme"; theme: Theme }
  | { type: "toggleFavorite"; id: string }
  | { type: "addCategory"; name: string }
  | { type: "renameCategory"; id: string; name: string }
  | { type: "removeCategory"; id: string; mode: "delete-items" | "keep-items" }
  | { type: "addSubCategory"; categoryId: string; id: string; name: string }
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
  | { type: "setVault"; vault: Vault | null }
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
          ? state.items.filter((i) => !i.categoryIds.includes(action.id))
          : state.items.map((i) =>
              i.categoryIds.includes(action.id)
                ? { ...i, categoryIds: i.categoryIds.filter((id) => id !== action.id) }
                : i,
            );
      return { ...state, categories, items };
    }

    case "addSubCategory": {
      const category = state.categories.find((c) => c.id === action.categoryId);
      if (!category) return state;
      const sub: SubCategory = { id: action.id, name: action.name, order: nextOrder(category.subcategories) };
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
          ? state.items.filter((i) => !i.subcategoryIds.includes(action.id))
          : state.items.map((i) =>
              i.subcategoryIds.includes(action.id)
                ? { ...i, subcategoryIds: i.subcategoryIds.filter((id) => id !== action.id) }
                : i,
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

    case "setVault":
      return { ...state, settings: { ...state.settings, vault: action.vault } };

    // 清空所有数据：分类、子分类、条目、忽略记录，以及隐藏区的密码
    case "clearData":
      return {
        ...state,
        categories: [],
        items: [],
        settings: { ...state.settings, permanentlyIgnored: [], vault: null },
      };

    default:
      return state;
  }
}

/* ------------------------------- context ------------------------------- */

/** 复制 / 剪切的内部剪贴板，只在本次运行内有效 */
export interface ClipboardEntry {
  mode: "copy" | "cut";
  items: Item[];
}

/** 条目选中方式：replace = 普通单击，toggle = Ctrl+左键，range = Shift+左键 */
export type SelectMode = "replace" | "toggle" | "range";

interface AppContextValue {
  ready: boolean;
  data: AppData;
  categories: Category[];
  visibleItems: Item[];
  selectedItem: Item | null;
  /** 当前选中的条目（可多选） */
  selectedIds: string[];
  selectedCategoryId: string;
  /** 选中的二级分类名称：「全部」视图会把同名子分类合并成一个胶囊 */
  selectedSubCategoryName: string | null;
  view: ViewKey;
  /** 隐藏区是否已解锁；离开隐藏页会自动重新上锁 */
  vaultUnlocked: boolean;
  searchQuery: string;
  sessionIgnored: string[];
  permanentlyIgnored: string[];
  toast: string | null;
  showToast: (text: string) => void;
  setView: (view: ViewKey) => void;
  selectCategory: (id: string) => void;
  selectSubCategory: (name: string | null) => void;
  setSearchQuery: (query: string) => void;
  selectItem: (id: string | null, mode?: SelectMode) => void;
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
  setVault: (vault: Vault | null) => void;
  setVaultUnlocked: (value: boolean) => void;
  clipboard: ClipboardEntry | null;
  /** 本次运行内新建的二级分类 id（空的也先显示，重开应用才清理） */
  sessionSubIds: string[];
  copyItems: (ids: string[]) => void;
  cutItems: (ids: string[]) => void;
  /** 粘贴；targetHidden 为 true 时副本直接进入隐藏区（在隐藏页粘贴时用） */
  pasteItems: (targetHidden?: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, emptyData);
  const [ready, setReady] = useState(false);
  const [view, setViewState] = useState<ViewKey>("main");
  // 解锁状态放全局：标题栏要据此决定是否显示选中条目的描述
  const [vaultUnlocked, setVaultUnlockedState] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(ALL_CATEGORY_ID);
  const [selectedSubCategoryName, setSelectedSubCategoryName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // 多选：selectedIds 是当前选中的全部条目，anchorId 记录范围选择的起点
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [sessionIgnored, setSessionIgnored] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<ClipboardEntry | null>(null);
  const [sessionSubIds, setSessionSubIds] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);
  const cleanedEmptySubs = useRef(false);
  const cleanedDuplicates = useRef(false);

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

  // 启动后清掉完全重复的条目：类型 + 名称 + 路径都相同就只留一个
  useEffect(() => {
    if (!ready || cleanedDuplicates.current) return;
    cleanedDuplicates.current = true;
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const item of sortByOrder(data.items)) {
      const key = `${item.kind}|${item.name}|${item.target}`;
      if (seen.has(key)) duplicates.push(item.id);
      else seen.add(key);
    }
    for (const id of duplicates) dispatch({ type: "removeItem", id });
  }, [ready, data.items]);

  // 启动后清掉没有任何条目的二级分类：
  // 用户当次手动建了但没放东西的，重新打开应用就不再保留
  useEffect(() => {
    if (!ready || cleanedEmptySubs.current) return;
    cleanedEmptySubs.current = true;
    for (const category of data.categories) {
      for (const sub of category.subcategories) {
        const used = data.items.some((item) => item.subcategoryIds.includes(sub.id));
        if (!used) {
          dispatch({
            type: "removeSubCategory",
            categoryId: category.id,
            id: sub.id,
            mode: "keep-items",
          });
        }
      }
    }
  }, [ready, data.categories, data.items]);

  // 自动保存（防抖）
  useEffect(() => {    if (!ready) return;
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
    // 隐藏的条目只在「隐藏的元素」页里出现，其余视图一律看不到
    let list =
      view === "vault"
        ? data.items.filter((item) => item.hidden)
        : data.items.filter((item) => !item.hidden);

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
        list = list.filter((item) => item.categoryIds.includes(selectedCategoryId));
      }
      // 二级分类按名称筛选，条目可同时属于多个二级分类
      if (selectedSubCategoryName) {
        list = list.filter((item) =>
          item.subcategoryIds.some(
            (id) => subcategoryNameById.get(id) === selectedSubCategoryName,
          ),
        );
      }
    }
    // 完全一致的条目（类型 + 名称 + 路径都一样）只显示一个
    const seen = new Set<string>();
    const unique = list.filter((item) => {
      const key = `${item.kind}|${item.name}|${item.target}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return sortByOrder(unique);
  }, [
    data.items,
    selectedCategoryId,
    selectedSubCategoryName,
    subcategoryNameById,
    searchQuery,
    view,
  ]);

  const selectedItem = useMemo(() => {
    const id = selectedIds[selectedIds.length - 1];
    return data.items.find((item) => item.id === id) ?? null;
  }, [data.items, selectedIds]);

  /** 选中：普通单击替换、Ctrl+左键切换单个、Shift+左键成片选中 */
  const selectItem = useCallback(
    (id: string | null, mode: SelectMode = "replace") => {
      if (id === null) {
        setSelectedIds([]);
        setAnchorId(null);
        return;
      }
      if (mode === "toggle") {
        setSelectedIds((list) =>
          list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id],
        );
        setAnchorId(id);
        return;
      }
      if (mode === "range" && anchorId) {
        const order = visibleItems.map((item) => item.id);
        const from = order.indexOf(anchorId);
        const to = order.indexOf(id);
        if (from >= 0 && to >= 0) {
          const [start, end] = from <= to ? [from, to] : [to, from];
          setSelectedIds(order.slice(start, end + 1));
          return;
        }
      }
      setSelectedIds([id]);
      setAnchorId(id);
    },
    [anchorId, visibleItems],
  );

  /** 切换视图：清空选中（跨视图的选择没有意义），离开隐藏页立即重新上锁 */
  const setView = useCallback((next: ViewKey) => {
    setViewState(next);
    setSelectedIds([]);
    setAnchorId(null);
    if (next !== "vault") setVaultUnlockedState(false);
  }, []);

  /** 解锁 / 上锁；上锁时清空选中，避免选择状态泄漏到其它页面 */
  const setVaultUnlocked = useCallback((value: boolean) => {
    setVaultUnlockedState(value);
    if (!value) {
      setSelectedIds([]);
      setAnchorId(null);
    }
  }, []);

  const selectCategory = useCallback((id: string) => {
    setSelectedCategoryId(id);
    setSelectedSubCategoryName(null);
    setSelectedIds([]);
    setAnchorId(null);
    setView("main");
  }, []);

  const copyItems = useCallback(
    (ids: string[]) => {
      const items = data.items.filter((entry) => ids.includes(entry.id));
      if (items.length) setClipboard({ mode: "copy", items });
    },
    [data.items],
  );

  const cutItems = useCallback(
    (ids: string[]) => {
      const items = data.items.filter((entry) => ids.includes(entry.id));
      if (items.length) setClipboard({ mode: "cut", items });
    },
    [data.items],
  );

  /**
   * 粘贴：为剪贴板里每一项生成副本；若来自剪切，粘贴成功后删除原件。
   * targetHidden 决定副本落在哪一层：主视图粘贴是普通条目，隐藏页粘贴直接进隐藏区。
   */
  const pasteItems = useCallback(
    (targetHidden = false) => {
      if (!clipboard) return;
      const inCategory =
        selectedCategoryId !== ALL_CATEGORY_ID && selectedCategoryId !== FAVORITES_CATEGORY_ID;
      // 二级分类按名称记录，这里换算回目标分类下的具体 id
      const targetSubcategoryId =
        inCategory && selectedSubCategoryName
          ? (data.categories
              .find((entry) => entry.id === selectedCategoryId)
              ?.subcategories.find((sub) => sub.name === selectedSubCategoryName)?.id ?? null)
          : null;
      let order = data.items.reduce((max, entry) => Math.max(max, entry.order + 1), 0);
      for (const source of clipboard.items) {
        const copy: Item = {
          ...source,
          id: uid(),
          // 粘贴出来的副本跟着「当前所在的页面」走
          hidden: targetHidden,
          categoryIds: inCategory ? [selectedCategoryId] : source.categoryIds,
          subcategoryIds: inCategory
            ? targetSubcategoryId
              ? [targetSubcategoryId]
              : []
            : source.subcategoryIds,
          order: order++,
          createdAt: Date.now(),
        };
        dispatch({ type: "addItem", item: copy });
      }
      if (clipboard.mode === "cut") {
        for (const source of clipboard.items) dispatch({ type: "removeItem", id: source.id });
        setClipboard(null);
      }
    },
    [clipboard, data.items, data.categories, selectedCategoryId, selectedSubCategoryName],
  );

  const value: AppContextValue = {
    ready,
    data,
    categories,
    visibleItems,
    selectedItem,
    selectedIds,
    selectedCategoryId,
    selectedSubCategoryName,
    view,
    searchQuery,
    sessionIgnored,
    permanentlyIgnored: data.settings.permanentlyIgnored,
    toast,
    showToast: setToast,
    setView,
    vaultUnlocked,
    setVaultUnlocked,
    selectCategory,
    // 点击二级分类时回到主视图，否则在提醒 / 数据管理等页面点胶囊看不到结果
    selectSubCategory: (name) => {
      setSelectedSubCategoryName(name);
      setSearchQuery("");
      setView("main");
    },
    setSearchQuery,
    selectItem,
    setTheme: (theme) => dispatch({ type: "setTheme", theme }),
    toggleFavorite: (id) => dispatch({ type: "toggleFavorite", id }),
    addCategory: (name) => dispatch({ type: "addCategory", name }),
    renameCategory: (id, name) => dispatch({ type: "renameCategory", id, name }),
    removeCategory: (id, mode) => dispatch({ type: "removeCategory", id, mode }),
    addSubCategory: (categoryId, name) => {
      // id 在这里生成，同时记下「本次运行内新建」，空的也先显示出来
      const id = uid();
      setSessionSubIds((list) => [...list, id]);
      dispatch({ type: "addSubCategory", categoryId, id, name });
    },
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
      // 密码一起被清掉了，解锁状态也要归零
      setVaultUnlockedState(false);
      setSelectedSubCategoryName(null);
      setSelectedIds([]);
      setAnchorId(null);
      setSessionIgnored([]);
      setClipboard(null);
      setSearchQuery("");
    },
    replaceAll: (next) => {
      dispatch({ type: "load", data: next });
      setSelectedCategoryId(ALL_CATEGORY_ID);
      setSelectedSubCategoryName(null);
      setSelectedIds([]);
      setAnchorId(null);
      setSessionIgnored([]);
      setClipboard(null);
      setSearchQuery("");
    },
    clipboard,
    sessionSubIds,
    setVault: (vault) => dispatch({ type: "setVault", vault }),
    copyItems,
    cutItems,
    pasteItems,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp 必须在 AppProvider 内使用");
  return ctx;
}
