import { useState } from "react";

import { chooseExecutable, chooseImage, fetchFavicon, openItem, pickIconFromPath, revealInExplorer } from "../api";
import { useApp } from "../store";
import type { IconData, Item, ItemKind } from "../types";
import { baseName, cx, hostOf, iconSrc, sortByOrder } from "../util";
import { Modal } from "./Modal";

export interface ItemDraft {
  kind: ItemKind;
  name: string;
  description: string;
  target: string;
  categoryId: string | null;
  subcategoryId: string | null;
  favorite: boolean;
  icon: IconData | null;
}

export function ItemEditor({
  item,
  defaultKind = "app",
  defaultCategoryId = null,
  defaultSubCategoryId = null,
  onClose,
  onSubmit,
}: {
  item: Item | null;
  defaultKind?: ItemKind;
  defaultCategoryId?: string | null;
  defaultSubCategoryId?: string | null;
  onClose: () => void;
  onSubmit: (draft: ItemDraft) => void;
}) {
  const { categories, showToast } = useApp();
  const [kind, setKind] = useState<ItemKind>(item?.kind ?? defaultKind);
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [target, setTarget] = useState(item?.target ?? "");
  const [categoryId, setCategoryId] = useState<string>(item?.categoryId ?? defaultCategoryId ?? "");
  const [subcategoryId, setSubcategoryId] = useState<string>(
    item?.subcategoryId ?? defaultSubCategoryId ?? "",
  );
  const [favorite, setFavorite] = useState(item?.favorite ?? false);
  const [icon, setIcon] = useState<IconData | null>(item?.icon ?? null);
  const [busy, setBusy] = useState<"icon" | "favicon" | null>(null);

  const category = categories.find((entry) => entry.id === categoryId) ?? null;
  const subs = category ? sortByOrder(category.subcategories) : [];

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

  /** 选择应用：自动填名称并提取图标 */
  const browseApplication = async () => {
    const picked = await chooseExecutable();
    if (!picked) return;
    setTarget(picked);
    if (!name.trim()) setName(baseName(picked));
    await extractIcon(picked);
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
      categoryId: categoryId || null,
      subcategoryId: subcategoryId || null,
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
          placeholder={kind === "app" ? "例如：Visual Studio Code" : "例如：MDN"}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">{kind === "app" ? "路径" : "网址"}</span>
        <div className="input-row">
          <input
            className="input"
            value={target}
            placeholder={kind === "app" ? "C:\\Program Files\\App\\App.exe" : "https://example.com"}
            onChange={(event) => setTarget(event.target.value)}
            onBlur={() => {
              if (kind === "url" && target.trim() && !icon) void grabFavicon();
            }}
          />
          {kind === "app" ? (
            <button type="button" className="btn btn-small" onClick={() => void browseApplication()}>
              浏览…
            </button>
          ) : null}
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
            {kind === "app" ? (
              <button
                type="button"
                className="btn btn-small"
                disabled={!target.trim() || busy === "icon"}
                onClick={() => void extractIcon(target.trim())}
              >
                {busy === "icon" ? "提取中…" : "提取图标"}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-small"
                disabled={!target.trim() || busy === "favicon"}
                onClick={() => void grabFavicon()}
              >
                {busy === "favicon" ? "抓取中…" : "抓取 favicon"}
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
        <label className="field">
          <span className="field-label">分类</span>
          <select
            className="input"
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setSubcategoryId("");
            }}
          >
            <option value="">未分类</option>
            {categories.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">子分类</span>
          <select
            className="input"
            value={subcategoryId}
            disabled={!category}
            onChange={(event) => setSubcategoryId(event.target.value)}
          >
            <option value="">无</option>
            {subs.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </label>
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
