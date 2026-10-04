//! 本地 JSON 存储：写入走「临时文件 + 重命名」，避免中途崩溃导致数据损坏。

use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager};

use crate::model::{AppData, DATA_VERSION};

/// 时间戳（毫秒）
pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// 便携模式：exe 同目录下放一个 portable.txt 时，数据写在程序旁边的 data\ 里，不碰 %APPDATA%
fn portable_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    if dir.join("portable.txt").is_file() {
        return Some(dir.join("data"));
    }
    None
}

/// 数据文件：便携版在 exe 旁边，安装版在 %APPDATA%\com.waiseset.quickmanage\data.json
pub fn data_file(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = match portable_dir() {
        Some(dir) => dir,
        None => app
            .path()
            .app_data_dir()
            .map_err(|e| format!("无法定位应用数据目录: {e}"))?,
    };
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建应用数据目录: {e}"))?;
    Ok(dir.join("data.json"))
}

/// 供界面显示：数据文件位置，以及是否处于便携模式
pub fn data_location(app: &AppHandle) -> Result<(String, bool), String> {
    let portable = portable_dir().is_some();
    let path = data_file(app)?;
    Ok((path.to_string_lossy().to_string(), portable))
}

pub fn load(app: &AppHandle) -> Result<AppData, String> {
    let path = data_file(app)?;
    if !path.exists() {
        return Ok(AppData::default());
    }
    let text = fs::read_to_string(&path).map_err(|e| format!("读取数据文件失败: {e}"))?;
    if text.trim().is_empty() {
        return Ok(AppData::default());
    }
    match serde_json::from_str::<AppData>(&text) {
        Ok(mut data) => {
            data.version = DATA_VERSION;
            Ok(data)
        }
        Err(err) => {
            // 解析失败时先把原文件留档，避免直接覆盖用户数据
            let backup = path.with_file_name(format!("data.corrupt-{}.json", now_ms()));
            let _ = fs::write(&backup, &text);
            Err(format!(
                "数据文件格式异常，已备份为 {}：{err}",
                backup.display()
            ))
        }
    }
}

pub fn save(app: &AppHandle, data: &AppData) -> Result<(), String> {
    let path = data_file(app)?;
    let text = serde_json::to_string_pretty(data).map_err(|e| format!("序列化数据失败: {e}"))?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, text).map_err(|e| format!("写入数据失败: {e}"))?;
    // Windows 上 rename 不能覆盖已存在的目标文件
    if path.exists() {
        let _ = fs::remove_file(&path);
    }
    fs::rename(&tmp, &path).map_err(|e| format!("保存数据失败: {e}"))?;
    Ok(())
}

/// 导出到用户选定路径
pub fn export_to(path: &str, data: &AppData) -> Result<(), String> {
    let text = serde_json::to_string_pretty(data).map_err(|e| format!("序列化数据失败: {e}"))?;
    fs::write(path, text).map_err(|e| format!("写入导出文件失败: {e}"))
}

/// 从用户选定路径导入
pub fn import_from(path: &str) -> Result<AppData, String> {
    let text = fs::read_to_string(path).map_err(|e| format!("读取导入文件失败: {e}"))?;
    let mut data: AppData =
        serde_json::from_str(&text).map_err(|e| format!("导入文件不是有效的数据文件: {e}"))?;
    data.version = DATA_VERSION;
    Ok(data)
}
