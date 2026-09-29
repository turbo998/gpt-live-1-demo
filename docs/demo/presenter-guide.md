# GPT-Live presenter guide

English | [简体中文](presenter-guide.zh-CN.md) · Maintainer: **turbo998**

For presales, architects, partners and demo presenters. Deploy your own application;
`https://voice.example.com` is only a placeholder. Obtain access privately from
the environment owner. No shared service or credentials accompany this guide.

## Explain the value and limits

“Make voice conversation feel natural, while handing reasoning and tool work to
a controlled backend.” Show observable behavior rather than claiming the model
can do everything: overlapping speech, changing direction mid-answer, and
verifiable tool results. This uses the GPT-Live session protocol, not an interchangeable
Realtime, Voice Live, transcription or chat API.

![Logical architecture](../images/demo-architecture.png)

The browser negotiates SDP through the trusted Node server, then exchanges audio
directly with the live model over WebRTC. Node holds credentials, opens the
sideband connection and delegates work. Azure hosting can use managed identity
with account-scoped OpenAI User permission; local/API-key operation remains.
See [editable architecture and boundaries](architecture.md).

The example uses a single Linux B1/Node 24 instance and persistent settings
separate from deployments. Regions and the model version are deployment choices,
not current availability guarantees. Remote sessions default to 10 minutes,
with one concurrent session and six provider-facing HTTP operations per minute.
These controls are not a spending cap or multi-tenant authorization system.

## Five minutes before

Check HTTPS and administrator login off-screen. Never show setup, credentials,
browser developer tools or private tabs in a recording. Use headphones and test
the selected microphone, level meter and playback locally.

Inspect effective conversation/UI language, timezone, search and session preferences;
upgrades retain old choices. Only with separate provider/cost authorization, run
a short greeting and check real audible answers. HTTP health is not WebRTC proof.
Close that session and clear old transcripts. Use fictional customer scenarios.

Disclose AI use and any synthetic question/narration audio. If switching to an
approved recording, explicitly call it a prior recording, not a live call.
Do not bypass organizational network/security controls to make a demo work.

## Six-minute talk

| Time | Action | Evidence and boundary |
| --- | --- | --- |
| 0:00–0:40 | Introduce a fictional coffee shop assistant | No real orders, payments or customer data |
| 0:40–1:30 | Ask for a two-sentence welcome | Audible answer and timestamped transcript; no invented latency claim |
| 1:30–2:20 | Interrupt a longer explanation and request one sentence | Observe redirection; stopping speech does not cancel business work |
| 2:20–3:30 | Ask Shanghai time, then `(18 × 25) + 125` | Local clock, then calculation 575 with tool evidence |
| 3:30–4:20 | Optionally request a recent official announcement | Completed native search and sources; inspect dates and content |
| 4:20–4:50 | Switch UI language, then separately request English speech | UI and spoken language are independent; verify each result |
| 4:50–6:00 | Mute/unmute, summarize, disconnect | Confirm closure and zero active sessions; explain architecture afterward |

If transcription changes an operator/number, inspect it and repeat a shorter
question (for example ten plus twenty). Correct computation of misheard input
does not prove the original question was answered. A spoken answer alone does
not prove a tool ran. An independent search-test button is not a voice-triggered search.

## Questions customers ask

**Does “order cancelled” prove success?** No. Only the authoritative business
system and its audit record can establish that. This demo has no order/payment integration.

**Does interruption cancel backend work?** No. Cancellation, compensation and
authorization belong to the application; muting or speech interruption is not rollback.

**Are credentials visible in the browser?** Model credentials stay server-side.
Managed-identity tokens are restricted to supported Azure model endpoints.
API-key settings are plaintext in a private server file; protect filesystem and backups.

**Is this production-ready or a residency guarantee?** No. Single-instance
state, basic presenter login and Global deployments do not establish high availability,
tenant isolation, compliance or regional-only processing.

## Costs and failures

Recheck current [official pricing](https://prices.azure.com/api/retail/prices).
Hosting is billed by plan hours; voice by billed session time; reasoning/tools,
transfer and tax are separate. Twenty eight-minute sessions mean 160 minutes
before rehearsals/retries. Silence and backend waits still count; do not sum
cumulative usage snapshots. Budget alerts are delayed notifications, not hard caps.
Stopping an app does not stop its plan's charges.

On media failure, check HTTPS, permissions, selected devices and WebRTC policy;
close before a bounded retry. For 429, respect Retry-After. Search/tool failure
must stay visible: skip that capability rather than simulate success. Inaccurate
answers are model outputs, not facts; check authoritative sources.

Production work needs separate identity, tool authorization, business confirmation,
data retention, regional policy, shared state, capacity, monitoring, backup and
recovery design. See [operations](../AZURE-DEMO.md) and [media limitations](media.md).

Adapted from turbo998's original demo materials with AI-assisted editing.
Reviewers must verify their own authorized deployment; this guide is not live evidence.
