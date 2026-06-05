# POE Bench · 流放工艺台

> 给流放之路 1 / 流放之路 2 游戏客户端打补丁、修改字体的桌面工具。

## 功能

### 基础功能

- **补丁安装** — 支持 .zip 格式补丁，直接写入 `Bundles2/` 目录
- **字体替换** — 一键修改游戏 UI 字体，支持系统已安装的任意字体
- **字体缩放** — 调整字体大小，适配不同分辨率

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Electron 33 |
| 构建工具 | Vite + vite-plugin-electron |
| 前端 | React 18 + TypeScript |
| UI 组件 | Ant Design 5 + Tailwind CSS 3 |
| 核心库 | [poe-bundle-lib](https://github.com/sage-z-cn/poe-bundle-lib) |
| 测试 | Vitest |

## 快速开始

```bash
# 安装依赖（必须加 --legacy-peer-deps）
npm install --legacy-peer-deps

# 启动开发
npm run dev

# 构建打包
npm run build

# 运行测试
npm run test
```

> 注意：`.npmrc` 默认使用国内镜像源，海外开发请先行移除。

## 项目结构

```
poe-crafting-bench/
├── electron/
│   ├── main/              # 主进程
│   │   ├── index.ts       # 窗口创建、IPC handler、单实例锁
│   │   ├── poe-patcher.ts # 核心打补丁逻辑
│   │   ├── game-utils.ts  # 游戏路径检测、字体枚举
│   │   └── update-checker.ts # 版本更新检查
│   └── preload/           # preload（contextBridge 暴露 IPC）
├── src/                   # 渲染进程
│   ├── main.tsx           # React 入口
│   ├── App.tsx            # 主应用（步骤式流程）
│   └── components/        # 各步骤组件
├── type/                  # 全局类型定义
├── test/                  # 测试用例
├── libs/                  # 打包需要的原生 DLL
└── dist-electron/         # 主进程编译产物（dev 时自动清空）
```

## 构建产物

| 目录 | 说明 |
|------|------|
| `dist/` | Vite 打包的渲染进程 |
| `dist-electron/main/` | 主进程（ESM，`.js` 后缀） |
| `dist-electron/preload/` | preload 脚本 |
| `release/${version}/` | electron-builder 打包输出（asar） |

## 免责声明

本工具开源免费，不含任何恶意代码，如有疑虑可自行查阅源码编译。修改游戏客户端存在封号风险，使用者自行承担后果。

## License

MIT
