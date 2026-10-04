//! 网页 favicon 抓取：拉取首页 HTML -> 找 <link rel="...icon..."> -> 下载并转成 PNG base64。
//! 找不到声明时回退到站点根目录的 /favicon.ico。

use std::io::Read;
use std::time::Duration;

use base64::engine::general_purpose::STANDARD;
use base64::Engine as _;
use url::Url;

use crate::model::IconData;

const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const MAX_HTML: usize = 512 * 1024;
const MAX_IMAGE: usize = 4 * 1024 * 1024;
const ICON_MAX: u32 = 256;

fn agent() -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(12)))
        .user_agent(UA)
        .build()
        .into()
}

fn http_get(url: &str, limit: usize) -> Result<(Vec<u8>, String, Option<String>), String> {
    let resp = agent()
        .get(url)
        .header("Accept", "text/html,image/*,*/*")
        .call()
        .map_err(|e| format!("请求 {url} 失败: {e}"))?;
    let headers = resp.headers();
    let mime = headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.split(';').next().unwrap_or("").trim().to_ascii_lowercase());
    let base = headers
        .get("content-location")
        .and_then(|v| v.to_str().ok())
        .map(|v| v.to_string());
    let mut body = Vec::new();
    resp.into_body()
        .into_reader()
        .take(limit as u64)
        .read_to_end(&mut body)
        .map_err(|e| format!("读取响应失败: {e}"))?;
    Ok((body, mime.unwrap_or_default(), base))
}

/// 补全协议：用户可能只输入 example.com
fn normalize(input: &str) -> Result<Url, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("网址为空".into());
    }
    let with_scheme = if trimmed.contains("://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };
    Url::parse(&with_scheme).map_err(|e| format!("网址格式不正确: {e}"))
}

pub fn fetch(input: &str) -> Result<IconData, String> {
    let page = normalize(input)?;
    let mut errors: Vec<String> = Vec::new();

    // 1) 解析首页声明的图标
    match http_get(page.as_str(), MAX_HTML) {
        Ok((html, _, _)) => {
            let text = String::from_utf8_lossy(&html).to_string();
            if let Some(href) = find_icon_href(&text) {
                match page.join(href.trim()) {
                    Ok(icon_url) => match http_get(icon_url.as_str(), MAX_IMAGE) {
                        Ok((bytes, mime, _)) => {
                            return encode(&bytes, &mime, icon_url.as_str());
                        }
                        Err(e) => errors.push(e),
                    },
                    Err(e) => errors.push(format!("图标地址无效: {e}")),
                }
            }
        }
        Err(e) => errors.push(e),
    }

    // 2) 回退到 /favicon.ico
    let fallback = page
        .join("/favicon.ico")
        .map_err(|e| format!("无法构造 favicon 地址: {e}"))?;
    match http_get(fallback.as_str(), MAX_IMAGE) {
        Ok((bytes, mime, _)) => encode(&bytes, &mime, fallback.as_str()),
        Err(e) => {
            errors.push(e);
            Err(format!("未能获取图标：{}", errors.join("；")))
        }
    }
}

/// 把下载到的字节变成可直接放进 <img src> 的 data URL 内容
fn encode(bytes: &[u8], mime: &str, url: &str) -> Result<IconData, String> {
    if bytes.is_empty() {
        return Err("图标内容为空".into());
    }
    let is_svg = mime.contains("svg") || url.to_ascii_lowercase().ends_with(".svg");
    if is_svg {
        // SVG 交给浏览器渲染，不栅格化
        return Ok(IconData {
            mime: "image/svg+xml".into(),
            data: STANDARD.encode(bytes),
        });
    }
    let img = image::load_from_memory(bytes)
        .map_err(|e| format!("图标格式无法识别（{mime}）: {e}"))?;
    crate::winapi::rgba_to_png_icon(img.to_rgba8(), ICON_MAX)
}

/// 在一个 <link> 标签里取属性值
fn attr(tag: &str, name: &str) -> Option<String> {
    let lower = tag.to_ascii_lowercase();
    let mut from = 0usize;
    while let Some(idx) = lower[from..].find(name) {
        let i = from + idx;
        let prev_ok = i == 0 || !lower.as_bytes()[i - 1].is_ascii_alphanumeric();
        let rest = lower[i + name.len()..].trim_start();
        if prev_ok {
            if let Some(after) = rest.strip_prefix('=') {
                let value = after.trim_start();
                let quote = value.chars().next()?;
                if quote == '"' || quote == '\'' {
                    let inner = &value[1..];
                    if let Some(end) = inner.find(quote) {
                        return Some(inner[..end].to_string());
                    }
                }
            }
        }
        from = i + name.len();
    }
    None
}

/// 在 HTML 中找图标地址：优先 apple-touch-icon，其次任意 rel 含 icon 的 link
fn find_icon_href(html: &str) -> Option<String> {
    let lower = html.to_ascii_lowercase();
    let mut best: Option<String> = None;
    let mut pos = 0usize;
    while let Some(idx) = lower[pos..].find("<link") {
        let start = pos + idx;
        let end = match lower[start..].find('>') {
            Some(e) => start + e,
            None => break,
        };
        let tag = &html[start..end];
        let tag_lower = &lower[start..end];
        if tag_lower.contains("icon") {
            if let Some(href) = attr(tag, "href") {
                if tag_lower.contains("apple-touch-icon") {
                    return Some(href);
                }
                if best.is_none() {
                    best = Some(href);
                }
            }
        }
        pos = end + 1;
    }
    best
}
