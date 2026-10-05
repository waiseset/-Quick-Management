# 快捷管理 3.0

Windows 桌面端的**本地快捷方式管理器**：把常用的应用、网址和文件分门别类收进一个窗口，单击看描述、双击直接打开。
全部数据都存在本地 JSON 里，不联网也能用。

> 界面按参考文档的四个页面实现：主页面 / 提醒页 / 数据管理页 / 关于。
> 左上角标题菜单、右上角窗口按钮、左侧分类栏、椭圆二级分类、条目网格的位置均与文档一致。

## 下载

| 版本 | 文件 | 说明 |
| --- | --- | --- |
| 安装版 | [`快捷管理_3.0_x64-setup.exe`](https://github.com/waiseset/Quick-Management/releases/download/3.0/Quick-Management.3.0.x64-setup.exe) | 双击按向导安装，装到当前用户目录，**不需要管理员权限**；会创建开始菜单与桌面快捷方式 |
| 便携版 | [`快捷管理-便携版.zip`](https://github.com/waiseset/Quick-Management/releases/download/3.0/Quick-Management.3.0.x64.zip) | 解压即用，数据写在程序旁边的 `data\` 目录，可放 U 盘随身携带 |

系统要求：Windows 10 / 11（依赖系统自带的 WebView2 运行时，一般无需额外安装）。

项目主页：<https://github.com/waiseset/Quick-Management>
在线介绍页：<https://waiseset.github.io/Quick-Management/>（由本仓库 `docs/` 发布）

## 功能

- **三种条目**：**应用**、**网址**，以及任意**文件**（用系统默认程序打开，自动取系统图标）。
- **添加入口**：点「添加」逐步填写，或**直接从资源管理器把文件拖进窗口**；添加或拖入 `.lnk` 快捷方式会**自动定位到它指向的真实文件**，拖入 `.url`（Internet 快捷方式）则自动转成网址条目、名称取域名。
- **分类与二级分类**：自定义一级分类 + 椭圆胶囊式的二级分类，都支持添加、重命名、删除、拖拽排序；删除时会先问清下面的条目怎么处理。
- **多子分类归属**：「添加到…」把条目**复制一份**到指定分类，可同时勾选多个二级分类；原条目保持不动。
- **空子分类自动收拾**：没有任何条目的二级分类不显示；手动创建但一直没放东西的，下次打开应用会自动清理。
- **搜索**：标题栏搜索框按**名称或描述**过滤，跨全部分类查找。
- **多选**：`Ctrl+左键` 逐个加选或取消，`Shift+左键` 成片选中；复制、剪切、隐藏、删除、收藏一次性作用于整批。批量添加应用时文件对话框本身也支持多选。
- **条目操作**：单击显示描述、双击打开、点空白取消选中；右键菜单按 Windows 习惯排列（打开 / 打开所在文件夹 / 添加到… / 剪切 / 复制 / 收藏 / 隐藏 / 更改图标 / 重命名 / 属性 / 删除），空白处右键可「添加」「批量添加应用」「粘贴」，也支持 `Ctrl+C / X / V`。
- **密码隐藏区**：把条目隐藏起来，从所有常规视图消失；点左上角菜单的「隐藏的元素」查看，进入需要密码（**图案 / 数字 / 混合**，首次进入时自选）。数字密码是手机锁屏样式的键盘。密码只保存哈希与随机盐，不存明文。
- **图标自动提取**：添加应用自动取 exe 的系统图标（会裁掉多余透明留白，避免显示得很小），添加网址自动抓取网站图标；也可随时换成任意本地图片。
- **键盘操作**：`Esc` 从任意页面返回主视图，`Enter` 确定 / 保存，`Shift+Enter` 在描述里换行。
- **拖拽排序**：条目、分类、子分类都能拖动调整顺序。
- **数据管理**：一键导出 / 导入全部数据（列表、图标、名称、描述、路径、收藏、忽略状态、主题、分类结构与排序），也可清空所有数据重来。
- **路径失效提醒**：自动检查应用与文件条目的路径是否存在，列出找不到的，可「本次忽略」或「永久忽略」。
- **深色 / 浅色主题**：随时切换并记住，随导出数据一起带走。
- **系统原生对话框**：选择 exe、文件、图片、导入、导出都走系统文件对话框，不需要手输路径。

## 数据存放位置

| 版本 | 位置 |
| --- | --- |
| 安装版 | `%APPDATA%\com.waiseset.quickmanage\data.json` |
| 便携版 | 程序目录下的 `data\data.json`（由同目录的 `portable.txt` 触发） |

两者都是单个 JSON 文件，导入导出的就是它。数据文件损坏时会留档为 `data.corrupt-<时间戳>.json`，不会被静默覆盖。

旧版本的数据可以直接使用 —— 早期一个条目只能属于一个二级分类，加载时会自动转成数组形式。

## 从源码构建

需要 Node.js 18+、Rust 稳定版工具链、以及 MSVC 生成工具（Windows）。

```bash
npm install

# 开发（热更新）
npm run tauri dev

# 打包：产出 NSIS 安装包与可执行文件
npm run tauri build
```

产物位置：

- 可执行文件：`src-tauri/target/release/quick-manage.exe`
- 安装包：`src-tauri/target/release/bundle/nsis/快捷管理_3.0.0_x64-setup.exe`

**自制便携版**：把 `quick-manage.exe` 与一个空的 `portable.txt` 放进同一个目录即可 ——
程序检测到该标记后会把数据写到旁边的 `data\` 里，不再使用 `%APPDATA%`。

### 关于 Cargo 镜像

仓库里有两份 `.cargo/config.toml`（根目录与 `src-tauri/`），把 crates.io 指向
[rsproxy](https://rsproxy.cn) 稀疏镜像；如果你的网络访问 crates.io 正常，删掉这两个文件即可回到官方源。

### 版本号约定

`tauri.conf.json` 与 `Cargo.toml` 里的版本必须是三段式 semver（Tauri 会校验），
所以打包版本是 `3.0.0`、安装包文件名也带 `_3.0.0_`；界面上显示的是 `3.0`。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 外壳 | Tauri 2（无边框窗口 + 自绘标题栏，NSIS 打包） |
| 前端 | React 19 + TypeScript + Vite |
| 后端 | Rust：`ShellExecuteW` 打开、`explorer /select` 定位、`IShellItemImageFactory` 提取系统图标、`IShellLink` 解析快捷方式、`ureq` 抓取网站图标、`sha2` 计算密码哈希 |
| 存储 | 单个 JSON 文件（图标以 base64 内嵌） |

## 目录结构

```
.
├─ src/                     前端（React + TS）
│  ├─ components/           TitleBar / Sidebar / SubCategoryBar / ItemGrid /
│  │                        ItemEditor / AddToDialog / ContextMenu / Modal /
│  │                        VaultView / PatternLock / NumberPad / 各视图页
│  ├─ store.tsx             全局状态（reducer + 防抖自动保存 + 空子分类清理）
│  ├─ api.ts                全部 Tauri 命令的封装
│  ├─ drag.ts               指针事件实现的排序拖拽
│  └─ styles.css            设计令牌 + 浅色 / 深色两套变量
├─ src-tauri/               Rust 后端
│  └─ src/
│     ├─ model.rs           数据结构（含旧数据兼容）
│     ├─ storage.rs         JSON 读写、导入导出、便携模式判定
│     ├─ shortcut.rs        .lnk / .url 解析
│     ├─ winapi.rs          ShellExecuteW / explorer /select / 系统图标提取与裁边
│     ├─ favicon.rs         抓取网页图标
│     └─ commands.rs        暴露给前端的命令
└─ docs/                    GitHub Pages（介绍页 + 发布物）
```

## 开发者

- 项目主页：<https://github.com/waiseset/Quick-Management>
- 开发者：waiseset
