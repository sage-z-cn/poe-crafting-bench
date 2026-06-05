import { app, BrowserWindow, shell, ipcMain, Menu, dialog } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { update } from './update'
import * as process from "node:process";
import { patchGame } from './poe-patcher.js';
import { getGameInstallPath, getInstalledFonts } from './game-utils.js';

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
export const IS_DEV = !!VITE_DEV_SERVER_URL;

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT, 'public')
    : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
    app.quit()
    process.exit(0)
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow() {
    win = new BrowserWindow({
        title: 'Main window',
        icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
        width: 800,
        height: 500,
        resizable: false,
        webPreferences: {
            preload,
            contextIsolation: true, // 必须启用上下文隔离
            nodeIntegration: false, // 禁用 Node.js 集成
            sandbox: true // 启用沙箱
        },
    })

    if (VITE_DEV_SERVER_URL) { // #298
        win.loadURL(VITE_DEV_SERVER_URL)
        // Open devTool if the app is not packaged
        win.webContents.openDevTools()

        // 创建自定义菜单
        const menuTemplate = [
            {
                label: '开发者工具',
                click: () => {
                    if (win) {
                        if (win.webContents.isDevToolsOpened()) {
                            win.webContents.closeDevTools();
                        } else {
                            win.webContents.openDevTools();
                        }
                    }
                },
                accelerator: 'F12' // 可选：添加快捷键
            },
            {
                label: '重载',
                click: () => {
                    if (win) {
                        win.reload();
                    }
                }
            }
        ];
        const menu = Menu.buildFromTemplate(menuTemplate);
        win.setMenu(menu);
    } else {
        win.setMenu(null);
        win.loadFile(indexHtml)
    }

    // Test actively push message to the Electron-Renderer
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', new Date().toLocaleString())
    })

    // Make all links open with the browser, not with the application
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https:')) shell.openExternal(url)
        return { action: 'deny' }
    })

    // Auto update
    update(win)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
    win = null
    if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
    if (win) {
        // Focus on the main window if the user tried to open another
        if (win.isMinimized()) win.restore()
        win.focus()
    }
})

app.on('activate', () => {
    const allWindows = BrowserWindow.getAllWindows()
    if (allWindows.length) {
        allWindows[0].focus()
    } else {
        createWindow()
    }
})


ipcMain.handle('open-game-file-dialog', async (_, arg) => {
    if (win) {
        const result = await dialog.showOpenDialog(win, {
            title: '选择 Bundles2/_.index.bin',
            filters: [
                {
                    name: '_.index.bin',
                    extensions: ['bin'],
                }
            ]
        });
        if (result.canceled) {
            return null;
        }
        return result.filePaths[0];
    }
    return null;
});

ipcMain.handle('open-patch-file-dialog', async (_, arg) => {
    if (win) {
        const result = await dialog.showOpenDialog(win, {
            title: '选择补丁',
            filters: [
                {
                    name: '压缩包',
                    extensions: ['zip'],
                }
            ],
            properties: ['openFile', 'multiSelections']
        });
        if (result.canceled) {
            return null;
        }
        return result.filePaths;
    }
    return null;
});

ipcMain.handle('get-game-install-path', async (_, arg) => {
    const { version, platform } = arg;
    return (await getGameInstallPath(version, platform)) ?? '';
});

ipcMain.handle('get-installed-fonts', async () => {
    return await getInstalledFonts();
});

ipcMain.handle('open-external', (_, url: string): void => {
    shell.openExternal(url);
})

ipcMain.handle('patch', async (_, arg: ExecParam) => {
    console.log(arg);
    const { path, patch, font, fontSizeDelta, removeFog, minimapVisibility, cameraZoom, lightUp } = arg;

    const sendLog = (msg: string) => {
        win?.webContents.send('execute-log', msg);
    };

    const code = await patchGame({
        path,
        patch,
        font,
        fontSizeDelta,
        minimapVisibility,
        removeFog,
        cameraZoom,
        lightUp,
    }, sendLog);

    return code;
});