//! 数据模型：全部用户数据都可以序列化成一份 JSON（含图标 base64），用于本地存储与导入导出。

use serde::{Deserialize, Serialize};

/// 数据结构版本，导入旧版本数据时用于兼容处理
pub const DATA_VERSION: u32 = 1;

/// 条目类型：应用 / 网址 / 文件
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ItemKind {
    #[default]
    App,
    Url,
    /// 普通文件：用系统默认程序打开
    File,
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

/// 条目（应用 / 网址 / 文件）
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
    /// 所属的一级分类，可以同时属于多个；兼容旧数据里的单个 categoryId
    #[serde(default, alias = "categoryId", deserialize_with = "de_id_list")]
    pub category_ids: Vec<String>,
    /// 所属的二级分类，可以同时属于多个；兼容旧数据里的单个 subcategoryId
    #[serde(default, alias = "subcategoryId", deserialize_with = "de_id_list")]
    pub subcategory_ids: Vec<String>,
    #[serde(default)]
    pub favorite: bool,
    /// 隐藏的条目不出现在主视图 / 收藏夹 / 全部里，只存在于「隐藏的元素」
    #[serde(default)]
    pub hidden: bool,
    #[serde(default)]
    pub icon: Option<IconData>,
    #[serde(default)]
    pub order: i64,
    #[serde(default)]
    pub created_at: i64,
}

/// 兼容旧数据的单值写法：字符串、数组、null 三种形态都归一成数组
fn de_id_list<'de, D>(deserializer: D) -> Result<Vec<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum Compat {
        Many(Vec<String>),
        One(String),
    }

    Ok(match Option::<Compat>::deserialize(deserializer)? {
        Some(Compat::Many(list)) => list,
        Some(Compat::One(id)) => vec![id],
        None => Vec::new(),
    })
}

/// 主题
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    Light,
    Dark,
}

/// 隐藏区的解锁凭据：只保存哈希与盐，不保存明文
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Vault {
    /// 密码类型：pattern（图案）/ pin（数字）/ mixed（混合）
    pub kind: String,
    /// SHA-256(salt + 密码) 的十六进制
    pub hash: String,
    pub salt: String,
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
    /// 隐藏区的密码设置；为 None 表示还没设置过
    #[serde(default)]
    pub vault: Option<Vault>,
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
