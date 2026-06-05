import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

/** PowerShell 命令前缀：强制控制台输出编码为 UTF-8 */
const PS_UTF8_PREFIX = '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new();'

/**
 * 异步执行 PowerShell 脚本，返回 stdout 字符串。
 * 使用 execFile 避免阻塞 Electron 主进程事件循环。
 */
function execPowershell(script: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('powershell', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
      `${PS_UTF8_PREFIX}${script}`
    ], { encoding: 'utf8', timeout }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

/**
 * 获取系统已安装的字体族名称列表。
 * 通过 PowerShell 调用 System.Drawing 获取。
 */
export async function getInstalledFonts(): Promise<string[]> {
  try {
    const psScript = [
      'Add-Type -AssemblyName System.Drawing',
      '$fc = New-Object System.Drawing.Text.InstalledFontCollection',
      '$fc.Families | ForEach-Object { $_.Name } | ConvertTo-Json -Compress',
    ].join('; ');

    const result = (await execPowershell(psScript, 10000)).trim();

    if (!result || result === '[]') return [];
    return JSON.parse(result) as string[];
  } catch (e) {
    console.error('获取字体列表失败:', e);
    return [];
  }
}

/**
 * 通过注册表查询游戏安装路径。
 * @param version - 游戏版本: 1 = POE1, 2 = POE2
 * @param platform - 平台: TENCENT | GGG
 * @returns 游戏 Bundles2/_.index.bin 的完整路径，找不到返回 null
 */
export async function getGameInstallPath(version: number, platform: string): Promise<string | null> {
  let regPath: string;
  let valueName: string;

  switch (platform) {
    case 'TENCENT':
      if (version === 1) {
        regPath = 'HKCU:\\Software\\Tencent\\流放之路';
      } else {
        regPath = 'HKCU:\\Software\\Rail\\Game2002052';
      }
      valueName = 'InstallPath';
      break;

    case 'GGG':
      regPath = version === 1
        ? 'HKCU:\\Software\\GrindingGearGames\\Path of Exile'
        : 'HKCU:\\Software\\GrindingGearGames\\Path of Exile 2';
      valueName = 'InstallLocation';
      break;

    default:
      return null;
  }

  try {
    const psScript = `Get-ItemProperty -Path "${regPath}" -Name "${valueName}" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ${valueName}`;

    const output = await execPowershell(psScript, 5000);

    const installPath = output.trim();
    if (!installPath) return null;

    // 确保路径以分隔符结尾
    const normalized = installPath.endsWith(path.sep) ? installPath : installPath + path.sep;

    // 查找 Bundles2/_.index.bin
    const indexBin = normalized + 'Bundles2\\_.index.bin';
    if (fs.existsSync(indexBin)) {
      return indexBin;
    }

    return null;
  } catch {
    return null;
  }
}
