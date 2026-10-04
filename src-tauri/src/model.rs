//! 数据模型：全部用户数据都可以序列化成一份 JSON（含图标 base64），用于本地存储与导入导出。

use serde::{Deserialize, Serialize};

/// 数据结构版本，导入旧版本数据时用于兼容处理
pub const DATA_VERSION: u32 = 1;

/// 条目类型：应用 / 网址
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ItemKind {
    #[default]
    App,
    Url,
}

/// 图标：base64 编码的图像数据（mime 决定前端如何渲染，svg 直接原样存）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IconData {
    pub mime: String,
    pub data: String,
}

/// 二级分类
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubCategory {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub order: i64,
}

/// 一级分类
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub order: i64,
    #[serde(default)]
    pub subcategories: Vec<SubCategory>,
}

/// 条目（应用或网址）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub kind: ItemKind,
    /// 应用的 exe/文件路径，或网址的 URL
    pub target: String,
    #[serde(default)]
    pub category_id: Option<String>,
    #[serde(default)]
    pub subcategory_id: Option<String>,
    #[serde(default)]
    pub favorite: bool,
    #[serde(default)]
    pub icon: Option<IconData>,
    #[serde(default)]
    pub order: i64,
    #[serde(default)]
    pub created_at: i64,
}

/// 主题
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    Light,
    Dark,
}

/// 应用设置
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(default)]
    pub theme: Theme,
    /// 路径检查中「永久忽略」的条目 id
    #[serde(default)]
    pub permanently_ignored: Vec<String>,
}

/// 全量用户数据
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppData {
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub categories: Vec<Category>,
    #[serde(default)]
    pub items: Vec<Item>,
    #[serde(default)]
    pub settings: Settings,
}

fn default_version() -> u32 {
    DATA_VERSION
}

impl Default for AppData {
    fn default() -> Self {
        Self {
            version: DATA_VERSION,
            categories: Vec::new(),
            items: Vec::new(),
            settings: Settings::default(),
        }
    }
}
