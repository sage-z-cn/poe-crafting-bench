import { app, dialog, shell, BrowserWindow } from 'electron'

const REMOTE_PACKAGE_URL = 'https://raw.giteeusercontent.com/sage9731/poe-crafting-bench/raw/main/package.json'

const DOWNLOAD_LINKS = [
  {
    label: '前往 Gitee 下载',
    url: 'https://gitee.com/sage9731/poe-crafting-bench/releases',
  },
  {
    label: '前往 GitHub 下载',
    url: 'https://github.com/sage-z-cn/poe-crafting-bench/releases',
  },
]

/**
 * 比较两个 semver 版本号，返回 1 / -1 / 0
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  const len = Math.max(partsA.length, partsB.length)

  for (let i = 0; i < len; i++) {
    const numA = partsA[i] || 0
    const numB = partsB[i] || 0
    if (numA > numB) return 1
    if (numA < numB) return -1
  }
  return 0
}

export async function checkForUpdate(win: BrowserWindow): Promise<void> {
  try {
    const response = await fetch(REMOTE_PACKAGE_URL)
    if (!response.ok) return

    const remotePkg = await response.json() as { version?: string }
    const remoteVersion = remotePkg?.version
    if (!remoteVersion) return

    const currentVersion = app.getVersion()

    if (compareVersions(remoteVersion, currentVersion) <= 0) return

    const result = await dialog.showMessageBox(win, {
      type: 'info',
      title: '发现新版本',
      message: `当前版本：${currentVersion}\n最新版本：${remoteVersion}`,
      detail: '请选择下载渠道获取最新版本。',
      buttons: [...DOWNLOAD_LINKS.map((l) => l.label), '忽略'],
      defaultId: 0,
      cancelId: DOWNLOAD_LINKS.length,
    })

    const idx = result.response
    if (idx >= 0 && idx < DOWNLOAD_LINKS.length) {
      shell.openExternal(DOWNLOAD_LINKS[idx].url)
    }
  } catch {
    // 网络请求失败静默忽略，不影响应用正常使用
  }
}
