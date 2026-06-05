import { app, ipcMain } from 'electron'

const REMOTE_PACKAGE_URL = 'https://raw.giteeusercontent.com/sage9731/poe-crafting-bench/raw/main/package.json'

const DOWNLOAD_LINKS = [
  {
    label: '前往 Gitee 下载 (推荐)',
    url: 'https://gitee.com/sage9731/poe-crafting-bench/releases',
  },
  {
    label: '前往 GitHub 下载',
    url: 'https://github.com/sage-z-cn/poe-crafting-bench/releases',
  },
]

export interface UpdateInfo {
  currentVersion: string
  remoteVersion: string
  downloadLinks: typeof DOWNLOAD_LINKS
}

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

export function registerUpdateChecker() {
  ipcMain.handle('check-for-update', async (): Promise<UpdateInfo | null> => {
    console.log('[update-checker] 开始检查更新...')

    try {
      const response = await fetch(REMOTE_PACKAGE_URL)
      console.log('[update-checker] fetch 状态:', response.status, response.ok)

      if (!response.ok) {
        console.log('[update-checker] fetch 失败，状态码异常')
        return null
      }

      const remotePkg = await response.json() as { version?: string }
      const remoteVersion = remotePkg?.version
      console.log('[update-checker] 远程版本:', remoteVersion)

      if (!remoteVersion) {
        console.log('[update-checker] 远程 package.json 无 version 字段')
        return null
      }

      const currentVersion = app.getVersion()
      console.log('[update-checker] 本地版本 (app.getVersion):', currentVersion)

      const cmp = compareVersions(remoteVersion, currentVersion)
      console.log('[update-checker] 版本比较结果 (remote vs local):', cmp)

      if (cmp <= 0) {
        console.log('[update-checker] 已是最新版本，无需更新')
        return null
      }

      console.log('[update-checker] 发现新版本，返回更新信息')
      return { currentVersion, remoteVersion, downloadLinks: DOWNLOAD_LINKS }
    } catch (err) {
      console.error('[update-checker] 检查更新异常:', err)
      return null
    }
  })
}
