import { useState } from "react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "ok", "0", "back"] as const;

/**
 * 手机锁屏样式的数字键盘：上方一排圆点表示已输入的位数，
 * 下方 3×4 键位（1-9 / 确认 / 0 / 退格）。
 * 传一个新的 key 即可清空当前输入。
 */
export function NumberPad({
  onSubmit,
  minLength = 4,
}: {
  onSubmit: (value: string) => void;
  minLength?: number;
}) {
  const [value, setValue] = useState("");
  const dots = Math.max(value.length, minLength);

  const press = (key: string) => {
    if (key === "back") {
      setValue((current) => current.slice(0, -1));
      return;
    }
    if (key === "ok") {
      if (value.length >= minLength) {
        onSubmit(value);
        setValue("");
      }
      return;
    }
    setValue((current) => (current.length >= 12 ? current : current + key));
  };

  return (
    <div className="numpad">
      <div className="numpad-dots" aria-label={`已输入 ${value.length} 位`}>
        {Array.from({ length: dots }, (_, index) => (
          <span key={index} className={`numpad-dot${index < value.length ? " is-on" : ""}`} />
        ))}
      </div>
      <div className="numpad-grid">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={`numpad-key${key === "ok" ? " is-primary" : ""}`}
            disabled={key === "ok" && value.length < minLength}
            onClick={() => press(key)}
          >
            {key === "back" ? "⌫" : key === "ok" ? "✓" : key}
          </button>
        ))}
      </div>
      <p className="field-hint">至少 {minLength} 位</p>
    </div>
  );
}
