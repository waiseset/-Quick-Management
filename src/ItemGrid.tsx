import { useCallback, useEffect, useState } from "react";
import type { MouseEvent } from "react";

import { openItem, revealInExplorer } from "../api";
import { useDragList } from "../drag";
import { useApp } from "../store";
import { ALL_CATEGORY_ID, FAVORITES_CATEGORY_ID } from "../types";
import type { Item, ItemKind } from "../types";
import { cx, iconSrc, itemKindLabel, uid } from "../util";
import { useContextMenu } from "./ContextMenu";
import { IconPickerDialog, ItemEditor } from "./ItemEditor";
import type { ItemDraft } from "./ItemEditor";
import { ConfirmDialog } from "./Modal";

/** 参考文档第 4 行以下：条目网格；单击显示描述、双击打开、右键出菜单、可拖拽排序 */
export function ItemGrid() {
  const {
    data,
    visibleItems,
    selectedItem,
    selectItem,
    selectedCategoryId,
    selectedSubCategoryName,
    addItem,
    updateItem,
    removeItem,
    reorderItems,
    toggleFavorite,
    showToast,
    clipboard,
    copyItem,
    cutItem,
    pasteItem,
  } = useApp();
  const { open } = useContextMenu();

  const [editing, setEditing] = useState<{ item: Item | null; kind: ItemKind } | null>(null);
  const [iconPicker, setIconPicker] = useState<Item | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Item | null>(null);

  const ids = visibleItems.map((item) => item.id);
  const { handlers, containerProps, activeId, overId } = useDragList<HTMLDivElement>(
    ids,
    reorderItems,
  );

  const report = (error: unknown) =>
    showToast(typeof error === "string" ? error : "操作失败，请稍后重试");

  const launch = (item: Item) => {
    void openItem(item.kind, item.target).catch(report);
  };

  const handleCopy = useCallback(
    (item: Item) => {
      copyItem(item.id);
      showToast(`已复制「${item.name}」`);
    },
    [copyItem, showToast],
  );

  const handleCut = useCallback(
    (item: Item) => {
      cutItem(item.id);
      showToast(`已剪切「${item.name}」`);
    },
    [cutItem, showToast],
  );

  const handlePaste = useCallback(() => {
    pasteItem();
    showToast("已粘贴");
  }, [pasteItem, showToast]);

  // 键盘快捷键：Ctrl+C 复制、Ctrl+X 剪切、Ctrl+V 粘贴（在输入框里不拦截）
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable)
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "c" && selectedItem) {
        event.preventDefault();
        handleCopy(selectedItem);
      } else if (key === "x" && selectedItem) {
        event.preventDefault();
        handleCut(selectedItem);
      } else if (key === "v" && clipboard) {
        event.preventDefault();
        handlePaste();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedItem, clipboard, handleCopy, handleCut, handlePaste]);

  const defaultCategoryId =
    selectedCategoryId === ALL_CATEGORY_ID || selectedCategoryId === FAVORITES_CATEGORY_ID
      ? null
      : selectedCategoryId;

  // 二级分类按名称记录，这里换算回当前分类下的具体 id
  const defaultSubCategoryId =
    selectedSubCategoryName && defaultCategoryId
      ? (data.categories
          .find((entry) => entry.id === defaultCategoryId)
          ?.subcategories.find((sub) => sub.name === selectedSubCategoryName)?.id ?? null)
      : null;

  const openItemMenu = (event: MouseEvent, item: Item) => {
    event.preventDefault();
    event.stopPropagation();
    selectItem(item.id);
    open({
      x: event.clientX,
      y: event.clientY,
      header: (
        <div className="item-menu-header">
          <div className="item-menu-icon">
            {iconSrc(item.icon) ? (
              <img src={iconSrc(item.icon) ?? ""} alt="" />
            ) : (
              <span>{item.kind === "app" ? "应用" : "网址"}</span>
            )}
          </div>
          <div className="item-menu-info">
            <span className="item-menu-name">{item.name}</span>
            <span className="item-menu-kind">{itemKindLabel(item.kind)}</span>
            <span className="item-menu-desc">
              {item.description.trim() || "（没有填写描述）"}
            </span>
            <span className="item-menu-path" title={item.target}>
              {item.target}
            </span>
          </div>
        </div>
      ),
      items: [
        { key: "open", label: "打开", onSelect: () => launch(item) },
        ...(item.kind === "app"
          ? [
              {
                key: "reveal",
                label: "打开所在文件夹",
                onSelect: () => void revealInExplorer(item.target).catch(report),
              },
            ]
          : []),
        {
          key: "favorite",
          label: item.favorite ? "取消收藏" : "收藏",
          onSelect: () => toggleFavorite(item.id),
        },
        { key: "copy", label: "复制", onSelect: () => handleCopy(item) },
        { key: "cut", label: "剪切", onSelect: () => handleCut(item) },
        { key: "icon", label: "更改图标", onSelect: () => setIconPicker(item) },
        { key: "edit", label: "编辑名称 / 描述 / 路径", onSelect: () => setEditing({ item, kind: item.kind }) },
        { key: "delete", label: "删除", danger: true, onSelect: () => setPendingDelete(item) },
      ],
    });
  };

  const saveDraft = (draft: ItemDraft) => {
    if (editing?.item) {
      updateItem(editing.item.id, draft);
    } else {
      const order = data.items.reduce((max, entry) => Math.max(max, entry.order + 1), 0);
      addItem({
        id: uid(),
        name: draft.name,
        description: draft.description,
        kind: draft.kind,
        target: draft.target,
        categoryId: draft.categoryId,
        subcategoryId: draft.subcategoryId,
        favorite: draft.favorite,
        icon: draft.icon,
        order,
        createdAt: Date.now(),
      });
    }
    setEditing(null);
  };

  return (
    <>
      <div
        className="item-grid"
        onClick={(event) => {
          // 点在卡片上时由卡片自己处理选中，这里只负责「点空白处取消选中」
          if (event.target === event.currentTarget) selectItem(null);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          open({
            x: event.clientX,
            y: event.clientY,
            items: [
              { key: "add", label: "添加", onSelect: () => setEditing({ item: null, kind: "app" }) },
              {
                key: "paste",
                label: "粘贴",
                hint: clipboard ? clipboard.item.name : undefined,
                disabled: !clipboard,
                onSelect: handlePaste,
              },
            ],
          });
        }}
        {...containerProps}
      >
        {visibleItems.map((item) => (
          <div
            key={item.id}
            className={cx(
              "item-card",
              selectedItem?.id === item.id && "is-selected",
              activeId === item.id && "is-dragging",
              overId === item.id && "is-drop-target",
            )}
            tabIndex={0}
            onClick={() => selectItem(item.id)}
            onDoubleClick={() => launch(item)}
            onKeyDown={(event) => {
              if (event.key === "Enter") launch(item);
              if (event.key === "Delete") setPendingDelete(item);
            }}
            onContextMenu={(event) => openItemMenu(event, item)}
            {...handlers(item.id)}
          >
            <div className="item-icon">
              {iconSrc(item.icon) ? (
                <img src={iconSrc(item.icon) ?? ""} alt="" draggable={false} />
              ) : (
                <span className="item-icon-empty">{item.kind === "app" ? "应用" : "网址"}</span>
              )}
            </div>
            <div className="item-name" title={item.name}>
              {item.name}
            </div>
            {item.favorite ? (
              <span className="item-star" title="已收藏">
                ★
              </span>
            ) : null}
          </div>
        ))}

        {visibleItems.length === 0 ? (
          <div className="item-empty">
            <p>这里还没有条目</p>
            <p className="item-empty-hint">右键空白处可以「添加」</p>
          </div>
        ) : null}
      </div>

      {editing ? (
        <ItemEditor
          item={editing.item}
          defaultKind={editing.kind}
          defaultCategoryId={editing.item?.categoryId ?? defaultCategoryId}
          defaultSubCategoryId={editing.item?.subcategoryId ?? defaultSubCategoryId}
          onClose={() => setEditing(null)}
          onSubmit={saveDraft}
        />
      ) : null}

      {iconPicker ? (
        <IconPickerDialog
          item={iconPicker}
          onClose={() => setIconPicker(null)}
          onChange={(icon) => updateItem(iconPicker.id, { icon })}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="删除条目"
          message={`确定删除「${pendingDelete.name}」吗？`}
          description="删除后无法恢复。"
          confirmText="删除"
          danger
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            removeItem(pendingDelete.id);
            if (selectedItem?.id === pendingDelete.id) selectItem(null);
            setPendingDelete(null);
          }}
        />
      ) : null}
    </>
  );
}
