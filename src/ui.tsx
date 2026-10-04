/**
 * 全局弹窗宿主：任何组件都能用 useUi() 直接唤起输入框 / 确认框 / 选择框，
 * 不必各自维护弹窗状态。
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { ConfirmDialog, Modal, PromptDialog } from "./components/Modal";

interface PromptOptions {
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmText?: string;
  onSubmit: (value: string) => void;
}

interface ConfirmOptions {
  title: string;
  message: string;
  description?: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => void;
}

interface ChoiceOption {
  key: string;
  label: string;
  description?: string;
  danger?: boolean;
}

interface ChooseOptions {
  title: string;
  message: string;
  description?: string;
  options: ChoiceOption[];
  onSelect: (key: string) => void;
}

type Dialog =
  | ({ kind: "prompt" } & PromptOptions)
  | ({ kind: "confirm" } & ConfirmOptions)
  | ({ kind: "choose" } & ChooseOptions);

interface UiApi {
  prompt: (options: PromptOptions) => void;
  confirm: (options: ConfirmOptions) => void;
  choose: (options: ChooseOptions) => void;
}

const UiContext = createContext<UiApi | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const prompt = useCallback((options: PromptOptions) => {
    setDialog({ kind: "prompt", ...options });
  }, []);
  const confirm = useCallback((options: ConfirmOptions) => {
    setDialog({ kind: "confirm", ...options });
  }, []);
  const choose = useCallback((options: ChooseOptions) => {
    setDialog({ kind: "choose", ...options });
  }, []);

  const api = useMemo<UiApi>(() => ({ prompt, confirm, choose }), [prompt, confirm, choose]);
  const close = useCallback(() => setDialog(null), []);

  return (
    <UiContext.Provider value={api}>
      {children}
      {dialog?.kind === "prompt" ? (
        <PromptDialog
          title={dialog.title}
          label={dialog.label}
          initialValue={dialog.initialValue}
          placeholder={dialog.placeholder}
          confirmText={dialog.confirmText}
          onCancel={close}
          onSubmit={(value) => {
            close();
            dialog.onSubmit(value);
          }}
        />
      ) : null}
      {dialog?.kind === "confirm" ? (
        <ConfirmDialog
          title={dialog.title}
          message={dialog.message}
          description={dialog.description}
          confirmText={dialog.confirmText}
          danger={dialog.danger}
          onCancel={close}
          onConfirm={() => {
            close();
            dialog.onConfirm();
          }}
        />
      ) : null}
      {dialog?.kind === "choose" ? (
        <Modal
          title={dialog.title}
          width={430}
          onClose={close}
          footer={
            <button type="button" className="btn" onClick={close}>
              取消
            </button>
          }
        >
          <p className="dialog-message">{dialog.message}</p>
          {dialog.description ? <p className="dialog-description">{dialog.description}</p> : null}
          <div className="choice-list">
            {dialog.options.map((option) => (
              <button
                key={option.key}
                type="button"
                className={`choice${option.danger ? " is-danger" : ""}`}
                onClick={() => {
                  close();
                  dialog.onSelect(option.key);
                }}
              >
                <span className="choice-label">{option.label}</span>
                {option.description ? (
                  <span className="choice-description">{option.description}</span>
                ) : null}
              </button>
            ))}
          </div>
        </Modal>
      ) : null}
    </UiContext.Provider>
  );
}

export function useUi(): UiApi {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi 必须在 UiProvider 内使用");
  return ctx;
}
