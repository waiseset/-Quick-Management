//! 暴露给前端的命令。耗时操作（网络、COM、文件系统）都丢到阻塞线程池，避免卡住 UI。

use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::model::{AppData, IconData, ItemKind};
use crate::{favicon, storage, winapi};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemCheck {
    pub id: String,
    pub name: String,
    pub kind: ItemKind,
    pub target: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingPath {
    pub id: String,
    pub name: String,
    pub path: String,
}

#[tauri::command]
pub fn load_data(app: AppHandle) -> Result<AppData, String> {
    storage::load(&app)
}

#[tauri::command]
pub fn save_data(app: AppHandle, data: AppData) -> Result<(), String> {
    storage::save(&app, &data)
}

/// 打开条目：应用用 ShellExecuteW 打开路径，网址用默认浏览器打开
#[tauri::command]
pub async fn open_item(kind: ItemKind, target: String) -> Result<(), String> {
    if target.trim().is_empty() {
        return Err("路径或网址为空".into());
    }
    let target = match kind {
        ItemKind::Url => normalize_url(&target),
        ItemKind::App => target,
    };
    tauri::async_runtime::spawn_blocking(move || winapi::shell_open(&target))
        .await
        .map_err(|e| e.to_string())?
}

fn normalize_url(target: &str) -> String {
    let t = target.trim();
    if t.contains("://") {
        t.to_string()
    } else {
        format!("https://{t}")
    }
}

/// 打开条目所在文件夹（资源管理器选中该文件）
#[tauri::command]
pub async fn reveal_in_explorer(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || winapi::reveal_in_explorer(&path))
        .await
        .map_err(|e| e.to_string())?
}

/// 从本地文件取图标：图片直接读，exe/lnk 等提取系统图标
#[tauri::command]
pub async fn pick_icon_from_path(path: String) -> Result<IconData, String> {
    tauri::async_runtime::spawn_blocking(move || winapi::icon_from_path(&path))
        .await
        .map_err(|e| e.to_string())?
}

/// 按网址抓取 favicon
#[tauri::command]
pub async fn fetch_favicon_icon(url: String) -> Result<IconData, String> {
    tauri::async_runtime::spawn_blocking(move || favicon::fetch(&url))
        .await
        .map_err(|e| e.to_string())?
}

/// 检查所有「应用」条目的路径是否存在（网址条目不检查）
#[tauri::command]
pub async fn check_paths(items: Vec<ItemCheck>) -> Vec<MissingPath> {
    tauri::async_runtime::spawn_blocking(move || {
        items
            .into_iter()
            .filter(|item| item.kind == ItemKind::App)
            .filter(|item| {
                let target = item.target.trim();
                target.is_empty() || !Path::new(target).exists()
            })
            .map(|item| MissingPath {
                id: item.id,
                name: item.name,
                path: item.target,
            })
            .collect()
    })
    .await
    .unwrap_or_default()
}

#[tauri::command]
pub async fn export_data(path: String, data: AppData) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || storage::export_to(&path, &data))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn import_data(path: String) -> Result<AppData, String> {
    tauri::async_runtime::spawn_blocking(move || storage::import_from(&path))
        .await
        .map_err(|e| e.to_string())?
}

/// 当前数据文件位置（便携版在 exe 旁，安装版在 %APPDATA%）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataLocation {
    pub path: String,
    pub portable: bool,
}

#[tauri::command]
pub fn data_location(app: AppHandle) -> Result<DataLocation, String> {
    let (path, portable) = storage::data_location(&app)?;
    Ok(DataLocation { path, portable })
}
