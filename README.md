# 快捷管理

Windows 桌面端的**本地快捷方式管理器**：把常用的应用和网址分门别类收进一个窗口，单击看描述、双击直接打开。全部数据存在本地，不联网也能用。

> 界面参考文档的四个页面（主页面 / 提醒页 / 数据管理页 / 关于）实现：左上角标题菜单、右上角窗口按钮、左侧分类栏、椭圆二级分类、条目网格。

## 下载

| 版本 | 文件 | 说明 |
| --- | --- | --- |
| 安装版 | [`快捷管理_1.0.0_x64-setup.exe`]([./docs/releases/快捷管理_1.0.0_x64-setup.exe](https://github.com/waiseset/-Quick-Management/releases/download/1.0/Quick.Management_1.0_x64-setup.exe)) | 双击按向导安装，装到当前用户目录，**不需要管理员权限**；开始菜单与桌面会创建快捷方式 |
| 便携版 | [`快捷管理-便携版.zip`]([./docs/releases/快捷管理-便携版.zip](https://github.com/waiseset/-Quick-Management/releases/download/1.0/Quick.Management_1.0_x64.zip)) | 解压即用，数据写在程序旁边的 `data\` 目录，可放 U 盘随身携带 |

系统要求：Windows 10 / 11（依赖系统自带的 WebView2 运行时，一般无需额外安装）。

也可以直接访问项目主页：<https://waiseset.github.io/>（GitHub Pages，从本仓库 `docs/` 发布）。

## 功能

- **分类与二级分类**：自定义一级分类 + 椭圆胶囊式的二级分类，都支持添加、重命名、删除、拖拽排序；删除时会先问清下面的条目怎么处理。
- **搜索**：标题栏搜索框按**名称或描述**过滤，跨全部分类查找。
- **全部 / 收藏夹也支持二级分类**：聚合展示各分类下的子分类，同名子分类只保留一个胶囊（点击时一并筛选）。
- **条目操作**：单击显示描述、双击打开、右键菜单（打开 / 打开所在文件夹 / 收藏 / 复制 / 剪切 / 更改图标 / 编辑 / 删除），空白处右键可「添加」与「粘贴」，支持 `Ctrl+C / X / V`。
- **图标自动提取**：添加应用自动读取 exe 的系统图标，添加网址自动抓取 favicon；也可随时换成任意本地图片。
- **拖拽排序**：条目、分类、子分类都能拖动调整顺序。
- **数据管理**：一键导出 / 导入全部数据（列表、图标、名称、描述、路径、收藏、忽略状态、主题、分类结构与排序），也可清空所有数据重来。
- **路径失效提醒**：自动检查所有应用条目的路径是否存在，列不出来找不到的，可「本次忽略」或「永久忽略」。
- **深色 / 浅色主题**：随时切换并记住，随导出数据一起带走。
- **系统原生对话框**：选择 exe、选择图片、导入、导出都走系统文件对话框，不需要手输路径。

## 数据存放位置

| 版本 | 位置 |
| --- | --- |
| 安装版 | `%APPDATA%\com.waiseset.quickmanage\data.json` |
| 便携版 | 程序目录下的 `data\data.json`（由同目录的 `portable.txt` 触发） |

两者都是单个 JSON 文件，导入导出的就是它。数据文件损坏时会留档为 `data.corrupt-<时间戳>.json`，不会被静默覆盖。

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
- 安装包：`src-tauri/target/release/bundle/nsis/快捷管理_1.0.0_x64-setup.exe`

**自制便携版**：把 `quick-manage.exe` 与一个空的 `portable.txt` 放进同一个目录即可 —— 程序检测到该标记后会把数据写到旁边的 `data\` 里，不再使用 `%APPDATA%`。

### 关于 Cargo 镜像

仓库里有两份 `.cargo/config.toml`（根目录与 `src-tauri/`），把 crates.io 指向 [rsproxy](https://rsproxy.cn) 稀疏镜像；如果你的网络访问 crates.io 正常，删掉这两个文件即可回到官方源。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 外壳 | Tauri 2（无边框窗口 + 自绘标题栏，NSIS 打包） |
| 前端 | React 19 + TypeScript + Vite |
| 后端 | Rust：`ShellExecuteW` 打开、`explorer /select` 定位、`IShellItemImageFactory` 提取系统图标、`ureq` 抓取 favicon |
| 存储 | 单个 JSON 文件（图标以 base64 内嵌） |

## 目录结构

```
.
├─ src/                     前端（React + TS）
│  ├─ components/           TitleBar / Sidebar / SubCategoryBar / ItemGrid /
│  │                        ItemEditor / ContextMenu / Modal / 各视图页
│  ├─ store.tsx             全局状态（reducer + 400ms 防抖自动保存）
│  ├─ api.ts                全部 Tauri 命令的封装
│  └─ styles.css            浅色 / 深色两套变量
├─ src-tauri/               Rust 后端
│  └─ src/
│     ├─ model.rs           数据结构
│     ├─ storage.rs         JSON 读写、导入导出、便携模式判定
│     ├─ winapi.rs          ShellExecuteW / explorer /select / 系统图标提取
│     ├─ favicon.rs         抓取网页 favicon
│     └─ commands.rs        暴露给前端的命令
└─ docs/                    GitHub Pages（介绍页 + 发布物）
```

## 开发者

- Github：<https://github.com/waiseset>
- QQ：<https://qm.qq.com/q/j2VgeBsrCg>
- 赞助：<https://waiseset.github.io/waiseset/images/赞助.jpg>
