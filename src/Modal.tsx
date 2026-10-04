import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export function Modal({
  title,
  children,
  footer,
  width = 440,
  onClose,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal" style={{ width }}>
        <header className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-foot">{footer}</footer> : null}
      </div>
    </div>
  );
}

/** 单行输入弹窗：新建/重命名分类、子分类都走它 */
export function PromptDialog({
  title,
  label,
  initialValue = "",
  placeholder,
  confirmText = "确定",
  onCancel,
  onSubmit,
}: {
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmText?: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  return (
    <Modal
      title={title}
      width={380}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="btn btn-primary" disabled={!value.trim()} onClick={submit}>
            {confirmText}
          </button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">{label}</span>
        <input
          ref={inputRef}
          className="input"
          value={value}
          placeholder={placeholder}
          maxLength={40}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
        />
      </label>
    </Modal>
  );
}

/** 确认弹窗（删除等破坏性操作） */
export function ConfirmDialog({
  title,
  message,
  description,
  confirmText = "确定",
  danger,
  extra,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  description?: string;
  confirmText?: string;
  danger?: boolean;
  extra?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      title={title}
      width={400}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className={danger ? "btn btn-danger" : "btn btn-primary"}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </>
      }
    >
      <p className="dialog-message">{message}</p>
      {description ? <p className="dialog-description">{description}</p> : null}
      {extra}
    </Modal>
  );
}
