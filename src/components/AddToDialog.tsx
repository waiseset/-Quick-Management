import { useState } from "react";

import { useApp } from "../store";
import type { Item } from "../types";
import { cx, sortByOrder, uid } from "../util";
import { Modal } from "./Modal";

/**
 * 右键菜单的「添加到…」：把条目**复制**到指定的分类下（可一次选多个一级分类）。
 * 是复制而不是移动 —— 原条目留在原来的位置不动。
 */
export function AddToDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const { categories, data, addItem, showToast } = useApp();
  // 一级分类与二级分类都可以多选
  const [pickedCats, setPickedCats] = useState<string[]>([]);
  const [pickedSubs, setPickedSubs] = useState<string[]>([]);

  // 二级分类列出所有已选一级分类下的子分类
  const subs = sortByOrder(
    categories
      .filter((entry) => pickedCats.includes(entry.id))
      .flatMap((entry) => entry.subcategories),
  );

  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];

  const submit = () => {
    if (pickedCats.length === 0) return;
    let order = data.items.reduce((max, entry) => Math.max(max, entry.order + 1), 0);
    for (const catId of pickedCats) {
      const category = categories.find((entry) => entry.id === catId);
      const ownSubs = new Set(category?.subcategories.map((sub) => sub.id) ?? []);
      addItem({
        ...item,
        id: uid(),
        // 「添加到…」复制出来的那几份一定放在普通分类里，能直接在主页看到
        hidden: false,
        categoryIds: [catId],
        // 勾选的二级分类里，属于这个一级分类的那些
        subcategoryIds: pickedSubs.filter((id) => ownSubs.has(id)),
        order: order++,
        createdAt: Date.now(),
      });
    }
    showToast(`已复制 ${pickedCats.length} 份到所选分类`);
    onClose();
  };

  return (
    <Modal
      title="添加到…"
      width={430}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={pickedCats.length === 0}
            onClick={submit}
          >
            复制
          </button>
        </>
      }
    >
      <p className="dialog-message">
        复制「{item.name}」到下面的位置，原条目保持不动。一级分类与二级分类都可以多选。
      </p>

      <div className="field">
        <span className="field-label">一级分类（可多选）</span>
        <div className="chip-picker">
          {categories.length === 0 ? (
            <span className="field-hint">还没有分类，请先在左侧新建</span>
          ) : (
            categories.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={cx("chip", pickedCats.includes(entry.id) && "is-active")}
                onClick={() => {
                  setPickedCats((list) => toggle(list, entry.id));
                  // 取消某个分类时，把它下面的勾选一并去掉
                  const own = new Set(entry.subcategories.map((sub) => sub.id));
                  setPickedSubs((list) => list.filter((id) => !own.has(id) || !pickedCats.includes(entry.id)));
                }}
              >
                {entry.name}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="field">
        <span className="field-label">二级分类（可多选）</span>
        <div className="chip-picker">
          {pickedCats.length === 0 ? (
            <span className="field-hint">先选一级分类</span>
          ) : subs.length === 0 ? (
            <span className="field-hint">所选分类下还没有二级分类，可不选直接复制</span>
          ) : (
            subs.map((sub) => (
              <button
                key={sub.id}
                type="button"
                className={cx("chip", pickedSubs.includes(sub.id) && "is-active")}
                onClick={() => setPickedSubs((list) => toggle(list, sub.id))}
              >
                {sub.name}
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
