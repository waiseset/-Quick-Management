import { useMemo } from "react";
import type { MouseEvent } from "react";

import { useDragList } from "../drag";
import { useApp } from "../store";
import { useUi } from "../ui";
import { cx, sortByOrder } from "../util";
import { useContextMenu } from "./ContextMenu";

/** 一个胶囊代表什么：聚合视图会把同名子分类合并进同一条 */
interface ChipEntry {
  name: string;
  refs: Array<{ id: string; categoryId: string; categoryName: string }>;
}

/**
 * 参考文档第 3 行：二级分类用椭圆胶囊呈现，过多时自动换行。
 * - 选中具体分类：展示该分类的子分类，可拖拽排序。
 * - 「全部」「收藏夹」：聚合所有分类的子分类，同名只保留一个胶囊（筛选时一并命中）。
 * - 任何视图下都能新建子分类：聚合视图会先问清归属哪个一级分类。
 */
export function SubCategoryBar() {
  const {
    categories,
    selectedCategoryId,
    selectedSubCategoryName,
    selectSubCategory,
    addSubCategory,
    renameSubCategory,
    removeSubCategory,
    reorderSubCategories,
    data,
    view,
  } = useApp();
  const { open } = useContextMenu();
  const { prompt, choose } = useUi();

  const category = categories.find((entry) => entry.id === selectedCategoryId) ?? null;
  // 只有在主视图里才显示「当前所在分类」的选中色
  const isMain = view === "main";

  const chips = useMemo<ChipEntry[]>(() => {
    if (category) {
      return sortByOrder(category.subcategories).map((sub) => ({
        name: sub.name,
        refs: [{ id: sub.id, categoryId: category.id, categoryName: category.name }],
      }));
    }
    const merged = new Map<string, ChipEntry>();
    for (const entry of categories) {
      for (const sub of sortByOrder(entry.subcategories)) {
        const ref = { id: sub.id, categoryId: entry.id, categoryName: entry.name };
        const found = merged.get(sub.name);
        if (found) found.refs.push(ref);
        else merged.set(sub.name, { name: sub.name, refs: [ref] });
      }
    }
    return [...merged.values()];
  }, [category, categories]);

  // 聚合视图的胶囊顺序跨分类，拖拽排序没有意义，只在具体分类下启用
  const ids = category ? chips.map((entry) => entry.refs[0].id) : [];
  const { handlers, containerProps, activeId, overId } = useDragList<HTMLDivElement>(ids, (next) => {
    if (category) reorderSubCategories(category.id, next);
  });

  const promptCreate = (categoryId: string, categoryName: string) => {
    prompt({
      title: `在「${categoryName}」下新建子分类`,
      label: "子分类名称",
      placeholder: "例如：编辑器",
      confirmText: "创建",
      onSubmit: (value) => addSubCategory(categoryId, value),
    });
  };

  /** 新建子分类：具体分类下直接建；「全部」「收藏夹」下先选归属分类 */
  const requestCreate = () => {
    if (category) {
      promptCreate(category.id, category.name);
      return;
    }
    if (categories.length === 0) {
      choose({
        title: "还没有一级分类",
        message: "二级分类需要属于某个一级分类，请先点左下角「新建分类」。",
        options: [{ key: "ok", label: "知道了" }],
        onSelect: () => undefined,
      });
      return;
    }
    choose({
      title: "新建二级分类",
      message: "它要放进哪个一级分类？",
      options: categories.map((entry) => ({
        key: entry.id,
        label: entry.name,
        description:
          entry.subcategories.length > 0
            ? `已有 ${entry.subcategories.length} 个子分类`
            : "还没有子分类",
      })),
      onSelect: (key) => {
        const target = categories.find((entry) => entry.id === key);
        if (target) promptCreate(target.id, target.name);
      },
    });
  };

  /** 合并后的胶囊可能对应多个子分类，重命名会一并生效 */
  const requestRename = (entry: ChipEntry) => {
    prompt({
      title: entry.refs.length > 1 ? `重命名（${entry.refs.length} 处同名）` : "重命名子分类",
      label: "子分类名称",
      initialValue: entry.name,
      confirmText: "保存",
      onSubmit: (value) => {
        for (const ref of entry.refs) renameSubCategory(ref.categoryId, ref.id, value);
      },
    });
  };

  /** 删除子分类同样要交代它下面的条目 */
  const requestDelete = (entry: ChipEntry) => {
    const subIds = new Set(entry.refs.map((ref) => ref.id));
    const count = data.items.filter(
      (item) => item.subcategoryId !== null && subIds.has(item.subcategoryId),
    ).length;
    const scope =
      entry.refs.length > 1
        ? `「${entry.name}」在 ${entry.refs.length} 个分类下都存在（已合并显示），将一起处理。`
        : undefined;

    const apply = (mode: "delete-items" | "keep-items") => {
      for (const ref of entry.refs) removeSubCategory(ref.categoryId, ref.id, mode);
    };

    if (count === 0) {
      choose({
        title: "删除子分类",
        message: `确定删除「${entry.name}」吗？`,
        description: scope,
        options: [{ key: "keep-items", label: "删除", danger: true }],
        onSelect: () => apply("keep-items"),
      });
      return;
    }
    choose({
      title: "删除子分类",
      message: `「${entry.name}」下还有 ${count} 个条目，要一起删除吗？`,
      description: scope,
      options: [
        {
          key: "delete-items",
          label: "一起删除",
          description: `${count} 个条目会同时被删除，无法恢复`,
          danger: true,
        },
        {
          key: "keep-items",
          label: "保留条目",
          description: "条目保留在所属分类中，只是不再属于子分类",
        },
      ],
      onSelect: (key) => apply(key as "delete-items" | "keep-items"),
    });
  };

  const openSubMenu = (event: MouseEvent, entry: ChipEntry) => {
    event.preventDefault();
    event.stopPropagation();
    open({
      x: event.clientX,
      y: event.clientY,
      header: (
        <div className="menu-header-block">
          <span className="menu-header-title">{entry.name}</span>
          <span className="menu-header-meta">
            {entry.refs.length > 1
              ? `${entry.refs.length} 个分类下的同名子分类`
              : `${entry.refs[0].categoryName} 下的子分类`}
          </span>
        </div>
      ),
      items: [
        { key: "rename", label: "重命名", onSelect: () => requestRename(entry) },
        { key: "delete", label: "删除", danger: true, onSelect: () => requestDelete(entry) },
      ],
    });
  };

  return (
    <div
      className="subbar"
      onContextMenu={(event) => {
        event.preventDefault();
        open({
          x: event.clientX,
          y: event.clientY,
          items: [{ key: "add", label: "添加", onSelect: requestCreate }],
        });
      }}
      {...containerProps}
    >
      <button
        type="button"
        className={cx("chip", isMain && selectedSubCategoryName === null && "is-active")}
        onClick={() => selectSubCategory(null)}
      >
        全部
      </button>

      {chips.map((entry) => (
        <div
          key={entry.name}
          title={
            entry.refs.length > 1
              ? `${entry.refs.map((ref) => ref.categoryName).join("、")}（同名已合并）`
              : entry.refs[0].categoryName
          }
          className={cx(
            "chip",
            category && "is-draggable",
            isMain && selectedSubCategoryName === entry.name && "is-active",
            activeId === entry.refs[0].id && "is-dragging",
            overId === entry.refs[0].id && "is-drop-target",
          )}
          onClick={() => selectSubCategory(entry.name)}
          onContextMenu={(event) => openSubMenu(event, entry)}
          {...(category ? handlers(entry.refs[0].id) : {})}
        >
          {entry.name}
        </div>
      ))}

      <button type="button" className="chip chip-add" title="新建子分类" onClick={requestCreate}>
        ＋
      </button>
    </div>
  );
}
