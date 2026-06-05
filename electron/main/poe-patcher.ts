import { Index, FileRecord } from 'poe-bundle-lib';
import AdmZip from 'adm-zip';
import path from 'node:path';
import fs from 'node:fs';

// ─── 需要修改的文件路径 ───────────────────────────────────────

const UI_SETTING_PATHS = [
  'metadata/ui/uisettings.xml',
  'metadata/ui/uisettings.console.xml',
  'metadata/ui/uisettings.tencent.xml',
  'metadata/ui/uisettings.tencent.console.xml',
  'metadata/ui/uisettings.traditional chinese.xml',
];

const MINIMAP_VISIBILITY_PIXEL_PATH = 'shaders/minimap_visibility_pixel.hlsl';

const CAMERA_ZOOM_NODE_PATH = 'metadata/characters/character.ot';

// ─── 正则 ──────────────────────────────────────────────────────

const ENVIRONMENT_SETTINGS_REGEX = /environmentsettings\/.*\.env$/;

const TYPEFACE_REGEX = /typeface=".*?"/;
const FONT_SIZE_REGEX = /size="(\d+)"/;
const FONTS_REGEX = /fonts=".*?"/;

const REMOVE_FOG_REGEX = /"(fog|area|water|post_transform)"/gi;
const RESTORE_FOG_REGEX = /"#+(fog|area|water|post_transform)#+"/gi;

// ─── 类型 ──────────────────────────────────────────────────────

export interface PatchOptions {
  path: string;                        // _.index.bin 文件路径
  patch?: string[];                    // ZIP 补丁文件路径列表
  font?: string;                       // 字体名称
  fontSizeDelta?: number;              // 字体大小增量
  minimapVisibility?: boolean;         // 小地图全开
  removeFog?: boolean;                 // 去雾
  cameraZoom?: number;                 // 视距倍数
  lightUp?: number;                    // 点亮环境
}

// ─── 主入口 ───────────────────────────────────────────────────

export async function patchGame(opts: PatchOptions, onLog: (msg: string) => void): Promise<number> {
  const indexPath = opts.path;
  let index: Index | null = null;
  let disposed = false;

  try {
    onLog(`正在读取 ${indexPath}`);
    index = new Index(indexPath, { parsePaths: false });

    // ── 应用补丁 ──
    if (opts.patch && opts.patch.length > 0) {
      const gameRoot = path.dirname(path.dirname(indexPath)); // Bundles2/ 的父目录 = 游戏根目录

      for (const patchPath of opts.patch) {
        if (!fs.existsSync(patchPath)) {
          onLog(`补丁 ${patchPath} 不存在，已跳过`);
          continue;
        }

        const patchName = path.basename(patchPath);
        onLog(`正在安装补丁 ${patchName}`);

        try {
          const zip = new AdmZip(patchPath);
          // Bundles2 补丁：直接解压到游戏根目录覆盖 bundle 文件
          zip.extractAllTo(gameRoot, true);
          onLog(`补丁 ${patchName} 应用成功`);
        } catch (e: any) {
          onLog(`补丁 ${patchName} 应用失败: ${e.message}`);
          throw e; // 重新抛出以让外层 catch 处理资源清理
        }
      }

      // 补丁覆盖了 bundle 文件，需要重新加载 index
      index.Dispose();
      disposed = true;
    }

    // ── 检查是否需要做 UI 修改 ──
    const fontIsEmpty = !opts.font || opts.font.trim() === '';
    const hasFontSizeDelta = opts.fontSizeDelta != null && opts.fontSizeDelta !== 0;
    const whetherModifyUiSetting = !fontIsEmpty || hasFontSizeDelta;

    if (whetherModifyUiSetting ||
        opts.minimapVisibility != null ||
        opts.cameraZoom != null ||
        opts.removeFog != null ||
        opts.lightUp != null) {

      // 如果尚未 dispose，则 dispose 后重新打开（确保数据一致）
      if (disposed) {
        index = new Index(indexPath, { parsePaths: false });
        disposed = false;
      }

      // 解析文件路径（将 hash 转为实际路径字符串）
      const failedCount = index.ParsePaths();
      if (failedCount > 0) {
        onLog(`警告: ${failedCount} 个文件路径解析失败`);
      }

      const files = index.Files;

      // ── 遍历所有文件，应用修改 ──
      for (const [, fileRecord] of files) {
        const filePath = fileRecord.Path;
        if (!filePath) continue;

        // ── 字体 & 字体大小修改 ──
        if (whetherModifyUiSetting && UI_SETTING_PATHS.includes(filePath)) {
          onLog(`正在应用字体到 ${filePath} ...`);
          processUiSettings(fileRecord, opts.font || '', opts.fontSizeDelta, onLog);
        }

        // ── 小地图全开 ──
        if (opts.minimapVisibility != null && MINIMAP_VISIBILITY_PIXEL_PATH === filePath) {
          processMinimapVisibility(fileRecord, opts.minimapVisibility, onLog);
        }

        // ── 去雾 & 点亮环境 ──
        if ((opts.removeFog != null || opts.lightUp != null) && ENVIRONMENT_SETTINGS_REGEX.test(filePath)) {
          processEnvironmentSettings(fileRecord, opts.removeFog, opts.lightUp, filePath, onLog);
        }

        // ── 视距倍数 ──
        if (opts.cameraZoom != null && CAMERA_ZOOM_NODE_PATH === filePath) {
          processCameraZoom(fileRecord, opts.cameraZoom, onLog);
        }
      }

      // 保存修改
      onLog('正在保存修改...');
      index.Save();
    }

    onLog('执行结束');
    return 0;

  } catch (e: any) {
    onLog(`执行过程中出错：${e.message}`);
    console.error(e);
    return 1;
  } finally {
    if (!disposed) {
      index?.Dispose();
    }
  }
}

// ─── 字体修改 ─────────────────────────────────────────────────

function processUiSettings(fileRecord: FileRecord, font: string, fontSizeDelta: number | undefined, onLog: (msg: string) => void): void {
  const bytes = fileRecord.Read();
  const encoding: BufferEncoding = 'utf16le';
  const fileContent = bytes.toString(encoding);

  const lines = fileContent.split('\r\n');
  let modified = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line.trim().startsWith('<Font') && line.includes('typeface')) {
      // 替换 typeface
      if (font) {
        const newLine = line.replace(TYPEFACE_REGEX, `typeface="${font}"`);
        if (newLine !== line) {
          line = newLine;
          modified = true;
        }
      }

      // 调整字体大小
      if (fontSizeDelta != null && fontSizeDelta !== 0) {
        const match = line.match(FONT_SIZE_REGEX);
        if (match) {
          const fontSize = parseInt(match[1], 10);
          if (!isNaN(fontSize)) {
            const newSize = fontSize + fontSizeDelta;
            const newLine = line.replace(FONT_SIZE_REGEX, `size="${newSize}"`);
            if (newLine !== line) {
              line = newLine;
              modified = true;
            }
          }
        }
      }
    } else if (font && line.trim().startsWith('<FallbackFont')) {
      if (line.includes('ranges="CJK"')) {
        const newLine = line.replace(FONTS_REGEX,
          `fonts="${font},Noto Sans CJK TC,Spoqa Han Sans Neo,Simsun,PMinglu,Gulim,MS UI Gothic,Microsoft JhengHei"`);
        if (newLine !== line) {
          line = newLine;
          modified = true;
        }
      } else if (line.includes('ranges="Any"')) {
        const newLine = line.replace(FONTS_REGEX,
          `fonts="${font},Noto Sans CJK TC,Microsoft Sans Serif,Arial,MS UI Gothic,Nirmala UI,Gautami,Microsoft Himalaya,Lao UI,Mangal,Shruti,Euphemia,Gadugi,Marlett,Webdings,Wingdings"`);
        if (newLine !== line) {
          line = newLine;
          modified = true;
        }
      }
    }

    lines[i] = line;
  }

  if (modified) {
    const newContent = lines.join('\r\n');
    const outBytes = Buffer.from(newContent, encoding);
    fileRecord.Write(outBytes);
  }
}

// ─── 小地图全开 ──────────────────────────────────────────────

function processMinimapVisibility(fileRecord: FileRecord, enabled: boolean, onLog: (msg: string) => void): void {
  const bytes = fileRecord.Read();
  const encoding: BufferEncoding = 'utf8';
  let fileContent = bytes.toString(encoding);
  let modified = false;

  if (enabled) {
    onLog('正在顾全大局...');
    if (!fileContent.includes('return max(res_color.r, 0.15f);')) {
      fileContent = fileContent.replace('return res_color;', 'return max(res_color.r, 0.15f);');
      modified = true;
    }
  } else {
    onLog('正在目光短浅...');
    const restored = fileContent.replace(/return max\(res_color\.r, \d+(\.\d+)?f\);/g, 'return res_color;');
    if (restored !== fileContent) {
      fileContent = restored;
      modified = true;
    }
  }

  if (modified) {
    const outBytes = Buffer.from(fileContent, encoding);
    fileRecord.Write(outBytes);
  }
}

// ─── 去雾 & 点亮环境 ─────────────────────────────────────────

function processEnvironmentSettings(
  fileRecord: FileRecord,
  removeFog: boolean | undefined,
  lightUp: number | undefined,
  filePath: string,
  onLog: (msg: string) => void
): void {
  let bytes = fileRecord.Read();
  const encoding: BufferEncoding = 'utf16le';
  let fileContent = bytes.toString(encoding);
  let modified = false;

  // ── 去雾 ──
  if (removeFog != null) {
    if (removeFog) {
      onLog('正在驱散迷雾... ' + filePath);
      const prev = fileContent;
      fileContent = fileContent.replace(REMOVE_FOG_REGEX, '"#$1#"');
      if (fileContent !== prev) modified = true;
    } else {
      onLog('正在步入迷雾... ' + filePath);
      const prev = fileContent;
      fileContent = fileContent.replace(RESTORE_FOG_REGEX, '"$1"');
      if (fileContent !== prev) modified = true;
    }
  }

  // ── 点亮环境 ──
  if (lightUp != null) {
    let clampedLightUp = Math.max(0, Math.min(lightUp, 3));

    try {
      // 处理 BOM
      let bom = '';
      if (fileContent.length > 0 && fileContent.charCodeAt(0) === 0xFEFF) {
        bom = '\uFEFF';
        fileContent = fileContent.substring(1);
      }

      const jsonObj = JSON.parse(fileContent);

      if (jsonObj.directional_light && typeof jsonObj.directional_light.multiplier === 'number') {
        const dirLight = jsonObj.directional_light;

        // 备份原始乘数
        if (dirLight.original_multiplier === undefined) {
          dirLight.original_multiplier = dirLight.multiplier;
        }

        const originalMultiplier = dirLight.original_multiplier as number;

        if (clampedLightUp > 0) {
          if (clampedLightUp > originalMultiplier) {
            onLog('正在点亮环境...' + filePath);
            dirLight.multiplier = clampedLightUp;
            modified = true;
          }
        } else {
          if (dirLight.original_multiplier !== undefined) {
            onLog('正在复原光亮...' + filePath);
            dirLight.multiplier = originalMultiplier;
            modified = true;
          }
        }
      }

      if (modified) {
        fileContent = bom + JSON.stringify(jsonObj, null, 2);
      }
    } catch {
      onLog(`警告: ${filePath} 不是有效的JSON格式，跳过光照调节`);
    }
  }

  if (modified) {
    const outBytes = Buffer.from(fileContent, encoding);
    fileRecord.Write(outBytes);
  }
}

// ─── 视距倍数 ─────────────────────────────────────────────────

function processCameraZoom(fileRecord: FileRecord, cameraZoom: number, onLog: (msg: string) => void): void {
  const bytes = fileRecord.Read();
  const encoding: BufferEncoding = 'utf16le';
  const fileContent = bytes.toString(encoding);
  const lines = fileContent.split('\r\n');

  // 限制范围
  let zoom = Math.max(1, Math.min(3, cameraZoom));

  const teamIndex = lines.findIndex(line => line.includes('team = 1'));
  if (teamIndex < 0) return;

  const insertIndex = teamIndex + 1;
  const script = `on_initial_position_set = {CreateCameraZoomNode(1000000000.0f, 1000000000.0f, ${zoom}f);}`;

  onLog('正在调整焦距 x' + zoom + '...');

  if (insertIndex < lines.length && lines[insertIndex].includes('CreateCameraZoomNode')) {
    lines[insertIndex] = script;
  } else {
    lines.splice(insertIndex, 0, script);
  }

  const newContent = lines.join('\r\n');
  const outBytes = Buffer.from(newContent, encoding);
  fileRecord.Write(outBytes);
}
