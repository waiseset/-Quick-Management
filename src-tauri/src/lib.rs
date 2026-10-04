mod commands;
mod favicon;
mod model;
mod storage;
mod winapi;

use commands::{
    check_paths, data_location, export_data, fetch_favicon_icon, import_data, load_data, open_item,
    pick_icon_from_path, reveal_in_explorer, save_data,
};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
            data_location
        ])
        .run(tauri::generate_context!())
        .expect("启动 快捷管理 失败");
}
