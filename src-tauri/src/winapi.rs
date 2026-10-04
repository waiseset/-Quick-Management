//! Windows 系统调用：ShellExecuteW 打开条目、explorer /select 定位文件、
//! 通过 IShellItemImageFactory 提取 exe/快捷方式/文件夹的系统图标。

use std::ffi::c_void;
use std::path::Path;
use std::process::Command;

use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;

use windows::core::{HSTRING, PCWSTR};
use windows::Win32::Foundation::SIZE;
use windows::Win32::Graphics::Gdi::{
    DeleteObject, GetDC, GetDIBits, GetObjectW, ReleaseDC, BITMAP, BITMAPINFO, BITMAPINFOHEADER,
    BI_RGB, DIB_RGB_COLORS, HBITMAP, HGDIOBJ,
};
use windows::Win32::System::Com::{CoInitializeEx, COINIT_APARTMENTTHREADED};
use windows::Win32::UI::Shell::{
    IShellItemImageFactory, SHCreateItemFromParsingName, ShellExecuteW, SIIGBF_BIGGERSIZEOK,
    SIIGBF_ICONONLY,
};
use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

use crate::model::IconData;

/// 图标最大边长（导出后体积可控）
const ICON_MAX: u32 = 256;

/// 打开目标：应用走 ShellExecuteW("open")，网址同样交给 ShellExecuteW 用默认浏览器打开
pub fn shell_open(target: &str) -> Result<(), String> {
    let verb = HSTRING::from("open");
    let file = HSTRING::from(target);
    let ret = unsafe {
        ShellExecuteW(
            None,
            &verb,
            &file,
            PCWSTR::null(),
            PCWSTR::null(),
            SW_SHOWNORMAL,
        )
    };
    let code = ret.0 as isize;
    // ShellExecuteW 返回值 <= 32 表示失败
    if code <= 32 {
        return Err(format!("系统无法打开「{target}」（错误码 {code}）"));
    }
    Ok(())
}

/// 在资源管理器中定位文件；传入目录时直接打开该目录
pub fn reveal_in_explorer(path: &str) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("路径为空".into());
    }
    let is_dir = Path::new(path).is_dir();
    let arg = if is_dir {
        path.to_string()
    } else {
        format!("/select,{path}")
    };
    Command::new("explorer")
        .arg(arg)
        .spawn()
        .map_err(|e| format!("调用资源管理器失败: {e}"))?;
    Ok(())
}

/// 按扩展名决定取图标的方式：图片文件直接读，其它用系统 shell 图标
pub fn icon_from_path(path: &str) -> Result<IconData, String> {
    if !Path::new(path).exists() {
        return Err(format!("文件不存在: {path}"));
    }
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match ext.as_str() {
        "png" | "jpg" | "jpeg" | "gif" | "bmp" | "webp" | "ico" => image_file_to_icon(path),
        _ => shell_icon(path, ICON_MAX),
    }
}

/// 本地图片 -> PNG base64
fn image_file_to_icon(path: &str) -> Result<IconData, String> {
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let format = match ext.as_str() {
        "png" => Some(image::ImageFormat::Png),
        "jpg" | "jpeg" => Some(image::ImageFormat::Jpeg),
        "gif" => Some(image::ImageFormat::Gif),
        "bmp" => Some(image::ImageFormat::Bmp),
        "webp" => Some(image::ImageFormat::WebP),
        "ico" => Some(image::ImageFormat::Ico),
        _ => None,
    };
    let mut reader = image::ImageReader::open(path).map_err(|e| format!("读取图片失败: {e}"))?;
    if let Some(f) = format {
        reader.set_format(f);
    }
    let img = reader.decode().map_err(|e| format!("解析图片失败: {e}"))?;
    rgba_to_png_icon(img.to_rgba8(), ICON_MAX)
}

/// 提取 exe / 快捷方式 / 文件夹 / 任意文件的系统图标
pub fn shell_icon(path: &str, size: u32) -> Result<IconData, String> {
    unsafe {
        // 该线程可能还没初始化 COM（Tauri 的线程池线程），失败也无妨
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

        let factory: IShellItemImageFactory =
            SHCreateItemFromParsingName(&HSTRING::from(path), None)
                .map_err(|e| format!("无法读取系统图标: {e}"))?;

        let hbmp: HBITMAP = factory
            .GetImage(
                SIZE {
                    cx: size as i32,
                    cy: size as i32,
                },
                SIIGBF_ICONONLY | SIIGBF_BIGGERSIZEOK,
            )
            .map_err(|e| format!("无法读取系统图标: {e}"))?;

        let result = hbitmap_to_rgba(hbmp);
        let _ = DeleteObject(HGDIOBJ(hbmp.0));
        let (rgba, w, h) = result?;
        rgba_to_png_icon(
            image::RgbaImage::from_raw(w, h, rgba).ok_or_else(|| "图标尺寸异常".to_string())?,
            ICON_MAX,
        )
    }
}

unsafe fn hbitmap_to_rgba(hbmp: HBITMAP) -> Result<(Vec<u8>, u32, u32), String> {
    let mut bm = BITMAP::default();
    let got = GetObjectW(
        HGDIOBJ(hbmp.0),
        std::mem::size_of::<BITMAP>() as i32,
        Some(&mut bm as *mut _ as *mut c_void),
    );
    if got == 0 {
        return Err("读取位图信息失败".into());
    }
    let w = bm.bmWidth;
    let h = bm.bmHeight;
    if w <= 0 || h <= 0 {
        return Err("位图尺寸无效".into());
    }

    let mut info = BITMAPINFO::default();
    info.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
    info.bmiHeader.biWidth = w;
    info.bmiHeader.biHeight = -h; // 负数 = 自上而下
    info.bmiHeader.biPlanes = 1;
    info.bmiHeader.biBitCount = 32;
    info.bmiHeader.biCompression = BI_RGB.0;

    let mut buf = vec![0u8; (w as usize) * (h as usize) * 4];
    let hdc = GetDC(None);
    if hdc.is_invalid() {
        return Err("获取绘图上下文失败".into());
    }
    let lines = GetDIBits(
        hdc,
        hbmp,
        0,
        h as u32,
        Some(buf.as_mut_ptr() as *mut c_void),
        &mut info,
        DIB_RGB_COLORS,
    );
    ReleaseDC(None, hdc);
    if lines == 0 {
        return Err("读取位图像素失败".into());
    }

    // BGRA -> RGBA；GetImage 返回的位图通常是预乘 alpha
    let has_alpha = buf.chunks_exact(4).any(|p| p[3] != 0);
    let premultiplied = has_alpha
        && buf
            .chunks_exact(4)
            .all(|p| p[0] <= p[3] && p[1] <= p[3] && p[2] <= p[3]);

    let mut out = vec![0u8; buf.len()];
    for (i, px) in buf.chunks_exact(4).enumerate() {
        let (b, g, r, mut a) = (px[0], px[1], px[2], px[3]);
        if !has_alpha {
            a = 255;
        }
        let (r, g, b) = if premultiplied && a > 0 && a < 255 {
            let scale = |c: u8| ((c as u32 * 255 + a as u32 / 2) / a as u32).min(255) as u8;
            (scale(r), scale(g), scale(b))
        } else {
            (r, g, b)
        };
        out[i * 4] = r;
        out[i * 4 + 1] = g;
        out[i * 4 + 2] = b;
        out[i * 4 + 3] = a;
    }
    Ok((out, w as u32, h as u32))
}

/// RGBA 图像 -> PNG base64（超过 max 边长时等比缩小）
pub fn rgba_to_png_icon(img: image::RgbaImage, max: u32) -> Result<IconData, String> {
    let (w, h) = (img.width(), img.height());
    if w == 0 || h == 0 {
        return Err("图像尺寸无效".into());
    }
    let img = if w.max(h) > max {
        let scale = max as f32 / w.max(h) as f32;
        let nw = ((w as f32 * scale).round() as u32).max(1);
        let nh = ((h as f32 * scale).round() as u32).max(1);
        image::imageops::resize(&img, nw, nh, image::imageops::FilterType::Lanczos3)
    } else {
        img
    };

    let mut bytes: Vec<u8> = Vec::new();
    image::DynamicImage::ImageRgba8(img)
        .write_to(&mut std::io::Cursor::new(&mut bytes), image::ImageFormat::Png)
        .map_err(|e| format!("编码 PNG 失败: {e}"))?;

    Ok(IconData {
        mime: "image/png".into(),
        data: STANDARD.encode(&bytes),
    })
}
