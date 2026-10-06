import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const SIZE = 3;

/**
 * 3×3 图案锁：按住拖动依次连接圆点，至少连 4 个才会回调。
 * 结果形如 "0-1-2-4"（点的下标，按连接顺序）。
 */
export function PatternLock({ onComplete }: { onComplete: (pattern: string) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [path, setPath] = useState<number[]>([]);
  const [active, setActive] = useState(false);

  const percent = (idx: number) => (idx % SIZE) * 33.333 + 16.666;

  /** 把一个屏幕坐标换算成点位下标（要求落在圆点附近） */
  const pointAt = (clientX: number, clientY: number): number | null => {
    const box = boxRef.current;
    if (!box) return null;
    const rect = box.getBoundingClientRect();
    const cell = rect.width / SIZE;
    const col = Math.floor((clientX - rect.left) / cell);
    const row = Math.floor((clientY - rect.top) / cell);
    if (col < 0 || col >= SIZE || row < 0 || row >= SIZE) return null;
    const cx = rect.left + (col + 0.5) * cell;
    const cy = rect.top + (row + 0.5) * cell;
    if (Math.hypot(clientX - cx, clientY - cy) > cell * 0.4) return null;
    return row * SIZE + col;
  };

  const start = (event: ReactPointerEvent<HTMLDivElement>) => {
    setActive(true);
    const idx = pointAt(event.clientX, event.clientY);
    setPath(idx === null ? [] : [idx]);
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!active) return;
    const idx = pointAt(event.clientX, event.clientY);
    if (idx === null) return;
    setPath((list) => (list.includes(idx) ? list : [...list, idx]));
  };

  const end = () => {
    if (!active) return;
    setActive(false);
    if (path.length >= 4) onComplete(path.join("-"));
    setPath([]);
  };

  return (
    <div className="pattern-lock">
      <div
        ref={boxRef}
        className="pattern-box"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      >
        <svg className="pattern-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
          {path.slice(1).map((idx, i) => {
            const from = path[i];
            return (
              <line
                key={`${from}-${idx}`}
                x1={percent(from)}
                y1={percent(Math.floor(from / SIZE))}
                x2={percent(idx)}
                y2={percent(Math.floor(idx / SIZE))}
              />
            );
          })}
        </svg>
        {Array.from({ length: SIZE * SIZE }, (_, idx) => (
          <span
            key={idx}
            className={`pattern-dot${path.includes(idx) ? " is-on" : ""}`}
            style={{ left: `${percent(idx)}%`, top: `${percent(Math.floor(idx / SIZE))}%` }}
          />
        ))}
      </div>
      <p className="field-hint">按住鼠标依次连接至少 4 个点</p>
    </div>
  );
}
