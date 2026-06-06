# Changelog

## v2.3.1

### 修复

- 修复 Bundles2 模式下补丁 zip 中包含 bundle 文件条目导致补丁安装失败的问题

### 优化

- 窗口标题显示应用版本号（流放工艺台 vX.Y.Z），移除"支持 POE1/2"描述
- 补丁列表长文件名支持自动换行，修复文本溢出问题
- 执行失败弹窗补充取消按钮文案

## v2.3.0

### 新增

- **修复客户端**，GGG 平台一键运行 PackCheck.exe 检查修复游戏文件，腾讯平台引导 WeGame 修复
- **反馈弹窗**，执行失败时弹出反馈窗口，支持一键复制日志和打开反馈链接
- **补丁提示链接**，补丁选择页面增加 A 大补丁下载链接

## v2.2.0

### 新增

- **Content.ggpk 格式支持**，基于 poe-bundle-lib 新增的 LibGGPK3/LibBundledGGPK3 TypeScript 移植，支持直接读写 `Content.ggpk` 文件
- 自动识别文件格式（`.ggpk` vs `.bin`），GGPK 模式支持 Bundled GGPK（内含 Bundles2）和纯 GGPK 两种子模式
- UI 修改（字体/小地图/视距/去雾/点亮）在 GGPK 模式下通过文件树遍历实现，自动处理路径大小写不敏感匹配
- 文件选择对话框支持 `.ggpk` 扩展名
- 游戏路径检测同时支持 `Content.ggpk` 和 `Bundles2/_.index.bin`
- **流放之路 2 装备预览**，根据检测到的游戏版本显示独立的 POE1/POE2 传奇装备预览
- **游戏版本自动检测**，通过目录下的 `GFSDK_Aftermath_Lib.x64.dll` 判断 POE1/POE2
- **游戏平台自动检测**，通过 TCLS / steam_api64.dll / .egstore 自动识别腾讯/Steam/Epic/GGG，路径恢复时同时检测版本和平台
- **繁转简补丁冲突保护**，检测到繁转简补丁时自动清空字体选择，执行时跳过字体修改

### 修复

- 修复 preload 层 IPC listener 泄漏导致执行日志重复 4 次的问题
- 修复 `executedSuccess` 改名为 `showLaunchButton`，仅 GGG 平台显示启动游戏按钮

### 优化

- 精简安装包体积，移除多余 Chromium 语言包

## v2.1.0

### 新增

- **恢复字体选择记忆**，进入字体选择步骤时自动滚动到上次选中的字体位置

## v2.0.0

### 重大变更

- **移除 .NET 依赖**，核心打补丁逻辑改用纯 TypeScript 实现，基于 [poe-bundle-lib](https://github.com/sage-z-cn/poe-bundle-lib) 直接操作 `_.index.bin`
- **替换更新机制**，移除 `electron-updater` 自动下载，改为手动版本检查 — 启动时比对远程版本，有更新时弹窗提示并引导至 Gitee/GitHub 下载

### 新增

- 启动时自动检查更新，发现新版本以 antd Modal 弹窗提醒
- 更新弹窗提供 Gitee（推荐）和 GitHub 两个下载渠道
- AGENTS.md 项目文档，供 AI Agent 快速上手
- README.md 完善功能介绍、技术栈、项目结构

### 优化

- 免责声明和隐藏功能提示文案精简
- 开源地址同时展示 Gitee 和 GitHub
- 字体预览区文案去除了已过时的 .NET 安装提示

### 修复

- 更新提醒弹窗因 IPC 时序竞争不显示的问题（主进程 push 改 request-reply）
