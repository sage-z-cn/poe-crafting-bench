---
description: 使用 Gitee API 创建 Release，上传安装包
---

# Create Gitee Release

使用 REST API 在 Gitee 创建新 Release，上传 NSIS 安装包作为附件。

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

确认 `release/{version}/` 目录下存在：

- `poe-bench_{version}.exe` — NSIS 安装包

如缺失，提示用户先执行 `npm run build` 构建项目。

### 3. 提取 Release Notes

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
> 请在页面底部下载 `.exe` 安装包，勿下载 Source code 源码压缩包。便携版请前往 [GitHub](https://github.com/sage-z-cn/poe-crafting-bench/releases) 下载。
"@
```

### 4. 创建 Gitee Release 并上传附件

Gitee CLI 不支持直接上传文件，需通过 REST API 分两步完成：

#### 4.1 创建 Release

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

#### 4.2 上传附件

```powershell
$releaseId = $release.id
$filePath = "release/{version}/poe-bench_{version}.exe"
$token = $env:GITEE_ACCESS_TOKEN

$uri = "https://gitee.com/api/v5/repos/$owner/$repo/releases/$releaseId/attach_files?access_token=$token"
$fileBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $filePath))
$content = [System.Net.Http.MultipartFormDataContent]::new()
$fileContent = [System.Net.Http.ByteArrayContent]::new($fileBytes)
$fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/octet-stream")
$content.Add($fileContent, "file", (Split-Path $filePath -Leaf))

$http = [System.Net.Http.HttpClient]::new()
$response = $http.PostAsync($uri, $content).Result
$body = $response.Content.ReadAsStringAsync().Result
Write-Host $body
```

> 使用 `HttpClient` + URL query string 传递 token，避免 `Invoke-RestMethod -Form` 下 token 传递失效导致 40001 错误。

### 5. 确认结果

执行成功后，输出 Release URL（格式：`https://gitee.com/sage9731/poe-crafting-bench/releases/{tag}`）。

**注意**: Gitee 的 Release tag 格式为 `v2.0.0`（带 `v` 前缀），与 GitHub 保持一致。Release URL 中的 tag 不带 `v` 前缀时需要去掉 `v`。
