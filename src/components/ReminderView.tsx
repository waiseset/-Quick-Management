import { useCallback, useEffect, useRef, useState } from "react";

import { checkPaths, revealInExplorer } from "../api";
import { useApp } from "../store";
import type { MissingPath } from "../types";

/**
 * 参考文档「提醒页」：内容区顶部是「检查」按钮，下面是检查结果。
 * 会自动检查所有应用条目的路径是否存在，网址条目跳过。
 */
export function ReminderView() {
  const {
    data,
    sessionIgnored,
    permanentlyIgnored,
    ignoreOnce,
    ignoreForever,
    restoreIgnored,
    showToast,
  } = useApp();
  const [results, setResults] = useState<MissingPath[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [showIgnored, setShowIgnored] = useState(false);
  const itemsRef = useRef(data.items);
  itemsRef.current = data.items;

  const runCheck = useCallback(async () => {
    setChecking(true);
    try {
      const payload = itemsRef.current.map((item) => ({
        id: item.id,
        name: item.name,
        kind: item.kind,
        target: item.target,
      }));
      setResults(await checkPaths(payload));
    } catch (error) {
      showToast(typeof error === "string" ? error : "路径检查失败");
    } finally {
      setChecking(false);
    }
  }, [showToast]);

  // 进入提醒页即自动检查一次
  useEffect(() => {
    void runCheck();
  }, [runCheck]);

  const hidden = new Set([...sessionIgnored, ...permanentlyIgnored]);
  const pending = (results ?? []).filter((entry) => !hidden.has(entry.id));
  const ignoredEntries = data.items.filter((item) => permanentlyIgnored.includes(item.id));

  return (
    <section className="view">
      <div className="view-toolbar">
        <button type="button" className="btn btn-primary" disabled={checking} onClick={() => void runCheck()}>
          {checking ? "检查中…" : "检查"}
        </button>
        {results !== null ? (
          <span className="view-summary">
            共检查 {results.length} 个应用条目，发现 {pending.length} 个路径异常
          </span>
        ) : null}
      </div>

      <div className="view-body">
        {results === null ? (
          <p className="view-placeholder">正在检查…</p>
        ) : pending.length === 0 ? (
          <p className="view-placeholder">
            所有应用条目的路径都存在{ignoredEntries.length ? "（已忽略的条目未计入）" : ""}。
          </p>
        ) : (
          <ul className="missing-list">
            {pending.map((entry) => (
              <li key={entry.id} className="missing-row">
                <div className="missing-info">
                  <span className="missing-name">{entry.name}</span>
                  <span className="missing-path" title={entry.path}>
                    {entry.path || "（路径为空）"}
                  </span>
                </div>
                <div className="missing-actions">
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => void revealInExplorer(entry.path).catch(() => showToast("无法定位该路径"))}
                  >
                    打开所在文件夹
                  </button>
                  <button type="button" className="btn btn-small" onClick={() => ignoreOnce(entry.id)}>
                    本次忽略
                  </button>
                  <button
                    type="button"
                    className="btn btn-small btn-danger-soft"
                    onClick={() => {
                      ignoreForever(entry.id);
                      showToast(`「${entry.name}」已永久忽略`);
                    }}
                  >
                    永久忽略
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {ignoredEntries.length ? (
          <div className="ignored-block">
            <button
              type="button"
              className="ignored-toggle"
              onClick={() => setShowIgnored((value) => !value)}
            >
              {showIgnored ? "▾" : "▸"} 已永久忽略 {ignoredEntries.length} 个条目
            </button>
            {showIgnored ? (
              <ul className="ignored-list">
                {ignoredEntries.map((item) => (
                  <li key={item.id} className="ignored-row">
                    <span className="ignored-name">{item.name}</span>
                    <button
                      type="button"
                      className="btn btn-small"
                      onClick={() => {
                        restoreIgnored(item.id);
                        void runCheck();
                      }}
                    >
                      恢复检查
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
