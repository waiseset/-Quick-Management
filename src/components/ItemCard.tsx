import { useCallback, useEffect, useState } from "react";
import type { MouseEvent } from "react";

import { openItem, revealInExplorer } from "../api";
import type { DragList } from "../drag";
import { useApp } from "../store";
import type { Item } from "../types";
import { useUi } from "../ui";
import { cx, iconSrc, itemKindLabel } from "../util";
import { AddToDialog } from "./AddToDialog";
import { useContextMenu } from "./ContextMenu";
import { IconPickerDialog, ItemEditor } from "./ItemEditor";
import type { ItemDraft } from "./ItemEditor";
import { ConfirmDialog } from "./Modal";

/**
 * 条目卡片：主视图与「隐藏的元素」页共用同一份实现，
 * 单击 / 多选 / 双击 / 右键菜单 / 快捷键因此天然保持一致。
 * 唯一的差别是「隐藏」那一项 —— 隐藏页里它是「取消隐藏」。
 */
export function ItemCard({
  item,
  drag,
  inVault = false,
}: {
  item: Item;
  /** 由所在页面用 useDragList 建好的排序拖拽绑定 */
  drag: DragList;
  /** 是否位于「隐藏的元素」页 */
  inVault?: boolean;
}) {
  const { selectedIds, selectItem, updateItem, removeItem, toggleFavorite, showToast } = useApp();
  const { open } = useContextMenu();
  const { prompt } = useUi();
  const { copy, cut } = useItemClipboard(inVault);

  const [editing, setEditing] = useState<Item | null>(null);
  const [iconPicker, setIconPicker] = useState<Item | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [addTo, setAddTo] = useState<Item | null>(null);

  const report = (error: unknown) =>
    showToast(typeof error === "string" ? error : "操作失败，请稍后重试");

  const launch = () => void openItem(item.kind, item.target).catch(report);

  /** 右键菜单「重命名」：只改名字 */
  const requestRename = () =>
    prompt({
      title: "重命名",
      label: "名称",
      initialValue: item.name,
      confirmText: "保存",
      onSubmit: (value) => updateItem(item.id, { name: value }),
    });

  const askDelete = (ids: string[]) => setPendingDeleteIds(ids);

  const saveDraft = (draft: ItemDraft) => {
    updateItem(item.id, draft);
    setEditing(null);
  };

  const openItemMenu = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    // 右键已在选中集合里的条目时保留多选，否则只选中它
    const targetIds = selectedIds.includes(item.id) ? selectedIds : [item.id];
    if (!selectedIds.includes(item.id)) selectItem(item.id);
    const many = targetIds.length > 1;
    open({
      x: event.clientX,
      y: event.clientY,
      header: (
        <div className="item-menu-header">
          <div className="item-menu-icon">
            {iconSrc(item.icon) ? (
              <img src={iconSrc(item.icon) ?? ""} alt="" />
            ) : (
              <span>{itemKindLabel(item.kind)}</span>
            )}
          </div>
          <div className="item-menu-info">
            <span className="item-menu-name">
              {many ? `已选中 ${targetIds.length} 个条目` : item.name}
            </span>
            <span className="item-menu-kind">{itemKindLabel(item.kind)}</span>
            <span className="item-menu-desc">
              描述：{item.description.trim() || "（未填写）"}
            </span>
            <span className="item-menu-path" title={item.target}>
              {item.target}
            </span>
          </div>
        </div>
      ),
      items: [
        { key: "open", label: "打开", onSelect: launch },
        ...(item.kind !== "url"
          ? [
              {
                key: "reveal",
                label: "打开所在文件夹",
                onSelect: () => void revealInExplorer(item.target).catch(report),
              },
            ]
          : []),
        { key: "addto", label: "添加到…", onSelect: () => setAddTo(item) },
        { key: "sep1", separator: true },
        {
          key: "cut",
          label: many ? `剪切选中的 ${targetIds.length} 个` : "剪切",
          onSelect: () => cut(targetIds),
        },
        {
          key: "copy",
          label: many ? `复制选中的 ${targetIds.length} 个` : "复制",
          onSelect: () => copy(targetIds),
        },
        {
          key: "favorite",
          label: item.favorite ? "取消收藏" : "收藏",
          onSelect: () => {
            for (const id of targetIds) toggleFavorite(id);
          },
        },
        {
          key: "hide",
          label: inVault
            ? many
              ? `取消隐藏选中的 ${targetIds.length} 个`
              : "取消隐藏"
            : many
              ? `隐藏选中的 ${targetIds.length} 个`
              : "隐藏",
          onSelect: () => {
            for (const id of targetIds) updateItem(id, { hidden: !inVault });
            selectItem(null);
            showToast(
              inVault
                ? `已取消隐藏 ${targetIds.length} 个条目`
                : `已隐藏 ${targetIds.length} 个条目，可在「隐藏的元素」里查看`,
            );
          },
        },
        { key: "sep2", separator: true },
        { key: "icon", label: "更改图标", onSelect: () => setIconPicker(item) },
        { key: "rename", label: "重命名", onSelect: requestRename },
        { key: "props", label: "属性", onSelect: () => setEditing(item) },
        { key: "sep3", separator: true },
        {
          key: "delete",
          label: many ? `删除选中的 ${targetIds.length} 个` : "删除",
          danger: true,
          onSelect: () => askDelete(targetIds),
        },
      ],
    });
  };

  return (
    <>
      <div
        data-drag-id={item.id}
        className={cx(
          "item-card",
          selectedIds.includes(item.id) && "is-selected",
          drag.activeId === item.id && "is-dragging",
          drag.overId === item.id && "is-drop-target",
        )}
        tabIndex={0}
        onClick={(event) => {
          // 刚拖完的那次 click 不算选择
          if (drag.consumeDragClick()) return;
          // Ctrl+左键切换单个，Shift+左键成片选中，普通单击只选它自己
          if (event.ctrlKey || event.metaKey) selectItem(item.id, "toggle");
          else if (event.shiftKey) selectItem(item.id, "range");
          else selectItem(item.id, "replace");
        }}
        onDoubleClick={launch}
        onKeyDown={(event) => {
          if (event.key === "Enter") launch();
          if (event.key === "F2") requestRename();
          if (event.key === "Delete") {
            askDelete(selectedIds.includes(item.id) ? selectedIds : [item.id]);
          }
        }}
        onContextMenu={openItemMenu}
        {...drag.handlers(item.id)}
      >
        <div className="item-icon">
          {iconSrc(item.icon) ? (
            <img src={iconSrc(item.icon) ?? ""} alt="" draggable={false} />
          ) : (
            <span className="item-icon-empty">{itemKindLabel(item.kind)}</span>
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

      {addTo ? <AddToDialog item={addTo} onClose={() => setAddTo(null)} /> : null}

      {editing ? (
        <ItemEditor item={editing} onClose={() => setEditing(null)} onSubmit={saveDraft} />
      ) : null}

      {iconPicker ? (
        <IconPickerDialog
          item={iconPicker}
          onClose={() => setIconPicker(null)}
          onChange={(icon) => updateItem(iconPicker.id, { icon })}
        />
      ) : null}

      {pendingDeleteIds ? (
        <ConfirmDialog
          title="删除条目"
          message={
            pendingDeleteIds.length > 1
              ? `确定删除选中的 ${pendingDeleteIds.length} 个条目吗？`
              : `确定删除「${item.name}」吗？`
          }
          description="删除后无法恢复。"
          confirmText="删除"
          danger
          onCancel={() => setPendingDeleteIds(null)}
          onConfirm={() => {
            for (const id of pendingDeleteIds) removeItem(id);
            selectItem(null);
            setPendingDeleteIds(null);
          }}
        />
      ) : null}
    </>
  );
}

/**
 * 复制 / 剪切 / 粘贴：菜单项与 Ctrl+C / Ctrl+X / Ctrl+V 共用同一份实现。
 * inVault 为 true 时（隐藏页）粘贴出来的副本直接进隐藏区。
 */
export function useItemClipboard(inVault = false) {
  const { clipboard, selectedIds, copyItems, cutItems, pasteItems, showToast } = useApp();

  const copy = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      copyItems(ids);
      showToast(ids.length > 1 ? `已复制 ${ids.length} 个条目` : "已复制 1 个条目");
    },
    [copyItems, showToast],
  );

  const cut = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      cutItems(ids);
      showToast(ids.length > 1 ? `已剪切 ${ids.length} 个条目` : "已剪切 1 个条目");
    },
    [cutItems, showToast],
  );

  const paste = useCallback(() => {
    if (!clipboard) return;
    pasteItems(inVault);
    showToast("已粘贴");
  }, [clipboard, inVault, pasteItems, showToast]);

  // 键盘快捷键：在输入框里不拦截
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
      if (key === "c" && selectedIds.length) {
        event.preventDefault();
        copy(selectedIds);
      } else if (key === "x" && selectedIds.length) {
        event.preventDefault();
        cut(selectedIds);
      } else if (key === "v" && clipboard) {
        event.preventDefault();
        paste();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds, clipboard, copy, cut, paste]);

  return { copy, cut, paste };
}
