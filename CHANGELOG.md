# Changelog

## v2.2.0

### 新增

- **Content.ggpk 格式支持**，基于 poe-bundle-lib 新增的 LibGGPK3/LibBundledGGPK3 TypeScript 移植，支持直接读写 `Content.ggpk` 文件
- 自动识别文件格式（`.ggpk` vs `.bin`），GGPK 模式支持 Bundled GGPK（内含 Bundles2）和纯 GGPK 两种子模式
- UI 修改（字体/小地图/视距/去雾/点亮）在 GGPK 模式下通过文件树遍历实现，自动处理路径大小写不敏感匹配
- 文件选择对话框支持 `.ggpk` 扩展名
- 游戏路径检测同时支持 `Content.ggpk` 和 `Bundles2/_.index.bin`

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
- 秘密彩蛋点击次数降至 10 次，增加 hover 辉光和点击弹跳特效
- 字体预览区文案去除了已过时的 .NET 安装提示

### 修复

- 更新提醒弹窗因 IPC 时序竞争不显示的问题（主进程 push 改 request-reply）
