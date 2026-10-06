import { useEffect, useState } from "react";

import { chooseExportPath, chooseImportPath, dataLocation, exportData, importData, pickIconFromPath } from "../api";
import { useApp } from "../store";
import type { AppData, DataLocation } from "../types";
import { ConfirmDialog } from "./Modal";

/**
 * 数据管理页（原「备份与恢复」）：备份 -> 导出、恢复 -> 导入、清空 -> 删除全部数据。
 * 导出与导入都会自动弹出系统文件对话框。
 */
export function DataView() {
  const { data, replaceAll, clearData, updateItem, showToast } = useApp();
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [pendingImport, setPendingImport] = useState<AppData | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [location, setLocation] = useState<DataLocation | null>(null);

  useEffect(() => {
    void dataLocation()
      .then(setLocation)
      .catch(() => undefined);
  }, []);

  const subCount = data.categories.reduce(
    (sum, category) => sum + category.subcategories.length,
    0,
  );
  const icons = data.items.filter((item) => item.icon).length;
  const favorites = data.items.filter((item) => item.favorite).length;

  const report = (error: unknown) =>
    showToast(typeof error === "string" ? error : "操作失败，请稍后重试");

  const runExport = async () => {
    try {
      const path = await chooseExportPath();
      if (!path) return;
      setBusy("export");
      await exportData(path, data);
      showToast("已导出全部数据");
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
    }
  };

  const runImport = async () => {
    try {
      const path = await chooseImportPath();
      if (!path) return;
      setBusy("import");
      const imported = await importData(path);
      setPendingImport(imported);
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
    }
  };

  /** 重新为所有应用条目提取系统图标（图标过小或过旧时用来一次性刷新） */
  const refreshIcons = async () => {
    const targets = data.items.filter((item) => item.kind === "app" && item.target.trim());
    if (!targets.length) {
      showToast("没有可处理的「应用」条目");
      return;
    }
    setRefreshing(true);
    let done = 0;
    let failed = 0;
    for (const item of targets) {
      try {
        const icon = await pickIconFromPath(item.target);
        updateItem(item.id, { icon });
        done += 1;
      } catch {
        failed += 1;
      }
    }
    setRefreshing(false);
    showToast(failed ? `已更新 ${done} 个图标，${failed} 个提取失败` : `已更新 ${done} 个图标`);
  };

  return (
    <section className="view">
      <div className="view-body">
        <div className="panel">
          <h2 className="panel-title">备份</h2>
          <p className="panel-text">
            把列表、分类结构、排序、图标、名称、描述、路径 / 网址、收藏与忽略状态、主题一起导出成一个
            JSON 文件。
          </p>
          <p className="panel-meta">
            当前共 {data.categories.length} 个分类、{subCount} 个子分类、{data.items.length} 个条目（
            {favorites} 个收藏、{icons} 个自定义图标）。
          </p>
          {location ? (
            <p className="panel-meta">
              数据位置：{location.path}
              {location.portable ? "（便携模式：保存在程序目录旁）" : ""}
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy !== null}
            onClick={() => void runExport()}
          >
            {busy === "export" ? "导出中…" : "导出"}
          </button>
        </div>

        <div className="panel">
          <h2 className="panel-title">恢复</h2>
          <p className="panel-text">
            从之前导出的 JSON 文件恢复全部数据。导入会覆盖当前所有内容，建议先导出一份备份。
          </p>
          <button
            type="button"
            className="btn"
            disabled={busy !== null}
            onClick={() => void runImport()}
          >
            {busy === "import" ? "读取中…" : "导入"}
          </button>
        </div>

        <div className="panel">
          <h2 className="panel-title">维护</h2>
          <p className="panel-text">
            重新为所有「应用」条目提取一次系统图标。如果某条目的图标显示得过小、或者想套用新的图标提取规则，
            可以在这里一次性刷新，不必逐个右键更换。
          </p>
          <button
            type="button"
            className="btn"
            disabled={refreshing}
            onClick={() => void refreshIcons()}
          >
            {refreshing ? "提取中…" : "重新提取全部图标"}
          </button>
        </div>

        <div className="panel panel-danger">
          <h2 className="panel-title">清空</h2>
          <p className="panel-text">
            删除当前的全部数据：{data.categories.length} 个分类、{subCount} 个子分类、
            {data.items.length} 个条目，以及路径检查里的忽略记录。主题等偏好会保留。
            删除后无法恢复，建议先导出一份备份。
          </p>
          <button
            type="button"
            className="btn btn-danger-soft"
            disabled={busy !== null}
            onClick={() => setConfirmClear(true)}
          >
            清空所有数据
          </button>
        </div>
      </div>

      {pendingImport ? (
        <ConfirmDialog
          title="导入数据"
          message="导入会覆盖当前全部数据，确定继续吗？"
          description={`即将导入：${pendingImport.categories.length} 个分类、${pendingImport.items.length} 个条目。`}
          confirmText="覆盖导入"
          danger
          onCancel={() => setPendingImport(null)}
          onConfirm={() => {
            replaceAll(pendingImport);
            setPendingImport(null);
            showToast("导入完成");
          }}
        />
      ) : null}

      {confirmClear ? (
        <ConfirmDialog
          title="清空所有数据"
          message="确定要清空所有数据吗？"
          description={`将删除 ${data.categories.length} 个分类、${subCount} 个子分类和 ${data.items.length} 个条目，且无法恢复。`}
          confirmText="清空"
          danger
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            clearData();
            setConfirmClear(false);
            showToast("已清空所有数据");
          }}
        />
      ) : null}
    </section>
  );
}
