# 发布清单

[English](RELEASE.md) | 简体中文

turbo998 fork 尚未发布发行包。`0.3.1` 是继承的包基线，不是本 fork 已有下载。
修改版本、推送标签或上传资产前，须确认版本与发布授权。

## 相互独立的门槛

在隔离 checkout 运行 `npm ci`、`npm test`、`npm run check:release`、
`npm run check:release -- --history HEAD`、`git diff --check`。
CI 覆盖 Node 22/24 和 Docker 空配置健康/向导检查。三个 Bicep 均离线编译，
PowerShell 只做语法解析，不运行云操作。

源码检查覆盖 Git 跟踪文件与未忽略候选，包括隐藏文件、tests、工作流及 IaC。
仅报告位置、行号与类别，不输出秘密值。审核图片和历史合成测试按精确哈希绑定，
不放行整个 tests 或所有 Azure 域名。修改审核清单需重新审阅，不能自动生成信任。

历史检查要求完整祖先，不接受浅克隆。逐个审查拟公开 ref，并盘点远端 refs、
About、Pages/wiki、Releases、Actions 资产/日志；无法访问的范围保持未完成。
不能先合并私有提交再删文件，祖先仍会公开。确认泄露立即阻塞上传；
凭据撤销和历史处置须另行授权。

文本扫描不能证明图片、Word 或视频安全。更新 `scripts/reviewed-images.json`
前检查完整图片与元数据。Word 须渲染、文字对齐、关系和隐藏内容检查；
视频须审阅**全部画面与完整音轨**，检查元数据/轨道并播放最终文件。
不得用合成回答替换真实模型输出。

## 应用包

每次使用新的私有输出目录：

```powershell
npm run build:release -- --out-dir $newPrivateWindowsDirectory
.\scripts\azure-package.ps1 -OutputDirectory $newPrivateAzureDirectory
```

两个构建器共享 `scripts/release-policy.mjs` 中的逐文件运行时/public 白名单，
Windows 另含明确列出的文档。不递归复制未知 docs/public 文件。
缺模块、生产依赖或许可证即失败；生产依赖从 lockfile 安装并禁用生命周期脚本。

Windows 下载固定官方 Node.js 24 x64 包，同时核对官方校验表与固定 SHA-256，
保留许可证。`Start.cmd`、`runtime`、`app` 必须同层；设置保存在系统私有数据目录，
不能进入 ZIP。`--skip-runtime`/`--skip-install` 必须配 `--no-zip`，
输出仅用于开发，不是发行资产。

构建产生逐文件与归档哈希绑定的私有审核回执。ZIP 检查不释放路径，
拒绝穿越、重复路径、加密/不支持格式、超量展开、校验错误、缺失模块/依赖和内容变化：

```powershell
node .\scripts\check-release.mjs --archive $windowsZip --receipt $windowsReceipt
node .\scripts\check-release.mjs --archive $azureZip --receipt $azureReceipt
```

回执是证据，不是独立签名批准，保持私有。检查最终文件清单而非只看源码白名单。
禁止上传残缺目录、通配符匹配的任意 ZIP、私有设置、原始录制或审核回执。

## Windows 冒烟与证据边界

解压到一次性目录，从该进程 PATH 移除 Node，设新的私有 `APP_DATA_DIR`，
运行 `Start.cmd`。检查健康、向导、中英草稿、合成本地媒体状态、合成设置保存及
重启保留，确认包内没有 settings 文件。

API Key 和托管身份 fixture 不证明真实供应商兼容。真实连接、打断、音频、
搜索来源及云重启须另获环境/费用批准并单独记录，不能把模拟、模型目录或
旧录像算作本次 live 通过。

## 客户文档与视频

从审核后的 `docs/demo/presenter-guide*.md` 与新架构图重建两种语言 Word。
作者属性为 `turbo998`；移除私人属性、批注、修订、隐藏文字、内嵌原件和缩略图，
逐页渲染检查。不复用原客户 ZIP。

仓库外 stage 仅放 `presenter-guide.docx`、`presenter-guide.zh-CN.docx`，
及已清关时的 `GPT-Live-Azure-demo.mp4`。另一份私有 approval JSON 包含
`schema: 1` 和以确切文件名为键的 `assets`，每项含 `sha256` 与 `review`。
Word 为 `public-text-rendered-metadata-approved`，视频为
`full-visual-and-audio-approved`，只有审核该精确文件后才能记录。

```powershell
.\scripts\build-demo-materials.ps1 -StagingDirectory $privateStage `
  -ApprovalFile $privateApproval -OutputDirectory $newPrivateOutput
```

视频未清关时显式用 `-DocumentsOnly`，stage 只能有两个 Word。
产物命名为 documents-only，不冒充完成视频交付。构建拒绝额外输入和覆盖，
输出内容清单、最终回执与 `SHA256SUMS.txt`。复核链接、Word 元数据及最终 ZIP，
禁止上传环境所有者私有原件。

## 先草稿，后批准发布

CI 审核源码与历史。Windows Actions 在 `upload-artifact` **之前**检查最终 ZIP，
创建 Release 前再检查。只上传精确版本名 ZIP 和 `SHA256SUMS.txt`。
匹配已批准版本的 `v*` 标签仅创建**草稿**；手动触发只构建 artifact。

版本获批后同步 package/lockfile、发布说明和 README，重建并审查最终字节，再标记
审核提交。核对 tag SHA、工作流结果、资产名、哈希和下载链接。最终批准后才公开草稿，
媒体另需审核。保留 fork、MIT 声明和真实贡献历史。

Render/Azure 模板只是部署起点，不是已有在线服务声明。停止 App Service 应用
不停止计划收费。本发布流程不授权任何云操作或付费模型调用。
