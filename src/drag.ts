import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export interface DragHandlers {
  onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
}

export interface DragList {
  /** 绑定到每个可拖拽项 */
  handlers: (id: string) => DragHandlers;
  /** 正在被拖拽的 id */
  activeId: string | null;
  /** 当前悬停的目标 id */
  overId: string | null;
  dragging: boolean;
  /** 拖动刚结束时要吞掉随之而来的 click，避免误触发选中 */
  consumeDragClick: () => boolean;
}

/**
 * 指针事件实现的排序拖拽（把拖拽项插到目标项之前）。
 *
 * 这里不用 HTML5 drag & drop：在 Windows 上，Tauri 若要接收资源管理器拖入的文件，
 * 就必须让系统接管 OLE 拖放（dragDropEnabled），而那样页面内的
 * dragstart / dragover / drop 就完全不再触发 —— 两者互斥，所以排序改为自己实现。
 */
export function useDragList(
  ids: string[],
  onReorder: (ids: string[]) => void,
  enabled = true,
): DragList {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // 用 ref 保存最新值，pointerdown 时注册的 window 监听才能读到当前状态
  const latest = useRef({ ids, onReorder, activeId, overId, enabled });
  latest.current = { ids, onReorder, activeId, overId, enabled };
  const justDragged = useRef(false);

  useEffect(
    () => () => {
      document.body.classList.remove("is-dragging-item");
    },
    [],
  );

  const handlers = useCallback(
    (id: string): DragHandlers => ({
      onPointerDown: (event) => {
        if (!latest.current.enabled || event.button !== 0) return;
        // 让右键菜单、星标等交互元素不触发拖动
        if ((event.target as HTMLElement).closest("[data-no-drag]")) return;

        const startX = event.clientX;
        const startY = event.clientY;
        let moved = false;

        const finish = (commit: boolean) => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onCancel);
          document.body.classList.remove("is-dragging-item");
          const { ids: currentIds, onReorder: reorder, overId: target } = latest.current;
          if (commit && moved && target && target !== id) {
            const next = currentIds.filter((entry) => entry !== id);
            const index = next.indexOf(target);
            if (index >= 0) {
              next.splice(index, 0, id);
              if (next.join("|") !== currentIds.join("|")) reorder(next);
            }
          }
          justDragged.current = moved;
          setActiveId(null);
          setOverId(null);
        };

        const onMove = (moveEvent: PointerEvent) => {
          if (!moved) {
            if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 4) return;
            moved = true;
            setActiveId(id);
            document.body.classList.add("is-dragging-item");
          }
          const element = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
          const target = element?.closest<HTMLElement>("[data-drag-id]");
          const targetId = target?.dataset.dragId ?? null;
          if (targetId && targetId !== id && targetId !== latest.current.overId) {
            setOverId(targetId);
          }
        };
        const onUp = () => finish(true);
        const onCancel = () => finish(false);

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onCancel);
      },
    }),
    [],
  );

  const consumeDragClick = useCallback(() => {
    if (!justDragged.current) return false;
    justDragged.current = false;
    return true;
  }, []);

  return { handlers, activeId, overId, dragging: activeId !== null, consumeDragClick };
}
