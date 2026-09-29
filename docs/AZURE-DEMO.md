# Azure GPT-Live demo operator guide

English | [简体中文（详细步骤）](AZURE-DEMO.zh-CN.md)

This is a **single-presenter, single-session** demo, not a multi-tenant service.
Keep live endpoint URLs, credentials, deployment receipts and recordings in the
private delivery directory. Templates and fixture tests are not live-provider proof.

## Architecture and protocol

The templates describe one Linux B1 App Service/Node 24 instance, with a separately named
`gpt-live-1` (example version 2026-09-10, GlobalStandard, requested capacity 1) deployment in an
approved existing Foundry account. Choose hosting and model regions using your
current quota, policy and model availability; template defaults are not a deployment result.
No new VM, AKS, ACR, Storage,
database, Log Analytics or Key Vault is required. Explicit APP_DATA_DIR
`/home/gpt-live-demo` keeps persistent settings separate from deployments, without
depending on process HOME. Windows/local/Docker remain supported.

Browser SDP goes through the authenticated Node backend to
`POST /openai/v1/live/sessions`; the browser receives only session ID and SDP.
Audio/data channels go directly to the model over WebRTC. Outbound sideband WSS
uses `/live/sessions/{id}/attach`. **GPT-Live has no ephemeral client keys** and
is not a drop-in Realtime API alias. GlobalStandard resource region is not a
promise of regional-only processing. This Azure template uses App Service's
system managed identity and the official Azure Identity SDK for cached,
server-only service tokens. Cognitive Services OpenAI User is scoped to the
approved Foundry account, never the subscription. Existing disableLocalAuth policy
is preserved. API key mode remains supported for local/compatible deployments.

The model handles speech and interruption. Node handles standalone clock queries;
optional Responses reasoning selects calculation/weather tools and native
`web_search`. Weather uses Open-Meteo; no separate search provider is added.
Search success requires a completed search call and sources. Interrupting speech
does not cancel business work; this demo has no order/payment integration.

## Prepare and deploy

Run `npm ci`, `npm test`, `npm run check:release`, `git diff --check`, and compile
`infra/main.bicep`, `infra/identity.bicep` and `infra/voice.bicep`. Run `scripts/azure-preflight.ps1`
with explicit SubscriptionId, ExpectedUser, AiResourceGroup and AiAccount. It is
read-only. Wizard tests/save/search are NOT free metadata checks.

Use `scripts/azure-package.ps1 -OutputDirectory .\work\package-unique` to create
an allowlisted ZIP with locked production ws and Azure Identity SDK dependencies;
inspect contents and SHA-256 before upload.
Copy `infra/main.parameters.example.json` outside the repository and add a random
secure `setupToken` of at least 24 characters. Never place secrets in shell
arguments, source, screenshots or chat. Run azure-prepare, azure-validate, then
azure-deploy, including ARM validate/what-if, policy, identity and quota checks.

`scripts/azure-host.ps1` takes explicit SubscriptionId, ExpectedUser, ResourceGroup,
AppName, Location and Action. Cloud writes require `-Apply` and confirmation:

- Provision: `-ParameterFile $privateParameters -Location westus2`.
- Publish: `-Archive $reviewedZip`. The script never deploys arbitrary repo contents.
- Start/Stop: stop interrupts the app but **does not stop plan charges**.
- Delete: destructive confirmation for the dedicated, tagged hosting group only.

Before applying `infra/voice.bicep` to the existing Foundry group, validate/preview
the unique new deploymentName; never overwrite an existing model deployment.
Capacity 1 is a template request requiring validation, not an inferred meaning of quota Count.
After the app identity exists, validate/preview/apply `infra/identity.bicep` in
the Foundry group with accountName and principalId. Wait for the resource-scoped
role to propagate. Do not bypass a 403 by enabling account keys or granting Contributor.

## First run and controls

Check HTTPS `/api/health` (liveness only), then privately enter SETUP_TOKEN on
`/setup`, configure/test the actual deployment name with Azure managed identity
(no model key), optionally configure
Responses, and create a strong admin password. Log out and log back in to verify
password auth. Setup tokens are no longer printed to logs. Use reasoning effort
`none` for a model that does not accept reasoning parameters.

App Service derives origin from WEBSITE_HOSTNAME; custom domains require an
explicit PUBLIC_ORIGIN. Bicep explicitly sets APP_DATA_DIR to `/home/gpt-live-demo`;
the App Service fallback uses that same persistent mount, not process HOME
(which may differ between the app container and SCM). This deployment stores no model keys/access tokens;
passwords are hashed. In the optional API-key mode, keys there remain plaintext.
Protect the directory, SCM access and backups. Local development should keep
APP_DATA_DIR in `work/dev-data` with port 8788, separate from installed app data.

The server enforces one active/creating voice session and a remote 10-minute
ceiling (MAX_SESSION_MINUTES supports 1–30; local default stays 30). A stale
browser preference cannot bypass it. Expiry/disconnect sends `session.close`,
then terminates the sideband after up to five seconds. Verify final cumulative
seconds and zero active sessions; network partitions/crashes still require
provider-side usage checks. Authenticated costly HTTP operations are limited
instance-wide to six/minute (one save may test both providers). HTTP 429 includes
Retry-After; close/health/status are not blocked. This is not a token or spending cap.

Login uses Secure/HttpOnly/SameSite cookies, Host/origin checks and failed-attempt
limits. Keep the admin password with the presenter, not a shared audience.
Do not scale out or enable multiple workers: auth/session state is process-local.

## Demo and recording

Five minutes before: check HTTPS/login; microphone meter/headphones/playback;
effective language/timezone/search preferences; authorized short live test with
real audio and source evidence; disconnect and clear previous transcripts.

A 5–8 minute demonstration: AI/synthetic-input disclosure; greeting; interrupt
a longer explanation; Shanghai time; `(18*25)+125` (575); optional search with
sources or visible failure; English/UI-language switch; mute; disconnect; explain
architecture after the paid session is closed. UI and conversation languages are
independent. Use no real customer data. See [recording workflow](RECORDING.md).
If speech recognition changes numbers/operators, check the transcript and repeat
a shorter question (for example, ten plus twenty). Correctly executing a
misrecognized expression does not mean the original question was answered correctly.

For failures check HTTPS/media permissions/network WebRTC policy, then auth,
actual deployment name, Retry-After and tool/source logs. A healthy HTTPS endpoint
does not prove media connectivity. If reasoning/search fails, explicitly fall
back to voice and clock, never simulate a successful live Azure query.

## Costs, shutdown and rollback

Recheck the official pricing sources for your region, deployment type, model and
contract before each demonstration. Monthly hosting = hourly plan rate × hours;
voice = billed session minutes × applicable minute rate; reasoning, tools, tax
and transfer are additional. Twenty 8-minute sessions are 160 minutes before
rehearsals and retries, not a price quote. Voice includes silence/backend waits; do not sum cumulative
usage snapshots. Budget alerts are delayed notifications, not spending caps.

Disconnect before stopping/upgrading. Back up private settings securely and
record the source commit, reviewed ZIP hash, model version and effective
preferences. Roll back by publishing the prior ZIP, not resetting settings;
in-memory logins/sessions end on restart. No B1 staging slot is assumed.
Windows operators can use `scripts/azure-backup.ps1` with explicit subscription,
user, group, app and an outside-repo output file. It reads the private settings
via Entra-authenticated SCM and writes a current-user/machine DPAPI backup only.
For authorized restore, disconnect sessions, privately decrypt/check version,
restore settings.json to the same mount through SCM, and restart; never print it.
To stop hosting charges, obtain approval and delete the dedicated app AND plan;
stopping or deleting only the app is insufficient. The voice deployment lives in
another group: remove only its exact name when authorized, never delete the
existing Foundry group. Recheck Cost Management and retained backups/resources.

Do not upload immediately after a restart/management operation while SCM may
still be restarting. For HTTP 502 inspect deployment logs and SCM
`/api/deployments/latest`; never duplicate an in-progress upload. Retry a confirmed
SCM-restart failure only after readiness. Require deployment Succeeded and a
fresh password login/settings check, not merely the previous app's healthy response.

## Sources

[GPT-Live/WebRTC](https://learn.microsoft.com/azure/foundry/openai/how-to/gpt-live-webrtc),
[cost/semantics](https://learn.microsoft.com/azure/foundry/openai/concepts/gpt-live),
[events](https://learn.microsoft.com/azure/foundry/openai/gpt-live-reference),
[Node hosting](https://learn.microsoft.com/azure/app-service/configure-language-nodejs),
[billing FAQ](https://learn.microsoft.com/azure/app-service/faq-configuration-and-management),
[Retail Prices API](https://prices.azure.com/api/retail/prices).
Filter service `Azure App Service`, B1, westus2 for Linux hosting; `Foundry Models`,
`Live 1 Gl`, eastus2 for voice. Do not substitute Windows, DZ or Transcribe pricing.

See the [public materials](demo/README.md) and [logical architecture](demo/architecture.md).
AI-assisted documentation; presenters must review against their own authorized deployment evidence.
