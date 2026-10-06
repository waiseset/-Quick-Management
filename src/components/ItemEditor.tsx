import { useState } from "react";

import { chooseExecutable, chooseFile, chooseImage, fetchFavicon, openItem, pickIconFromPath, resolveTarget, revealInExplorer } from "../api";
import { useApp } from "../store";
import type { IconData, Item, ItemKind } from "../types";
import { baseName, cx, fileName, hostOf, iconSrc, sortByOrder } from "../util";
import { Modal } from "./Modal";

export interface ItemDraft {
  kind: ItemKind;
  name: string;
  description: string;
  target: string;
  categoryIds: string[];
  subcategoryIds: string[];
  favorite: boolean;
  icon: IconData | null;
}

export function ItemEditor({
  item,
  defaultKind = "app",
  defaultCategoryIds = [],
  defaultSubCategoryIds = [],
  onClose,
  onSubmit,
}: {
  item: Item | null;
  defaultKind?: ItemKind;
  defaultCategoryIds?: string[];
  defaultSubCategoryIds?: string[];
  onClose: () => void;
  onSubmit: (draft: ItemDraft) => void;
}) {
  const { categories, showToast } = useApp();
  const [kind, setKind] = useState<ItemKind>(item?.kind ?? defaultKind);
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [target, setTarget] = useState(item?.target ?? "");
  const [categoryIds, setCategoryIds] = useState<string[]>(
    item?.categoryIds ?? defaultCategoryIds,
  );
  const [subcategoryIds, setSubcategoryIds] = useState<string[]>(
    item?.subcategoryIds ?? defaultSubCategoryIds,
  );
  const [favorite, setFavorite] = useState(item?.favorite ?? false);
  const [icon, setIcon] = useState<IconData | null>(item?.icon ?? null);
  const [busy, setBusy] = useState<"icon" | "favicon" | null>(null);

  // 二级分类列出所有已选分类下的子分类
  const subs = sortByOrder(
    categories
      .filter((entry) => categoryIds.includes(entry.id))
      .flatMap((entry) => entry.subcategories),
  );

  const report = (error: unknown) =>
    showToast(typeof error === "string" ? error : "操作失败，请稍后重试");

  /** 提取系统图标（exe / lnk / 任意文件） */
  const extractIcon = async (path: string) => {
    if (!path.trim()) return;
    setBusy("icon");
    try {
      setIcon(await pickIconFromPath(path));
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
    }
  };

  /** 抓取网页 favicon */
  const grabFavicon = async () => {
    if (!target.trim()) {
      showToast("请先填写网址");
      return;
    }
    setBusy("favicon");
    try {
      setIcon(await fetchFavicon(target.trim()));
      if (!name.trim()) setName(hostOf(target.trim()));
    } catch (error) {
      report(error);
    } finally {
      setBusy(null);
    }
  };

  /** 选择路径：应用 / 文件用不同对话框；选到快捷方式时自动定位到它指向的真实文件 */
  const browseTarget = async () => {
    const picked = kind === "file" ? await chooseFile() : await chooseExecutable();
    if (!picked) return;
    const resolved = (await resolveTarget(picked)) ?? picked;
    setTarget(resolved);
    if (!name.trim()) setName(kind === "file" ? fileName(resolved) : baseName(resolved));
    await extractIcon(resolved);
  };

  const browseImage = async () => {
    const picked = await chooseImage();
    if (!picked) return;
    await extractIcon(picked);
  };

  const switchKind = (next: ItemKind) => {
    setKind(next);
    setIcon(null);
  };

  const submit = () => {
    const trimmed = target.trim();
    onSubmit({
      kind,
      name: name.trim() || (kind === "app" ? baseName(trimmed) : hostOf(trimmed)),
      description: description.trim(),
      target: trimmed,
      categoryIds,
      subcategoryIds,
      favorite,
      icon,
    });
  };

  return (
    <Modal
      title={item ? "编辑条目" : "添加条目"}
      width={520}
      onClose={onClose}
      footer={
        <>
          {item ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void openItem(item.kind, item.target).catch(report)}
            >
              打开
            </button>
          ) : null}
          {item && item.kind === "app" ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void revealInExplorer(item.target).catch(report)}
            >
              打开所在文件夹
            </button>
          ) : null}
          <div className="modal-foot-spacer" />
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-primary" disabled={!target.trim()} onClick={submit}>
            保存
          </button>
        </>
      }
    >
      <div className="segmented">
        <button
          type="button"
          className={cx("segment", kind === "app" && "is-active")}
          onClick={() => switchKind("app")}
        >
          应用
        </button>
        <button
          type="button"
          className={cx("segment", kind === "file" && "is-active")}
          onClick={() => switchKind("file")}
        >
          文件
        </button>
        <button
          type="button"
          className={cx("segment", kind === "url" && "is-active")}
          onClick={() => switchKind("url")}
        >
          网址
        </button>
      </div>

      <label className="field">
        <span className="field-label">名称</span>
        <input
          className="input"
          value={name}
          placeholder={
            kind === "app"
              ? "例如：Visual Studio Code"
              : kind === "file"
                ? "例如：季度报告.pdf"
                : "例如：MDN"
          }
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">
          {kind === "app" ? "路径" : kind === "file" ? "文件路径" : "网址"}
        </span>
        <div className="input-row">
          <input
            className="input"
            value={target}
            placeholder={
              kind === "app"
                ? "C:\\Program Files\\App\\App.exe"
                : kind === "file"
                  ? "C:\\Users\\你\\Documents\\报告.pdf"
                  : "https://example.com"
            }
            onChange={(event) => setTarget(event.target.value)}
            onBlur={() => {
              if (kind === "url" && target.trim() && !icon) void grabFavicon();
            }}
          />
          {kind === "url" ? null : (
            <button type="button" className="btn btn-small" onClick={() => void browseTarget()}>
              浏览…
            </button>
          )}
        </div>
      </label>

      <label className="field">
        <span className="field-label">描述</span>
        <textarea
          className="input textarea"
          rows={3}
          value={description}
          placeholder="单击条目时会显示这段描述"
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      <div className="field">
        <span className="field-label">图标</span>
        <div className="icon-row">
          <div className="icon-preview">
            {icon ? (
              <img src={iconSrc(icon) ?? ""} alt="" />
            ) : (
              <span className="icon-preview-empty">{kind === "app" ? "无图标" : "无图标"}</span>
            )}
          </div>
          <div className="icon-actions">
            <button type="button" className="btn btn-small" onClick={() => void browseImage()}>
              选择图片
            </button>
            {kind === "url" ? (
              <button
                type="button"
                className="btn btn-small"
                disabled={!target.trim() || busy === "favicon"}
                onClick={() => void grabFavicon()}
              >
                {busy === "favicon" ? "抓取中…" : "抓取网站图标"}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-small"
                disabled={!target.trim() || busy === "icon"}
                onClick={() => void extractIcon(target.trim())}
              >
                {busy === "icon" ? "提取中…" : "提取图标"}
              </button>
            )}
            {icon ? (
              <button type="button" className="btn btn-small" onClick={() => setIcon(null)}>
                清除
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <span className="field-label">分类（可多选）</span>
          <div className="chip-picker">
            {categories.length === 0 ? (
              <span className="field-hint">还没有分类，请先在左侧新建</span>
            ) : (
              categories.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={cx("chip", categoryIds.includes(entry.id) && "is-active")}
                  onClick={() =>
                    setCategoryIds((list) =>
                      list.includes(entry.id)
                        ? list.filter((id) => id !== entry.id)
                        : [...list, entry.id],
                    )
                  }
                >
                  {entry.name}
                </button>
              ))
            )}
          </div>
        </div>
        <div className="field">
          <span className="field-label">二级分类（可多选）</span>
          <div className="chip-picker">
            {subs.length === 0 ? (
              <span className="field-hint">
                {categoryIds.length === 0 ? "先选一个分类" : "所选分类下还没有二级分类"}
              </span>
            ) : (
              subs.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  className={cx("chip", subcategoryIds.includes(sub.id) && "is-active")}
                  onClick={() =>
                    setSubcategoryIds((list) =>
                      list.includes(sub.id)
                        ? list.filter((id) => id !== sub.id)
                        : [...list, sub.id],
                    )
                  }
                >
                  {sub.name}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        className={cx("fav-toggle", favorite && "is-on")}
        onClick={() => setFavorite((value) => !value)}
      >
        <span className="fav-toggle-star">★</span>
        {favorite ? "已收藏" : "加入收藏夹"}
      </button>
    </Modal>
  );
}

/** 右键菜单里的「更改图标」 */
export function IconPickerDialog({
  item,
  onClose,
  onChange,
}: {
  item: Item;
  onClose: () => void;
  onChange: (icon: IconData | null) => void;
}) {
  const { showToast } = useApp();
  const [busy, setBusy] = useState(false);

  const report = (error: unknown) =>
    showToast(typeof error === "string" ? error : "操作失败，请稍后重试");

  const run = async (task: () => Promise<IconData | null>) => {
    setBusy(true);
    try {
      onChange(await task());
      onClose();
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="更改图标"
      width={400}
      onClose={onClose}
      footer={
        <button type="button" className="btn" onClick={onClose}>
          取消
        </button>
      }
    >
      <p className="dialog-message">当前条目：{item.name}</p>
      <div className="choice-list">
        <button
          type="button"
          className="choice"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const picked = await chooseImage();
              if (!picked) return item.icon;
              return await pickIconFromPath(picked);
            })
          }
        >
          <span className="choice-label">从本地图片选择</span>
          <span className="choice-description">支持 png / jpg / gif / bmp / webp / ico</span>
        </button>

        <button
          type="button"
          className="choice"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const picked = await chooseExecutable();
              if (!picked) return item.icon;
              return await pickIconFromPath(picked);
            })
          }
        >
          <span className="choice-label">从文件提取系统图标</span>
          <span className="choice-description">exe、快捷方式等会取用 Windows 系统图标</span>
        </button>

        {item.kind === "url" ? (
          <button
            type="button"
            className="choice"
            disabled={busy}
            onClick={() => void run(async () => await fetchFavicon(item.target))}
          >
            <span className="choice-label">重新抓取网站图标</span>
            <span className="choice-description">{item.target}</span>
          </button>
        ) : null}

        <button
          type="button"
          className="choice is-danger"
          disabled={busy}
          onClick={() => {
            onChange(null);
            onClose();
          }}
        >
          <span className="choice-label">清除图标</span>
          <span className="choice-description">使用默认占位图标</span>
        </button>
      </div>
    </Modal>
  );
}
