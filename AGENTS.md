# AGENTS.md

## 项目概述

POE Bench（流放工艺台）— Electron 桌面应用，用于给流放之路 1/2 打补丁、修改字体。依赖 [poe-bundle-lib](https://github.com/sage-z-cn/poe-bundle-lib) 实现 `Content.ggpk` / `_.index.bin` 的修改。

## Git 远程仓库

项目托管于三个仓库，其中两个公开一个私有：

| 远程 | 地址 | 可见性 | 推送 |
|------|------|--------|------|
| `origin` | https://github.com/sage-z-cn/poe-crafting-bench.git | 公开 | 常规公开开发 |
| `gitee` | https://gitee.com/sage9731/poe-crafting-bench.git | 公开 | 与 origin 同步推送 |
| `private` | https://github.com/sage-z-cn/poe-crafting-bench-private.git | **私有** | 仅自用 |

**公开仓库（origin + gitee）** 不包含隐藏功能（彩蛋）代码，面向开源社区。

**私有仓库（private）** 保留完整代码（含隐藏功能），仅自己可见。

推送公开仓库时必须同时推送两个远程：

```bash
git push origin main && git push gitee main
```

`private` 远程不随常规开发自动推送，需要时手动同步。

### 分支管理

本地两个分支各司其职：

| 分支 | 跟踪远程 | 用途 |
|---|---|---|
| `main` | `origin/main` | 公开开发，不含彩蛋代码 |
| `main-private` | `private/main` | 本地自用，含完整隐藏功能 |

**日常工作流**：

```bash
# 公开开发在 main 上
git checkout main
# ... 开发、提交 ...
git push origin main && git push gitee main

# 需要同步到私有仓库时
git checkout main-private
git cherry-pick <需要的提交-hash>      # 只挑公开部分，不要整个 merge
git push private main-private:main
```

> **⚠️ 同步到 private 时**：必须用 `cherry-pick` 而非 `merge/rebase`。公开仓库历史已经 squash 且移除了彩蛋代码，直接 merge 会导致私有仓库丢失隐藏功能。

## 技术栈

Electron + Vite + React 18 + TypeScript + Ant Design 5 + Tailwind CSS 3

- **构建工具**: `vite-plugin-electron` 统一管理 main/preload/renderer
- **CSS**: PostCSS + Tailwind (`preflight: false`，避免与 antd 样式冲突)
- **测试**: vitest，用例目录 `test/`

## 关键命令

```bash
npm install --legacy-peer-deps  # 必须加此参数，react-sortable-hoc 与 React 18 peer 冲突
npm run dev                     # 启动开发（Vite + Electron）
npm run build                   # tsc 类型检查 → vite build → electron-builder 打包
npm run test                    # vitest 运行测试
```

## 目录结构

```
electron/main/       # 主进程（入口: index.ts）
  index.ts           # 窗口创建、IPC handlers、单实例锁
  update-checker.ts  # 更新检查（fetch 远程 package.json → IPC → 渲染进程弹窗）
  poe-patcher.ts     # 核心打补丁逻辑
  game-utils.ts      # 游戏安装路径检测、字体枚举
electron/preload/    # preload 脚本，contextBridge 暴露 window.ipcRenderer
src/                 # 渲染进程
  main.tsx           # React 入口
  App.tsx            # 主应用（步骤式 Wizard）
  components/        # 各步骤组件
type/                # 全局类型（ExecParam 接口）
```

## 架构要点

### IPC 通信

渲染进程 `sandbox: true` + `contextIsolation: true`，无法直接使用 Node API。所有主进程通信通过 preload 暴露的 `window.ipcRenderer.on/send/invoke`：

| IPC Channel | 方向 | 说明 |
|---|---|---|
| `patch` | renderer→main handle | 执行打补丁 |
| `open-external` | renderer→main handle | 浏览器打开 URL |
| `open-game-file-dialog` | renderer→main handle | 选取 `_.index.bin` |
| `open-patch-file-dialog` | renderer→main handle | 选取补丁 .zip |
| `get-game-install-path` | renderer→main handle | 自动检测游戏路径 |
| `get-installed-fonts` | renderer→main handle | 枚举系统字体 |
| `check-for-update` | renderer→main handle | 更新检查（主动 invoke） |
| `execute-log` | main→renderer send | 打补丁日志推送 |

**注意**: 更新检查使用 `ipcMain.handle` request-reply 模式而非 push，因为 push 模式下主进程 fetch 可能早于 React 组件挂载，导致消息丢失。

### 构建产物

- `dist/` — Vite 打包的渲染进程
- `dist-electron/main/` — 主进程编译产物（ESM，`.js` 后缀）
- `dist-electron/preload/` — preload 编译产物
- `release/${version}/` — electron-builder 打包输出

每次 `npm run dev` 启动时会清空 `dist-electron/`。

### 开发模式判断

`process.env.VITE_DEV_SERVER_URL` 非空即为开发模式。开发模式下 `dist-electron/` 中的编译产物使用 `.js` 扩展名的 ESM 模块。

### 应用配置

- **单实例锁**: 已启用，重复启动自动退出
- **窗口**: 800×500，不可调整大小
- **版本号**: `app.getVersion()` 读取 `package.json` → `version`
- **打包**: asar 压缩，Win (NSIS) / Mac (DMG+zip)，不支持 Linux

## 注意事项

- `.npmrc` 使用国内镜像（electron、electron-builder-binaries），境外开发需移除
- CSS 使用 PostCSS nesting（`postcss.config.cjs`），非 Less/SCSS
- 路径别名 `@/` 映射到 `src/`
- `type/global.d.ts` 声明全局 `ExecParam` 接口
- `browserslist` 数据库可能过期，出现警告可忽略
- 隐藏功能（小地图全开、视距倍数、去除雾气、点亮环境）为彩蛋，仅在 `private` 远程仓库中保留，公开仓库不包含相关代码
