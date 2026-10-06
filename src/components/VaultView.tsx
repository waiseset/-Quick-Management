import { useState } from "react";

import { hashPassword, makeSalt } from "../api";
import { useDragList } from "../drag";
import { useApp } from "../store";
import type { VaultKind } from "../types";
import { useContextMenu } from "./ContextMenu";
import { ItemCard, useItemClipboard } from "./ItemCard";
import { NumberPad } from "./NumberPad";
import { PatternLock } from "./PatternLock";

const KINDS: Array<{ key: VaultKind; label: string; hint: string }> = [
  { key: "pattern", label: "图案密码", hint: "在九宫格上依次连点，至少 4 个点" },
  { key: "pin", label: "数字密码", hint: "至少 4 位数字" },
  { key: "mixed", label: "混合密码", hint: "字母与数字混合，至少 6 位" },
];

const LABEL: Record<VaultKind, string> = {
  pattern: "图案密码",
  pin: "数字密码",
  mixed: "混合密码",
};

/**
 * 「隐藏的元素」：第一次进入时设置密码（图案 / 数字 / 混合），之后每次进入都要解锁。
 * 密码只保存哈希与盐，忘记无法找回。
 * 解锁后的网格与主视图共用 ItemCard，单击 / 多选 / 右键菜单 / 快捷键因此完全一致。
 */
export function VaultView() {
  const { data, vaultUnlocked, setVaultUnlocked, setVault, showToast } = useApp();
  const vault = data.settings.vault;

  const [pickedKind, setPickedKind] = useState<VaultKind | null>(null);
  const [firstInput, setFirstInput] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 换一个值就让数字键盘重建（输入错误后自动清空）
  const [attempt, setAttempt] = useState(0);

  const isPattern = (vault?.kind ?? pickedKind) === "pattern";

  /** 按密码类型给出对应的输入控件 */
  const inputArea = (kind: VaultKind, onSubmit: (value: string) => void) => {
    if (kind === "pattern") return <PatternLock onComplete={onSubmit} />;
    if (kind === "pin") return <NumberPad key={attempt} onSubmit={onSubmit} />;
    return inputForm(onSubmit);
  };

  /** 设置密码：第一次输入先记下，第二次确认一致才保存 */
  const submitSetup = async (value: string) => {
    if (!pickedKind) return;
    if (!firstInput) {
      setFirstInput(value);
      setText("");
      setError(null);
      return;
    }
    if (firstInput !== value) {
      setFirstInput(null);
      setText("");
      setAttempt((current) => current + 1);
      setError("两次输入不一致，请重新设置");
      return;
    }
    setBusy(true);
    try {
      const salt = await makeSalt();
      const hash = await hashPassword(value, salt);
      setVault({ kind: pickedKind, hash, salt });
      setVaultUnlocked(true);
      showToast("密码已设置");
    } finally {
      setBusy(false);
    }
  };

  const tryUnlock = async (value: string) => {
    if (!vault) return;
    setBusy(true);
    try {
      const hash = await hashPassword(value, vault.salt);
      if (hash === vault.hash) {
        setVaultUnlocked(true);
        setError(null);
      } else {
        setError("密码不正确");
        setAttempt((current) => current + 1);
      }
      setText("");
    } finally {
      setBusy(false);
    }
  };

  const inputForm = (onSubmit: (value: string) => void) => (
    <div className="input-row">
      <input
        className="input"
        type={isPattern ? "text" : "password"}
        value={text}
        placeholder={isPattern ? "图案密码由九宫格输入" : "请输入密码"}
        autoFocus
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && text.trim()) onSubmit(text.trim());
        }}
      />
      <button
        type="button"
        className="btn btn-primary"
        disabled={!text.trim() || busy}
        onClick={() => onSubmit(text.trim())}
      >
        确定
      </button>
    </div>
  );

  /* 1) 还没设置过：先选密码类型 */
  if (!vault && !pickedKind) {
    return (
      <section className="view">
        <div className="view-body is-center">
          <div className="panel">
            <h2 className="panel-title">第一次进入「隐藏的元素」</h2>
            <p className="panel-text">
              先选一种密码类型。密码只保存哈希与随机盐，不保存明文，忘记后无法找回。
            </p>
            <div className="choice-list">
              {KINDS.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  className="choice"
                  onClick={() => setPickedKind(entry.key)}
                >
                  <span className="choice-label">{entry.label}</span>
                  <span className="choice-description">{entry.hint}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  /* 2) 设置密码中 */
  if (!vault && pickedKind) {
    return (
      <section className="view">
        <div className="view-body is-center">
          <div className="panel">
            <h2 className="panel-title">
              {firstInput ? "再输入一次确认" : `设置${LABEL[pickedKind]}`}
            </h2>
            {inputArea(pickedKind, (value) => void submitSetup(value))}
            {error ? <p className="field-error">{error}</p> : null}
          </div>
        </div>
      </section>
    );
  }

  /* 3) 解锁 */
  if (!vaultUnlocked) {
    return (
      <section className="view">
        <div className="view-body is-center">
          <div className="panel">
            <h2 className="panel-title">输入{LABEL[vault?.kind ?? "pin"]}</h2>
            {inputArea(vault?.kind ?? "pin", (value) => void tryUnlock(value))}
            {error ? <p className="field-error">{error}</p> : null}
            <p className="field-hint">
              忘记密码无法找回，只能删除数据文件重新开始（会一并清空其它数据）。
            </p>
          </div>
        </div>
      </section>
    );
  }

  /* 4) 已解锁：隐藏条目网格 */
  return <VaultItems />;
}

/**
 * 解锁后的隐藏条目：网格与主视图共用 ItemCard，
 * 只有「粘贴」落到隐藏区（副本仍是隐藏状态）。
 */
function VaultItems() {
  const { visibleItems, clipboard, selectItem, reorderItems, setVaultUnlocked } = useApp();
  const { open } = useContextMenu();
  const { paste } = useItemClipboard(true);

  const ids = visibleItems.map((item) => item.id);
  const drag = useDragList(ids, reorderItems);

  return (
    <section className="view">
      <div className="view-toolbar">
        <span className="view-summary">隐藏的元素：{visibleItems.length} 个</span>
        <button type="button" className="btn btn-small" onClick={() => setVaultUnlocked(false)}>
          锁定
        </button>
      </div>
      <div
        className="item-grid"
        onClick={(event) => {
          if (event.target === event.currentTarget) selectItem(null);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          open({
            x: event.clientX,
            y: event.clientY,
            items: [
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
          <ItemCard key={item.id} item={item} drag={drag} inVault />
        ))}

        {visibleItems.length === 0 ? (
          <div className="item-empty">
            <p>还没有隐藏的条目</p>
            <p className="item-empty-hint">在条目上右键选择「隐藏」即可放进这里</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
