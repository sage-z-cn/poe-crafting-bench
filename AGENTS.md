# AGENTS.md

## 项目概述

POE Bench（流放工艺台）— Electron 桌面应用，用于给流放之路 1/2 打补丁、修改字体。依赖 [poe-bundle-lib](https://github.com/sage-z-cn/poe-bundle-lib) 实现 `Content.ggpk` / `_.index.bin` 的修改。

## Git 远程仓库

项目同时托管于两个平台，**推送时必须同时推送两个远程**：

```bash
git push origin main && git push gitee main
```

| 远程 | 地址 |
|------|------|
| `origin` | https://github.com/sage-z-cn/poe-crafting-bench.git |
| `gitee` | https://gitee.com/sage9731/poe-crafting-bench.git |

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
- 底部 footer 中间的 POE 风格文字是进入隐藏功能的彩蛋（点击 10 次），`SECRET_CLICK_TOTAL` 常量控制次数
