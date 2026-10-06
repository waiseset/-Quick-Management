import { useMemo } from "react";
import type { MouseEvent } from "react";

import { useDragList } from "../drag";
import { useApp } from "../store";
import { ALL_CATEGORY_ID, FAVORITES_CATEGORY_ID } from "../types";
import type { Category } from "../types";
import { useUi } from "../ui";
import { countUnique, cx } from "../util";
import { useContextMenu } from "./ContextMenu";

/** 参考文档 A 列：收藏夹 / 全部 / 一级分类列表；A 列空白处右键只有「添加」 */
export function Sidebar() {
  const {
    categories,
    data,
    selectedCategoryId,
    selectCategory,
    addCategory,
    renameCategory,
    removeCategory,
    reorderCategories,
    addSubCategory,
    view,
  } = useApp();
  const { open } = useContextMenu();
  const { prompt, choose } = useUi();

  const ids = useMemo(() => categories.map((category) => category.id), [categories]);
  const { handlers, activeId, overId, consumeDragClick } = useDragList(ids, reorderCategories);

  // 计数时把完全重复的算作一个，且不包含隐藏的条目
  const visible = data.items.filter((item) => !item.hidden);
  const countOf = (categoryId: string) =>
    countUnique(visible.filter((item) => item.categoryIds.includes(categoryId)));
  const favoritesCount = countUnique(visible.filter((item) => item.favorite));
  const totalCount = countUnique(visible);

  // 提醒 / 数据管理 / 关于 这些页面不属于任何分类，因此不显示选中色
  const isMain = view === "main";

  const requestCreate = () =>
    prompt({
      title: "新建分类",
      label: "分类名称",
      placeholder: "例如：开发工具",
      confirmText: "创建",
      onSubmit: (value) => addCategory(value),
    });

  const requestRename = (category: Category) =>
    prompt({
      title: "重命名分类",
      label: "分类名称",
      initialValue: category.name,
      confirmText: "保存",
      onSubmit: (value) => renameCategory(category.id, value),
    });

  /** 删除分类时提示如何处理其下的条目 */
  const requestDelete = (category: Category) => {
    const count = countOf(category.id);
    if (count === 0) {
      choose({
        title: "删除分类",
        message: `确定删除「${category.name}」吗？`,
        options: [{ key: "keep-items", label: "删除", danger: true }],
        onSelect: () => removeCategory(category.id, "keep-items"),
      });
      return;
    }
    choose({
      title: "删除分类",
      message: `「${category.name}」下还有 ${count} 个条目，要一起删除吗？`,
      options: [
        {
          key: "delete-items",
          label: "一起删除",
          description: `${count} 个条目会同时被删除，无法恢复`,
          danger: true,
        },
        { key: "keep-items", label: "保留条目", description: "条目移到「全部」中，不再属于任何分类" },
      ],
      onSelect: (key) => removeCategory(category.id, key as "delete-items" | "keep-items"),
    });
  };

  const openCategoryMenu = (event: MouseEvent, category: Category) => {
    event.preventDefault();
    event.stopPropagation();
    open({
      x: event.clientX,
      y: event.clientY,
      header: (
        <div className="menu-header-block">
          <span className="menu-header-title">{category.name}</span>
          <span className="menu-header-meta">
            {countOf(category.id)} 个条目 · {category.subcategories.length} 个子分类
          </span>
        </div>
      ),
      items: [
        { key: "add-sub", label: "添加子分类", onSelect: () => addSubCategoryPrompt(category) },
        { key: "rename", label: "重命名", onSelect: () => requestRename(category) },
        { key: "delete", label: "删除", danger: true, onSelect: () => requestDelete(category) },
      ],
    });
  };

  const addSubCategoryPrompt = (category: Category) => {
    prompt({
      title: `在「${category.name}」下新建子分类`,
      label: "子分类名称",
      placeholder: "例如：编辑器",
      confirmText: "创建",
      onSubmit: (value) => addSubCategory(category.id, value),
    });
  };

  return (
    <aside
      className="sidebar"
      onContextMenu={(event) => {
        event.preventDefault();
        open({
          x: event.clientX,
          y: event.clientY,
          items: [{ key: "add", label: "添加", onSelect: requestCreate }],
        });
      }}
    >
      <nav className="sidebar-list">
        <button
          type="button"
          className={cx(
            "sidebar-item",
            isMain && selectedCategoryId === FAVORITES_CATEGORY_ID && "is-active",
          )}
          onClick={() => selectCategory(FAVORITES_CATEGORY_ID)}
        >
          <span className="sidebar-mark sidebar-mark-star">★</span>
          <span className="sidebar-label">收藏夹</span>
          <span className="sidebar-count">{favoritesCount}</span>
        </button>

        <button
          type="button"
          className={cx(
            "sidebar-item",
            isMain && selectedCategoryId === ALL_CATEGORY_ID && "is-active",
          )}
          onClick={() => selectCategory(ALL_CATEGORY_ID)}
        >
          <span className="sidebar-mark">▦</span>
          <span className="sidebar-label">全部</span>
          <span className="sidebar-count">{totalCount}</span>
        </button>

        <div className="sidebar-divider" />

        {categories.map((category) => (
          <div
            key={category.id}
            data-drag-id={category.id}
            className={cx(
              "sidebar-item",
              "is-draggable",
              isMain && selectedCategoryId === category.id && "is-active",
              activeId === category.id && "is-dragging",
              overId === category.id && "is-drop-target",
            )}
            onClick={() => {
              if (consumeDragClick()) return;
              selectCategory(category.id);
            }}
            onContextMenu={(event) => openCategoryMenu(event, category)}
            {...handlers(category.id)}
          >
            <span className="sidebar-mark sidebar-mark-dot" />
            <span className="sidebar-label">{category.name}</span>
            <span className="sidebar-count">{countOf(category.id)}</span>
          </div>
        ))}
      </nav>

      <button type="button" className="sidebar-add" onClick={requestCreate}>
        ＋ 新建分类
      </button>
    </aside>
  );
}
