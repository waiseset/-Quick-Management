import { useCallback, useRef, useState } from "react";
import type { DragEvent } from "react";

export interface DragHandlers {
  draggable: true;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}

export interface DragList<T extends HTMLElement> {
  /** 绑定到每个可拖拽项 */
  handlers: (id: string) => DragHandlers;
  /** 绑定到列表容器：拖到空白处 = 移到末尾 */
  containerProps: {
    onDragOver: (event: DragEvent<T>) => void;
    onDrop: (event: DragEvent<T>) => void;
  };
  /** 正在被拖拽的 id */
  activeId: string | null;
  /** 当前悬停的目标 id */
  overId: string | null;
}

/**
 * 原生 HTML5 拖拽排序：把拖拽项放到目标项之前，拖到空白处则移到末尾。
 * ids 必须是当前列表的完整顺序（用于计算新顺序）。
 */
export function useDragList<T extends HTMLElement = HTMLElement>(
  ids: string[],
  onReorder: (ids: string[]) => void,
): DragList<T> {
  const dragId = useRef<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const moveBefore = useCallback(
    (targetId: string | null) => {
      const from = dragId.current;
      if (!from) return;
      const next = ids.filter((id) => id !== from);
      const index = targetId === null ? next.length : next.indexOf(targetId);
      if (index < 0) return;
      next.splice(index, 0, from);
      if (next.join("|") !== ids.join("|")) onReorder(next);
    },
    [ids, onReorder],
  );

  const handlers = useCallback(
    (id: string): DragHandlers => ({
      draggable: true,
      onDragStart: (event) => {
        dragId.current = id;
        setActiveId(id);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", id);
      },
      onDragOver: (event) => {
        if (!dragId.current || dragId.current === id) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (overId !== id) setOverId(id);
      },
      onDragLeave: () => {
        setOverId((current) => (current === id ? null : current));
      },
      onDrop: (event) => {
        event.preventDefault();
        event.stopPropagation();
        moveBefore(id);
        setOverId(null);
      },
      onDragEnd: () => {
        dragId.current = null;
        setActiveId(null);
        setOverId(null);
      },
    }),
    [moveBefore, overId],
  );

  const containerProps = {
    onDragOver: (event: DragEvent<T>) => {
      if (dragId.current) event.preventDefault();
    },
    onDrop: (event: DragEvent<T>) => {
      if (!dragId.current) return;
      event.preventDefault();
      moveBefore(null);
      setOverId(null);
    },
  };

  return { handlers, containerProps, activeId, overId };
}
