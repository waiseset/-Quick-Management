//! 快捷方式解析：把 .lnk / .url 还原成它们真正指向的目标。
//! 添加条目或拖入文件时用它，避免把「快捷方式」当成目标本身（那样图标也会取错）。

use std::path::Path;

use windows::core::{Interface, HSTRING};
use windows::Win32::Foundation::MAX_PATH;
use windows::Win32::Storage::FileSystem::WIN32_FIND_DATAW;
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, IPersistFile, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED,
    STGM_READ,
};
use windows::Win32::UI::Shell::{IShellLinkW, ShellLink};

/// 拖入的条目：原始路径 + 解析后的目标 + 类型 + 建议名称
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DroppedEntry {
    pub path: String,
    pub target: String,
    /// "app" 或 "url"
    pub kind: String,
    pub name: String,
}

/// .lnk -> 它指向的路径；.url -> 里面的网址；其它文件返回 None
pub fn resolve_launch_target(path: &str) -> Option<String> {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".lnk") {
        resolve_lnk(path)
    } else if lower.ends_with(".url") {
        resolve_url_file(path)
    } else {
        None
    }
}

/// 读取 Internet 快捷方式（.url 是 INI 文本，可能有 BOM 或 ANSI 编码）
fn resolve_url_file(path: &str) -> Option<String> {
    let bytes = std::fs::read(path).ok()?;
    let text = String::from_utf8_lossy(&bytes);
    for line in text.lines() {
        let line = line.trim().trim_start_matches('\u{feff}');
        if line.len() >= 4 && line[..4].eq_ignore_ascii_case("url=") {
            let url = line[4..].trim();
            if !url.is_empty() {
                return Some(url.to_string());
            }
        }
    }
    None
}

/// 用 COM 的 IShellLink 读出 .lnk 的目标路径
fn resolve_lnk(path: &str) -> Option<String> {
    unsafe {
        // 线程可能尚未初始化 COM，重复初始化会返回 S_FALSE，忽略即可
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

        let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).ok()?;
        let persist: IPersistFile = link.cast().ok()?;
        persist.Load(&HSTRING::from(path), STGM_READ).ok()?;

        let mut buffer = [0u16; MAX_PATH as usize];
        let mut find_data = WIN32_FIND_DATAW::default();
        // SLGP_RAWPATH = 1，拿到未展开环境变量的原始路径
        link.GetPath(&mut buffer, &mut find_data, 1).ok()?;

        let end = buffer.iter().position(|&c| c == 0).unwrap_or(0);
        if end == 0 {
            return None;
        }
        Some(String::from_utf16_lossy(&buffer[..end]))
    }
}

/// 把一个待添加的文件整理成条目信息：快捷方式解析成目标，.url 变成网址
pub fn describe_dropped(path: &str) -> DroppedEntry {
    const APP_EXTS: [&str; 4] = [".exe", ".lnk", ".bat", ".cmd"];

    let original = path.to_string();
    let resolved = resolve_launch_target(path);
    let lower = path.to_ascii_lowercase();
    let is_url_file = lower.ends_with(".url");

    let target = resolved.clone().unwrap_or_else(|| path.to_string());
    let kind = if is_url_file {
        "url"
    } else if resolved.is_some() || APP_EXTS.iter().any(|ext| lower.ends_with(ext)) {
        "app"
    } else {
        // 其它文件按「文件」处理，双击时用系统默认程序打开
        "file"
    }
    .to_string();
    let name = if is_url_file {
        // 网址条目用域名作名字更直观
        host_of(&target).unwrap_or_else(|| file_stem(path))
    } else {
        // 拖的是快捷方式时，用快捷方式自己的名字（而不是它指向的源文件名）
        file_stem(path)
    };

    DroppedEntry {
        path: original,
        target,
        kind,
        name,
    }
}

fn file_stem(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| path.to_string())
}

fn host_of(url: &str) -> Option<String> {
    let rest = url.split("://").nth(1)?;
    let host = rest.split(['/', '?', '#']).next()?;
    let host = host.trim_start_matches("www.");
    if host.is_empty() {
        None
    } else {
        Some(host.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::{describe_dropped, resolve_launch_target};

    fn temp_url_file(name: &str, content: &str) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(name);
        std::fs::write(&path, content).unwrap();
        path
    }

    #[test]
    fn resolves_url_file_to_its_website() {
        let path = temp_url_file(
            "quick-manage-test-a.url",
            "[InternetShortcut]\r\nURL=https://example.com/a\r\nIconIndex=0\r\n",
        );
        let target = resolve_launch_target(path.to_str().unwrap());
        assert_eq!(target.as_deref(), Some("https://example.com/a"));
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn dropped_url_becomes_a_website_entry() {
        let path = temp_url_file(
            "quick-manage-test-b.url",
            "[InternetShortcut]\nURL=https://www.github.com/waiseset\n",
        );
        let entry = describe_dropped(path.to_str().unwrap());
        assert_eq!(entry.kind, "url", "Internet 快捷方式应识别为网址");
        assert_eq!(entry.target, "https://www.github.com/waiseset");
        assert_eq!(entry.name, "github.com", "名称应取域名（去掉 www.）");
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn plain_executable_keeps_its_path() {
        let entry = describe_dropped(r"C:\Windows\System32\notepad.exe");
        assert_eq!(entry.kind, "app");
        assert_eq!(entry.target, r"C:\Windows\System32\notepad.exe");
        assert_eq!(entry.name, "notepad");
    }
}
