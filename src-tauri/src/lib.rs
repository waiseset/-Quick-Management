mod commands;
mod favicon;
mod model;
mod shortcut;
mod storage;
mod winapi;

use tauri::{Emitter, Manager, WindowEvent};

use commands::{
    check_paths, data_location, export_data, fetch_favicon_icon, hash_password, import_data,
    load_data, make_salt, open_item, pick_icon_from_path, resolve_target, reveal_in_explorer,
    save_data,
};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        // Ctrl+F 让给应用自己的搜索框（见 TitleBar.tsx）：
        // 不关掉 WebView2 的浏览器快捷键的话，按下去会先弹出系统自带的查找栏
        .setup(|app| {
            #[cfg(windows)]
            if let Some(window) = app.get_webview_window("main") {
                disable_browser_accelerator_keys(&window);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_data,
            save_data,
            open_item,
            reveal_in_explorer,
            pick_icon_from_path,
            fetch_favicon_icon,
            check_paths,
            export_data,
            import_data,
            data_location,
            resolve_target,
            hash_password,
            make_salt
        ])
        // 从资源管理器拖进来的文件：先解析快捷方式，再把结构化结果交给前端建条目
        .on_window_event(|window, event| {
            if let WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                let entries: Vec<shortcut::DroppedEntry> = paths
                    .iter()
                    .map(|path| shortcut::describe_dropped(&path.to_string_lossy()))
                    .collect();
                let _ = window.emit("files-dropped", entries);
            }
        })
        .run(tauri::generate_context!())
        .expect("启动 快捷管理 失败");
}

/// 关掉 WebView2 的「浏览器专属」快捷键：Ctrl+F（查找栏）、Ctrl+P、F5、Ctrl+加减号…
///
/// 这样 Ctrl+F 才能交给应用自己的搜索框（跨分类搜索名称与描述），
/// 行为与界面风格统一。与所有应用通用的快捷键（Ctrl+C / V / X 等）不受影响 ——
/// WebView2 只会禁用 `AreBrowserAcceleratorKeysEnabled` 覆盖的那部分。
#[cfg(windows)]
fn disable_browser_accelerator_keys(window: &tauri::WebviewWindow) {
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3;
    use windows::core::Interface;

    let _ = window.with_webview(|webview| unsafe {
        let Ok(core) = webview.controller().CoreWebView2() else {
            return;
        };
        let Ok(settings) = core.Settings() else {
            return;
        };
        let Ok(settings3) = settings.cast::<ICoreWebView2Settings3>() else {
            return;
        };
        let _ = settings3.SetAreBrowserAcceleratorKeysEnabled(false);
    });
}
