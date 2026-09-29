# Actual application recording / 实际应用录制

The final deliverable must show the real application and audible **real provider
responses**. A mock, silent browser video, slideshow or synthetic model answer is
not acceptable. Offline synthesized questions/narration are allowed only with a
clear disclosure. Never capture a user's microphone, desktop, notifications or
credential/setup screen.

最终交付以真实界面与可听见的真实模型回答为主；合成提问/旁白必须声明，不替换
模型回答。失败/不支持的搜索不能剪成“成功”。模型会话结束后再讲费用和架构。

## Toolchain

Use `scripts/record-demo.mjs` with separately installed Playwright, Microsoft Edge,
and FFmpeg. These are operator tools, not application runtime dependencies.
Set PLAYWRIGHT_MODULE to the private Playwright `index.mjs` path and FFMPEG_EXE
to a verified encoder. On Windows ARM64, a verified x64 FFmpeg can run under
emulation when a native package has no executable. Do not commit tool binaries.

```powershell
node .\scripts\record-demo.mjs $approvedHttpsUrl $privateCookieFile $mediaDirectory $newOutputDirectory --allow-live
```

The cookie JSON is sensitive, short-lived, and must remain outside the repository.
The `--allow-live` flag is required, but does not substitute for environment and cost approval.
Authenticate privately first; do not start recording on `/setup`. The script
records only the application's viewport and a WebAudio mix of approved WAV
questions/narration plus incoming WebRTC audio. It overrides getUserMedia to
return synthetic audio and refuses video capture. No screen or real mic API is
used. It uses actual browser interactions; no mocked server/model responses.

素材目录需有 `audio` 子目录，以下命名对应手册的可重放分镜：
`01-introduction`, `02-greeting`, `03-long-answer`, `04-interruption`,
`05-time-tool`, `12-calculator`, `13-web-search`, `06-bilingual`, `14-goodbye`,
`08-architecture`，扩展名为 `.wav`。
前9段中开场是旁白，其余为模型输入；架构旁白在断开后只进入视频音轨。
设置 `DEMO_CLEAR_AUDIO=1` 时，计算/搜索/英文三段改用 `audio-clear` 目录下同名
48kHz短提问。提问和本地旁白不伪装成模型响应；断开后点击应用“测试联网查询”
独立验证来源，不能把该测试说成语音成功触发。
审阅素材全文，确认无个人/客户数据。不要暗中使用真实用户录音。

## Acceptance / 验收

- Prefer a concise 3–4 minute recording of the working core (the operator's full
  live talk can be 5–8 minutes), H.264/AAC MP4 plus original browser WebM/audio.
- A non-empty audio stream alone is not proof of audible dialogue: decode the
  whole file, inspect audio volume, and listen to questions AND model responses.
- Verify real WebRTC connection, actual transcript/tool evidence, UI-language
  switching without replacing media, mute, and server-confirmed closed session.
- Record **final cumulative** voice seconds; include connection probes and failed
  attempts conservatively. Obtain an explicit time/cost budget before recording;
  this guide does not authorize any provider call.
- Review screenshots/frames and metadata for keys, cookies, account settings,
  private endpoint names, notifications, customer data and token URLs.
- Keep private verification JSON/transcripts/raw captures out of public source.
  Do not publish or upload the video without a separate distribution decision.
- If transport/provider/recording fails, close the session in `finally`, retain
  bounded private evidence, disclose the failure and retry only within budget.

录制器输出 verification.json 是运行证据，不是单独的兼容性证明。应通过 FFmpeg
完整解码检查错误，再确认音轨的非静音时段与模型讲话一致、分辨率和时长合适、
MP4可以播放。桌面音频不能作为“有声音”的替代证据。

Every frame and the entire audio track require review before publication; sampled
frames, OCR, a successful decode or non-silent audio alone cannot clear a video.
Strip private container metadata and inspect subtitle/attachment tracks. Work only
on copies. See [the historical recording boundaries](demo/media.md).

公开前必须审阅全部画面与完整音轨；抽帧、OCR、解码成功或非静音均不能单独证明
脱敏完成。检查字幕/附件轨与容器元数据，只处理副本。新录制、云调用和费用预算须
另行批准；原录像边界见[媒体说明](demo/media.zh-CN.md)。
