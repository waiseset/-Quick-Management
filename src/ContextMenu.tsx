import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface MenuItem {
  key: string;
  label: string;
  /** 右侧灰字提示（例如路径） */
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}

interface OpenMenu {
  x: number;
  y: number;
  header?: ReactNode;
  items: MenuItem[];
}

interface MenuContextValue {
  open: (menu: OpenMenu) => void;
  close: () => void;
}

const MenuContext = createContext<MenuContextValue | null>(null);

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<OpenMenu | null>(null);
  const open = useCallback((next: OpenMenu) => setMenu(next), []);
  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", close);
      window.removeEventListener("resize", close);
    };
  }, [menu, close]);

  return (
    <MenuContext.Provider value={{ open, close }}>
      {children}
      {menu ? <ContextMenu {...menu} onClose={close} /> : null}
    </MenuContext.Provider>
  );
}

export function useContextMenu(): MenuContextValue {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error("useContextMenu 必须在 ContextMenuProvider 内使用");
  return ctx;
}

function ContextMenu({ x, y, header, items, onClose }: OpenMenu & { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y, ready: false });

  // 贴边时翻转，保证菜单完整可见
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - rect.width - margin);
    }
    if (top + rect.height > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - rect.height - margin);
    }
    setPos({ left, top, ready: true });
  }, [x, y]);

  // 点击任意处关闭菜单。只监听 mousedown：右键按下时会先触发 mousedown，
  // 所以关闭逻辑不需要监听 contextmenu —— 否则「打开菜单的那个 contextmenu 事件」
  // 冒泡到 window 时会把刚打开的菜单立刻关掉（右键菜单因此完全不可用）。
  useEffect(() => {
    const onDown = () => onClose();
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  return (
    <>
      <div className="menu-backdrop" />
      <div
        ref={ref}
        className="context-menu"
        style={{ left: pos.left, top: pos.top, visibility: pos.ready ? "visible" : "hidden" }}
        onMouseDown={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
      >
        {header ? <div className="context-menu-header">{header}</div> : null}
        <div className="context-menu-items">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`context-menu-item${item.danger ? " is-danger" : ""}`}
              disabled={item.disabled}
              onClick={() => {
                onClose();
                item.onSelect?.();
              }}
            >
              <span className="context-menu-label">{item.label}</span>
              {item.hint ? <span className="context-menu-hint">{item.hint}</span> : null}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
