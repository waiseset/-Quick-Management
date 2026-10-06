import { useMemo, useState } from "react";

import { chooseExecutables, pickIconFromPath, resolveTarget } from "../api";
import { useDragList } from "../drag";
import { useApp } from "../store";
import { ALL_CATEGORY_ID, FAVORITES_CATEGORY_ID } from "../types";
import type { IconData, ItemKind } from "../types";
import { baseName, uid } from "../util";
import { useContextMenu } from "./ContextMenu";
import { ItemCard, useItemClipboard } from "./ItemCard";
import { ItemEditor } from "./ItemEditor";
import type { ItemDraft } from "./ItemEditor";

/**
 * 参考文档第 4 行以下：条目网格。
 * 卡片本身的单击 / 双击 / 右键菜单 / 拖拽都在 ItemCard 里（与「隐藏的元素」页共用），
 * 这里只负责网格容器（点空白取消选中、右键「添加 / 批量添加应用 / 粘贴」）。
 */
export function ItemGrid() {
  const {
    data,
    visibleItems,
    selectedCategoryId,
    selectedSubCategoryName,
    addItem,
    selectItem,
    reorderItems,
    showToast,
    clipboard,
  } = useApp();
  const { open } = useContextMenu();
  const { paste } = useItemClipboard();

  const [creating, setCreating] = useState<ItemKind | null>(null);

  const ids = visibleItems.map((item) => item.id);
  const drag = useDragList(ids, reorderItems);

  const defaultCategoryIds =
    selectedCategoryId === ALL_CATEGORY_ID || selectedCategoryId === FAVORITES_CATEGORY_ID
      ? []
      : [selectedCategoryId];

  // 当前选中的二级分类名换算成 id（同名子分类可能分布在多个一级分类下）
  const defaultSubCategoryIds = useMemo(() => {
    if (!selectedSubCategoryName) return [];
    const ids: string[] = [];
    for (const category of data.categories) {
      for (const sub of category.subcategories) {
        if (sub.name === selectedSubCategoryName) ids.push(sub.id);
      }
    }
    return ids;
  }, [data.categories, selectedSubCategoryName]);

  const inFavorites = selectedCategoryId === FAVORITES_CATEGORY_ID;

  /** 批量添加应用：一次选多个文件，逐个提取图标后建条目 */
  const bulkAddApps = async () => {
    const paths = await chooseExecutables();
    if (!paths.length) return;
    showToast(`正在添加 ${paths.length} 个应用…`);
    let order = data.items.reduce((max, entry) => Math.max(max, entry.order + 1), 0);
    for (const path of paths) {
      // 快捷方式先解析到真实目标，避免把 .lnk 本身当成应用
      const target = (await resolveTarget(path)) ?? path;
      let icon: IconData | null = null;
      try {
        icon = await pickIconFromPath(target);
      } catch {
        icon = null;
      }
      addItem({
        id: uid(),
        name: baseName(target),
        description: "",
        kind: "app",
        target,
        categoryIds: defaultCategoryIds,
        subcategoryIds: defaultSubCategoryIds,
        favorite: inFavorites,
        hidden: false,
        icon,
        order: order++,
        createdAt: Date.now(),
      });
    }
    showToast(`已添加 ${paths.length} 个应用`);
  };

  const saveDraft = (draft: ItemDraft) => {
    const order = data.items.reduce((max, entry) => Math.max(max, entry.order + 1), 0);
    addItem({
      id: uid(),
      name: draft.name,
      description: draft.description,
      kind: draft.kind,
      target: draft.target,
      categoryIds: draft.categoryIds,
      subcategoryIds: draft.subcategoryIds,
      // 在收藏夹页面添加的条目直接就是收藏状态
      favorite: draft.favorite || inFavorites,
      hidden: false,
      icon: draft.icon,
      order,
      createdAt: Date.now(),
    });
    setCreating(null);
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
              { key: "add", label: "添加", onSelect: () => setCreating("app") },
              { key: "bulk", label: "批量添加应用…", onSelect: () => void bulkAddApps() },
              {
                key: "paste",
                label: "粘贴",
                hint: clipboard
                  ? clipboard.items.length > 1
                    ? `${clipboard.items.length} 个条目`
                    : clipboard.items[0].name
                  : undefined,
                disabled: !clipboard,
                onSelect: paste,
              },
            ],
          });
        }}
      >
        {visibleItems.map((item) => (
          <ItemCard key={item.id} item={item} drag={drag} />
        ))}

        {visibleItems.length === 0 ? (
          <div className="item-empty">
            <p>这里还没有条目</p>
            <p className="item-empty-hint">右键空白处可以「添加」</p>
          </div>
        ) : null}
      </div>

      {creating ? (
        <ItemEditor
          item={null}
          defaultKind={creating}
          defaultCategoryIds={defaultCategoryIds}
          defaultSubCategoryIds={defaultSubCategoryIds}
          onClose={() => setCreating(null)}
          onSubmit={saveDraft}
        />
      ) : null}
    </>
  );
}
