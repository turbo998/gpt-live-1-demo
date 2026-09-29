# Release notes / 发布说明

## v0.4.0 / Azure integration and reviewed portable packages

### English

- First release of the turbo998 fork, building on the inherited v0.3.1 project. MIT, upstream attribution in `NOTICE.md`, and the original contributor history are preserved.
- Azure managed identity keeps tokens on the server. Single-session, duration and remote request limits protect the demo; local API-key setup remains supported. Generic Bicep and guarded operator scripts are included in source.
- Windows x64 ZIP bundles the verified official Node.js 24.21.0 runtime. Extract the complete package and run `Start.cmd`; no separate Node.js installation is needed. Settings stay in the private application-data directory and survive upgrades.
- English/Chinese browser setup covers compatible live voice and optional Responses reasoning services, microphone and playback checks, voice and preferences. UI language changes preserve drafts and active local media.
- Direct clock answers work without the reasoning backend. Calculation, weather and delegated questions use the configured backend; native web search uses that same service, with source links and visible failures. Provider support depends on the configured deployment.
- Run locally from source with Node.js 22+ using `npm ci` and `npm start`, or use Docker. The Azure ZIP is an application deployment payload, not a provisioned or live-verified Azure service.
- Release assets: Windows ZIP, Azure ZIP, documents-only ZIP, English/Chinese Word handbooks, and `SHA256SUMS.txt`. Verify the five file hashes before use. No MP4 or video-containing customer ZIP is included.
- Verification covers Node 22/24 tests, real Docker empty-configuration startup, bilingual browser flows, no-system-Node Windows startup/restart, source/history and final archive checks. No real provider call, cloud deployment or new live recording was performed for this release. Fixtures and historical recordings are not live compatibility evidence.

### 简体中文

- turbo998 fork 的首个发行版，在继承的 v0.3.1 项目基础上整合；保留 MIT、`NOTICE.md` 上游来源和真实贡献历史。
- Azure 托管身份的令牌仅留在服务端，增加单会话、时长和远程请求限制，保留本地 API Key 配置；源码包含通用 Bicep 与防误操作脚本。
- Windows x64 ZIP 包含经官方校验的 Node.js 24.21.0，完整解压后运行 `Start.cmd`，无需单独安装 Node.js。设置保存在私有应用数据目录，升级时保留。
- 中英文浏览器向导支持兼容语音服务、可选 Responses 推理服务、麦克风与播放测试、音色和偏好；切换界面语言保留草稿和活动本地媒体。
- 独立时间问题无需推理后端；计算、天气与委托问题使用已配置后端，原生搜索复用该服务并显示来源及失败。实际能力取决于部署和权限。
- 源码本地运行需要 Node.js 22+，执行 `npm ci` 和 `npm start`；也支持 Docker。Azure ZIP 是应用部署内容，不是已开通或经真实部署验证的云服务。
- 发行资产为 Windows ZIP、Azure ZIP、纯文档 ZIP、中英文 Word 和 `SHA256SUMS.txt`，使用前核对五个文件哈希；不含 MP4 或含视频客户 ZIP。
- 验证覆盖 Node 22/24、真实 Docker 空配置启动、双语浏览器、无系统 Node 的 Windows 启动与重启、源码/历史及最终归档。本次未调用真实 provider、部署云资源或新录 live 视频；fixture 和历史录像不作为真实兼容证据。

The entries below describe inherited project history, not existing releases of
this fork. Media publication requires its own full review.

以下为继承的项目历史，不表示本 fork 已发布相应版本；媒体公开仍须完整审核。

## v0.3.1 / 简化为原生自动搜索

- Use only the existing reasoning service’s native web search, automatically when needed. New configurations enable it by default; existing saved choices are preserved.
- Remove the separate search provider and extra key fields. Keep source links and optional diagnostics under advanced preferences.
- 只使用现有推理服务的原生搜索，按需自动调用；新配置默认开启，升级保留已有选择。
- 移除额外搜索服务和 Key 配置，仅保留来源及高级偏好中的可选诊断。

## v0.3.0 / 可配置联网搜索

- Add independent Tavily search alongside backend-hosted search, with server-only credentials.
- Add real search probes requiring source evidence; successful chat is no longer treated as proof of search capability.
- Expose search setup and diagnostics in both languages and apply saved wizard preferences after redirect.
- 新增 Tavily 独立搜索，可与后端内置搜索切换，密钥只保存在服务端。
- 新增返回实际来源的搜索测试，区分问答连通性与搜索能力。
- 配置向导和对话页提供中英文搜索配置与测试，修复旧浏览器偏好覆盖向导设置。

## v0.2.1 / 作者与项目链接

- Add author credit and a GitHub repository link to the conversation and setup pages, in both interface languages. The link opens in a new tab.
- 主界面和配置向导底部新增作者及 GitHub 项目链接，支持中英文，点击后在新标签页打开。

## v0.2.0 / 中英文版

### English

- Add an English / Simplified Chinese interface language switch.
- Detect the browser locale on first use, while keeping the interface language separate from the assistant's conversation language.
- Apply an interface language change without a page reload and without clearing the current setup, password form, or authenticated session.
- Keep the existing service configuration, voice choices, transcript timestamps, and backend behavior unchanged.
- Publish matching English and Chinese documentation for setup, deployment, and release work.

### 简体中文

- 增加 English / 简体中文界面语言切换。
- 首次使用时根据浏览器语言自动选择界面语言，同时让界面语言与助手的对话语言保持独立。
- 切换界面语言时不刷新页面，也不清空当前配置、密码表单或已登录会话。
- 保持现有服务配置、音色选择、转写时间戳和后端行为不变。
- 为设置、部署和发布流程提供对应的中英文文档。

## v0.1.0 / 首次公开版本

### English

- Windows x64 ZIP with an official Node.js 24 runtime; extract the complete package and double-click `Start.cmd`.
- Browser setup wizard for the live voice service, optional reasoning backend, microphone selection, input-level test, and playback test.
- Voice selection, conversation language, timezone, default city, search option, reasoning effort, output budget, and session limit.
- Timestamped, sentence-separated transcript lines with audio playback, mute, reconnect, and session cleanup.
- Standalone current time/date answers without a reasoning-backend call; other tools require the optional backend.
- Docker self-hosting and a Render deployment template. The Render template uses a paid Starter service and persistent disk; it is not a claim of a live hosted deployment.
- Remote mode with an initial setup token and administrator password.
- Settings kept in the deployer's private application-data directory. API keys are stored as plain text in the settings file for server use; protect that directory and its backups.

Users must provide their own compatible live voice deployment and API keys. Voice sessions and optional backend calls are billed by the services selected by the deployer.

### 简体中文

- Windows x64 ZIP 已包含官方 Node.js 24 运行时；完整解压后双击 `Start.cmd` 即可启动。
- 浏览器配置向导支持实时语音服务、可选推理后端、麦克风选择、输入电平测试和播放测试。
- 支持音色、对话语言、时区、默认城市、联网搜索、推理强度、输出预算和会话时长设置。
- 实时转写按句带时间戳并换行，支持语音播放、静音、重新连接和会话清理。
- 独立的当前时间/日期问题无需调用推理后端；其他工具需要可选后端。
- 支持 Docker 自行部署和 Render 部署模板。Render 模板使用付费 Starter 服务和持久磁盘；这不代表已有线上托管服务。
- 服务器模式使用初始化口令和管理员密码保护。
- 设置保存在部署者的私有应用数据目录中。为了让服务能够使用，API Key 会以明文保存在设置文件中；请保护该目录及其备份。

用户需要自行准备兼容的实时语音部署和 API Key。语音会话及可选后端调用的费用由部署者选择的服务承担。
