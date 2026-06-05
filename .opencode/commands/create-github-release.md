---
description: 使用 gh CLI 创建 GitHub Release，上传安装包和便携版
---

# Create Release

使用 GitHub CLI (`gh`) 创建新 Release，自动上传 NSIS 安装包和便携版 zip 作为附件。

## 执行步骤

### 1. 读取版本号

读取 `package.json` 的 `version` 字段作为当前版本号。

如果用户在命令中指定了参数（如 `/create-release 1.0.0`），则使用参数值作为 `$version` 覆盖 package.json 中的版本号。

### 2. 验证构建产物

确认 `release/{version}/` 目录下存在以下内容：

- `poe-bench_{version}.exe` — NSIS 安装包
- `win-unpacked/` — 便携版目录（electron-builder 解包产物）

如任一缺失，提示用户先执行 `npm run build` 构建项目。

### 3. 压缩便携版

检查便携版 zip 是否已存在，不存在则从 `win-unpacked/` 目录压缩创建。

文件名格式：`poe-bench_portable_{version}.zip`，输出到 `release/{version}/` 目录。

使用 PowerShell `Compress-Archive`，压缩级别 `Optimal`，压缩 `win-unpacked/` 下的所有文件（不包含 `win-unpacked` 目录本身）。

### 4. 提取 Release Notes

从 `CHANGELOG.md` 中读取对应版本的更新日志：

```powershell
$changelog = Get-Content "CHANGELOG.md" -Raw -Encoding utf8
$section = if ($changelog -match "## v$version\s*\n([\s\S]*?)(?=\n## v|\z)") {
    $matches[1].Trim()
} else {
    throw "CHANGELOG.md 中未找到 v$version 的更新日志"
}
```

#### 4.1 创建 Release

将提取的 Release Notes 写入临时文件，然后创建 Release：

```powershell
$notes = $section

# 添加附件说明
$notes += @"

---

> **下载说明**  
> `.exe` 为 NSIS 安装包（推荐），`.zip` 为免安装便携版。
"@

$tempFile = New-TemporaryFile
$notes | Set-Content -LiteralPath $tempFile -Encoding utf8NoBOM

gh release create "v{version}" `
    "release/{version}/poe-bench_{version}.exe" `
    "release/{version}/poe-bench_portable_{version}.zip" `
    --title "v{version}" `
    --notes-file $tempFile

Remove-Item -LiteralPath $tempFile
```

- Tag 和标题均使用 `v{version}` 格式（如 `v2.0.0`）
- Release Notes 直接取自 `CHANGELOG.md` 对应版本节
- 附件同时上传安装包和便携版 zip

### 5. 确认结果

执行成功后，输出 Release URL（格式：`https://github.com/sage-z-cn/poe-crafting-bench/releases/tag/v{version}`）。
