---
description: 使用 Gitee API 创建 Release，上传安装包和便携版
---

# Create Gitee Release

使用 REST API 在 Gitee 创建新 Release，自动上传 NSIS 安装包和便携版 zip 作为附件。

## 执行步骤

### 0. 检查 Token

检查当前环境是否存在 `GITEE_ACCESS_TOKEN` 环境变量：

```powershell
$env:GITEE_ACCESS_TOKEN
```

如果变量为空或不存在，使用 **question** 工具向用户询问 Token：

```
question: "请提供 Gitee 私人令牌（在 https://gitee.com/profile/personal_access_tokens 生成，需勾选 projects 权限）"
```

获取到 Token 后，在当前 PowerShell 会话中设置：

```powershell
$env:GITEE_ACCESS_TOKEN = "用户提供的Token"
```

### 1. 读取版本号

读取 `package.json` 的 `version` 字段作为当前版本号。

如果用户在命令中指定了参数（如 `/create-gitee-release 2.0.0`），则使用参数值作为 `$version` 覆盖 package.json 中的版本号。

### 2. 验证构建产物

确认 `release/{version}/` 目录下存在以下内容：

- `poe-bench_{version}.exe` — NSIS 安装包
- `win-unpacked/` — 便携版目录

如任一缺失，提示用户先执行 `npm run build` 构建项目。

### 3. 压缩便携版

检查便携版 zip 是否已存在，不存在则从 `win-unpacked/` 目录压缩创建。

文件名格式：`poe-bench_portable_{version}.zip`，输出到 `release/{version}/` 目录。

使用 PowerShell `Compress-Archive`，压缩级别 `Optimal`，压缩 `win-unpacked/` 下的所有文件（不包含 `win-unpacked` 目录本身）。

### 4. 提取 Release Notes

从 `CHANGELOG.md` 中读取对应版本的更新日志：

```powershell
$changelog = Get-Content "CHANGELOG.md" -Raw -Encoding utf8
$notes = if ($changelog -match "## v$version\s*\n([\s\S]*?)(?=\n## v|\z)") {
    $matches[1].Trim()
} else {
    throw "CHANGELOG.md 中未找到 v$version 的更新日志"
}

# 添加下载指引
$notes += @"

---

> **下载说明**  
> 请在页面底部「附件」区域下载 `.exe` 安装包，勿下载上方的 Source code 源码压缩包。便携版请前往 [GitHub](https://github.com/sage-z-cn/poe-crafting-bench/releases) 下载。
"@
```

### 5. 创建 Gitee Release 并上传附件

Gitee CLI 不支持直接上传文件，需通过 REST API 分两步完成：

#### 5.1 创建 Release

```powershell
$owner = "sage9731"
$repo = "poe-crafting-bench"
$tag = "v{version}"

$body = @{
    access_token = $env:GITEE_ACCESS_TOKEN
    tag_name = $tag
    name = $tag
    body = $notes
    target_commitish = "main"
    prerelease = $false
}

$release = Invoke-RestMethod -Uri "https://gitee.com/api/v5/repos/$owner/$repo/releases" `
    -Method Post -Body $body
Write-Host "Release 创建成功，ID: $($release.id)"
```

#### 5.2 上传附件

```powershell
$releaseId = $release.id
$file = "release/{version}/poe-bench_{version}.exe"

$fileName = Split-Path $file -Leaf
Invoke-RestMethod `
    -Uri "https://gitee.com/api/v5/repos/$owner/$repo/releases/$releaseId/attach_files" `
    -Method Post `
    -Form @{
        access_token = $env:GITEE_ACCESS_TOKEN
        file = Get-Item $file
    }
Write-Host "已上传: $fileName"
```

> Gitee 限制附件仅支持 `.exe` 格式，`.zip` 会被拒绝上传。

> PowerShell 7 的 `-Form` 参数接受 `FileInfo` 对象，自动处理 `multipart/form-data` 编码。
```

### 6. 确认结果

执行成功后，输出 Release URL（格式：`https://gitee.com/sage9731/poe-crafting-bench/releases/{tag}`）。

**注意**: Gitee 的 Release tag 格式为 `v2.0.0`（带 `v` 前缀），与 GitHub 保持一致。Release URL 中的 tag 不带 `v` 前缀时需要去掉 `v`。
