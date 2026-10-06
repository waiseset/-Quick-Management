//! 暴露给前端的命令。耗时操作（网络、COM、文件系统）都丢到阻塞线程池，避免卡住 UI。

use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::model::{AppData, IconData, ItemKind};
use crate::{favicon, shortcut, storage, winapi};

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
        // 应用与文件都用系统默认程序打开
        ItemKind::App | ItemKind::File => target,
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

/// 检查所有带本地路径的条目（应用与文件；网址跳过）
#[tauri::command]
pub async fn check_paths(items: Vec<ItemCheck>) -> Vec<MissingPath> {
    tauri::async_runtime::spawn_blocking(move || {
        items
            .into_iter()
            .filter(|item| item.kind != ItemKind::Url)
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

/// 解析快捷方式：.lnk 返回它指向的路径，.url 返回其中的网址，其它文件返回 null
#[tauri::command]
pub async fn resolve_target(path: String) -> Option<String> {
    tauri::async_runtime::spawn_blocking(move || shortcut::resolve_launch_target(&path))
        .await
        .ok()
        .flatten()
}

/// 隐藏区密码哈希：SHA-256(salt + 密码 + 固定后缀)，只把结果存进数据文件
#[tauri::command]
pub fn hash_password(password: String, salt: String) -> String {
    use sha2::{Digest, Sha256};

    let mut hasher = Sha256::new();
    hasher.update(salt.as_bytes());
    hasher.update(password.as_bytes());
    hasher.update(b"quick-manage-vault-v1");
    format!("{:x}", hasher.finalize())
}

/// 生成一个随机盐（16 字节的十六进制）
#[tauri::command]
pub fn make_salt() -> String {
    use sha2::{Digest, Sha256};
    use std::time::{SystemTime, UNIX_EPOCH};

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(now.as_nanos().to_le_bytes());
    hasher.update(std::process::id().to_le_bytes());
    hasher.update(
        std::thread::current()
            .name()
            .unwrap_or("vault")
            .as_bytes(),
    );
    format!("{:x}", hasher.finalize())[..32].to_string()
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
