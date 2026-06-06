import { Index, FileRecord, BundledGGPK, GGPK, TreeNode } from 'poe-bundle-lib';
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

// ─── 正则 ──────────────────────────────────────────────────────

const TYPEFACE_REGEX = /typeface=".*?"/;
const FONT_SIZE_REGEX = /size="(\d+)"/;
const FONTS_REGEX = /fonts=".*?"/;

// ─── 类型 ──────────────────────────────────────────────────────

export interface PatchOptions {
  path: string;                        // 游戏文件路径 (Content.ggpk 或 _.index.bin)
  patch?: string[];                    // ZIP 补丁文件路径列表
  font?: string;                       // 字体名称
  fontSizeDelta?: number;              // 字体大小增量
}

/**
 * GGPK 的 FileRecord 最小接口 — 避免跨模块导入问题。
 */
interface GGPKFileRecord {
  read(): Buffer;
  write(newContent: Buffer, hash?: Buffer): void;
  name: string;
}
interface FileAccess {
  Read(): Buffer;
  Write(newContent: Buffer): void;
  Path: string | null;
}

// ─── 格式类型 ─────────────────────────────────────────────────

type GameFormat = 'index' | 'bundled-ggpk' | 'plain-ggpk';

/**
 * 根据文件路径检测格式类型。
 */
function detectFormat(filePath: string): 'ggpk' | 'index' {
  return filePath.toLowerCase().endsWith('.ggpk') ? 'ggpk' : 'index';
}

/**
 * 将 GGPK 的 FileRecord 包装为统一的 FileAccess 接口。
 */
function wrapGGPKFile(fr: GGPKFileRecord, filePath: string): FileAccess {
  return {
    Read: () => fr.read(),
    Write: (data: Buffer) => fr.write(data),
    Path: filePath,
  };
}

// ─── 主入口 ───────────────────────────────────────────────────

export async function patchGame(opts: PatchOptions, onLog: (msg: string) => void): Promise<number> {
  const gamePath = opts.path;
  const rawFormat = detectFormat(gamePath);
  let format: GameFormat = rawFormat === 'index' ? 'index' : 'bundled-ggpk'; // 初始假设
  let index: Index | null = null;
  let ggpk: BundledGGPK | null = null;
  let plainGGPK: GGPK | null = null;
  let disposed = false;

  try {
    onLog(`正在读取 ${gamePath}`);

    if (rawFormat === 'ggpk') {
      try {
        // 首先尝试 BundledGGPK（Content.ggpk 内含有 Bundles2/_.index.bin）
        ggpk = new BundledGGPK(gamePath, false);
        index = ggpk.Index;
        format = 'bundled-ggpk';
        onLog('检测到 Bundled GGPK 格式 (内含 Bundles2/_.index.bin)');
      } catch (e: any) {
        if (e.message?.includes('Bundles2')) {
          // 不包含 Bundles2 → 回退到纯 GGPK 模式
          onLog('未检测到 Bundles2 目录，使用纯 GGPK 模式');
          plainGGPK = new GGPK(gamePath);
          format = 'plain-ggpk';
        } else {
          throw e;
        }
      }
    } else {
      index = new Index(gamePath, { parsePaths: false });
      format = 'index';
    }

    // ── 应用补丁 ──
    if (opts.patch && opts.patch.length > 0) {
      if (format === 'bundled-ggpk') {
        // Bundled GGPK 格式：补丁写入 GGPK 内部
        for (const patchPath of opts.patch) {
          if (!fs.existsSync(patchPath)) {
            onLog(`补丁 ${patchPath} 不存在，已跳过`);
            continue;
          }
          const patchName = path.basename(patchPath);
          onLog(`正在安装补丁 ${patchName} 到 GGPK ...`);
          try {
            const zip = new AdmZip(patchPath);
            const allEntries = zip.getEntries().map(e => ({
              fullName: e.entryName,
              getData: () => e.getData(),
            }));

            // 分离束文件条目（Bundles2/*.bundle.bin）与内容文件条目
            const bundleEntries: typeof allEntries = [];
            const contentEntries: typeof allEntries = [];
            for (const entry of allEntries) {
              if (entry.fullName.endsWith('/')) continue;
              if (entry.fullName.startsWith('Bundles2/')) {
                bundleEntries.push(entry);
              } else {
                contentEntries.push(entry);
              }
            }

            let totalCount = 0;

            // 处理内容文件：通过 Index 替换
            if (contentEntries.length > 0) {
              const count = Index.ReplaceFromEntries(index!, contentEntries, (fr, name) => {
                onLog(`  ${name}`);
                return false;
              });  // saveIndex 默认 true，自动调用 index.Save()
              totalCount += count;
            }

            // 处理束文件：直接写入 GGPK 的 Bundles2 目录
            if (bundleEntries.length > 0) {
              const bundles2 = ggpk!.root.findByName('Bundles2');
              if (bundles2 && 'findOrAddFile' in bundles2) {
                for (const entry of bundleEntries) {
                  // 去掉 "Bundles2/" 前缀，因为 bundles2 节点已在该路径层级
                  const relPath = entry.fullName.substring('Bundles2/'.length);
                  const data = entry.getData();
                  const { record: file, added } = (bundles2 as any).findOrAddFile(relPath, data.length);
                  file.write(data);
                  onLog(`  ${added ? '添加' : '替换'}: Bundles2/${relPath}`);
                  totalCount++;
                }
              } else {
                onLog(`  警告: 未找到 GGPK 内 Bundles2 目录，跳过 ${bundleEntries.length} 个束文件`);
                for (const entry of bundleEntries) {
                  onLog(`    跳过: ${entry.fullName}`);
                }
              }
            }

            onLog(`补丁 ${patchName} 应用成功 (${totalCount} 个文件)`);
          } catch (e: any) {
            onLog(`补丁 ${patchName} 应用失败: ${e.message}`);
            throw e;
          }
        }
        ggpk?.Dispose();
        disposed = true;
      } else if (format === 'plain-ggpk') {
        // 纯 GGPK 格式：使用 GGPK.replaceFromZipEntries 写入
        for (const patchPath of opts.patch) {
          if (!fs.existsSync(patchPath)) {
            onLog(`补丁 ${patchPath} 不存在，已跳过`);
            continue;
          }
          const patchName = path.basename(patchPath);
          onLog(`正在安装补丁 ${patchName} 到 GGPK ...`);
          try {
            const zip = new AdmZip(patchPath);
            const entries = zip.getEntries().map(e => ({
              fullName: e.entryName,
              getData: () => e.getData(),
            }));
            const count = GGPK.replaceFromZipEntries(plainGGPK!.root, entries, (fr, name, added) => {
              onLog(`  ${added ? '添加' : '替换'}: ${name}`);
              return false;
            }, true);
            onLog(`补丁 ${patchName} 应用成功 (${count} 个文件)`);
          } catch (e: any) {
            onLog(`补丁 ${patchName} 应用失败: ${e.message}`);
            throw e;
          }
        }
        // 纯 GGPK 不需要重新打开，写入是即时生效的
      } else {
        // _.index.bin 格式：直接解压补丁到游戏根目录
        const gameRoot = path.dirname(path.dirname(gamePath));
        for (const patchPath of opts.patch) {
          if (!fs.existsSync(patchPath)) {
            onLog(`补丁 ${patchPath} 不存在，已跳过`);
            continue;
          }
          const patchName = path.basename(patchPath);
          onLog(`正在安装补丁 ${patchName}`);
          try {
            const zip = new AdmZip(patchPath);
            zip.extractAllTo(gameRoot, true);
            onLog(`补丁 ${patchName} 应用成功`);
          } catch (e: any) {
            onLog(`补丁 ${patchName} 应用失败: ${e.message}`);
            throw e;
          }
        }
        index?.Dispose();
        disposed = true;
      }
    }

    // ── 检查是否需要做 UI 修改 ──
    const fontIsEmpty = !opts.font || opts.font.trim() === '';
    const hasFontSizeDelta = opts.fontSizeDelta != null && opts.fontSizeDelta !== 0;
    const whetherModifyUiSetting = !fontIsEmpty || hasFontSizeDelta;

    if (whetherModifyUiSetting) {

      // 如果 dispose 了需要重新打开
      if (disposed) {
        if (format === 'bundled-ggpk') {
          ggpk = new BundledGGPK(gamePath, false);
          index = ggpk.Index;
        } else if (format === 'plain-ggpk') {
          plainGGPK = new GGPK(gamePath);
        } else {
          index = new Index(gamePath, { parsePaths: false });
        }
        disposed = false;
      }

      if (format === 'plain-ggpk') {
        // ── 纯 GGPK 模式：遍历 GGPK 文件树 ──
        // 注意：GGPK 中路径保留原始大小写，需做大小写不敏感匹配
        const uiSettingMatches = UI_SETTING_PATHS.map(p => p.toLowerCase());

        let fileCount = 0;
        let matchedCount = 0;
        const samplePaths: string[] = [];

        for (const [fr, relPath] of TreeNode.recurseFiles(plainGGPK!.root)) {
          fileCount++;
          // 收集前 20 条路径样本用于诊断
          if (samplePaths.length < 20) {
            samplePaths.push(relPath);
          }
          const lowerPath = relPath.replace(/^\/+/, '').toLowerCase();
          const f = wrapGGPKFile(fr, relPath);

          let fileMatched = false;
          if (whetherModifyUiSetting && uiSettingMatches.includes(lowerPath)) {
            onLog(`正在应用字体到 ${relPath} ...`);
            processUiSettings(f, opts.font || '', opts.fontSizeDelta, onLog);
            fileMatched = true;
          }
          if (fileMatched) matchedCount++;
        }

        onLog(`遍历完成: 共 ${fileCount} 个文件，命中 ${matchedCount} 个`);
        if (samplePaths.length > 0) {
          onLog(`路径样本: ${samplePaths.join(', ')}`);
        }

        // 诊断：检查是否包含 metadata 目录
        const hasMetadataDir = samplePaths.some(p => p.toLowerCase().includes('metadata'));
        if (fileCount > 0 && matchedCount === 0) {
          onLog('警告: 未找到任何需要修改的文件');
          if (!hasMetadataDir) {
            onLog('  此 GGPK 中未找到 metadata 目录，UI 配置文件可能在 Bundles2/_.index.bin 中');
            onLog('  建议: 选择游戏目录下的 Bundles2\\_.index.bin 文件代替 Content.ggpk');
          } else {
            onLog(`  期望的 UI 文件: ${UI_SETTING_PATHS.join(', ')}`);
          }
        }
        onLog('正在保存修改...');
        // 纯 GGPK 写入是即时生效的，dispose() 会调用 renewHashes() 保留根哈希以阻止游戏回滚
      } else {
        // ── Index 模式（bundled-ggpk 或 index）：遍历 Index.Files ──
        const failedCount = index!.ParsePaths();
        if (failedCount > 0) {
          onLog(`警告: ${failedCount} 个文件路径解析失败`);
        }

        const files = index!.Files;

        for (const [, fileRecord] of files) {
          const filePath = fileRecord.Path;
          if (!filePath) continue;

          if (whetherModifyUiSetting && UI_SETTING_PATHS.includes(filePath)) {
            onLog(`正在应用字体到 ${filePath} ...`);
            processUiSettings(fileRecord, opts.font || '', opts.fontSizeDelta, onLog);
          }
        }
        onLog('正在保存修改 (Index.Save)...');
        try {
          index!.Save();
          onLog('Index.Save 完成');
          if (ggpk) {
            onLog('正在写回 _.index.bin 到 GGPK...');
            ggpk.saveIndex();
            onLog('写回 _.index.bin 完成');
          }
        } catch (e: any) {
          onLog(`保存失败: ${e.message}`);
          onLog(`堆栈: ${e.stack}`);
          throw e;
        }
      }
    }

    onLog('执行结束');
    return 0;

  } catch (e: any) {
    onLog(`执行过程中出错：${e.message}`);
    console.error(e);
    return 1;
  } finally {
    if (!disposed) {
      ggpk?.Dispose();
      index?.Dispose();
      plainGGPK?.dispose();
    }
  }
}

// ─── 字体修改 ─────────────────────────────────────────────────

function processUiSettings(f: FileAccess, font: string, fontSizeDelta: number | undefined, onLog: (msg: string) => void): void {
  const bytes = f.Read();
  const encoding: BufferEncoding = 'utf16le';
  const fileContent = bytes.toString(encoding);

  const lines = fileContent.split('\r\n');
  let modified = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line.trim().startsWith('<Font') && line.includes('typeface')) {
      if (font) {
        const newLine = line.replace(TYPEFACE_REGEX, `typeface="${font}"`);
        if (newLine !== line) {
          line = newLine;
          modified = true;
        }
      }
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
    f.Write(outBytes);
  }
}
