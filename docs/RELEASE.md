# Release checklist

English | [简体中文](RELEASE.zh-CN.md)

The current release line is **v0.4.0**, built on the inherited `0.3.1` baseline.
Confirm a version and publication authorization before changing versions, pushing
tags or uploading assets. Retain original attribution and the fork relationship.

## Independent gates

Run `npm ci`, `npm test`, `npm run check:release`, `npm run check:release -- --history HEAD`
and `git diff --check` in the isolated checkout. CI runs Node 22/24 and Docker
empty-configuration health/setup checks. Compile all three Bicep files offline
and parse PowerShell scripts without running cloud operations.

The source checker covers tracked files plus non-ignored candidates, including
dotfiles, tests, workflows and IaC. Findings report paths, line numbers and
categories, not secret values. Exact hashes bind reviewed images and narrowly
reviewed historical fixtures; there is no blanket tests/Azure-domain exemption.
Review any proposed change to these approvals rather than auto-generating trust.

History checks require full ancestry (not a shallow checkout). Audit every ref
intended for publication separately. Do not merge a private source commit and
delete its sensitive file afterward: the ancestor remains public. Review remote
refs, About, Pages/wiki, Releases and Actions artifacts/logs as applicable.
Unavailable surfaces remain incomplete. Confirmed exposure blocks upload;
credential revocation and history remediation require explicit authorization.

Text scans do not certify pictures, Word or video. Visually inspect all published
images and metadata before updating `scripts/reviewed-images.json`. Word needs
rendering, text parity, relationship and hidden-content review. Video needs
**all frames and the entire audio**, plus metadata/track and final playback checks.
Never replace real model responses with synthetic answers.

## Application packages

Use a fresh private output directory:

```powershell
npm run build:release -- --out-dir $newPrivateWindowsDirectory
.\scripts\azure-package.ps1 -OutputDirectory $newPrivateAzureDirectory
```

Both builders share explicit per-file runtime/public allowlists in
`scripts/release-policy.mjs`; Windows also includes explicitly listed docs.
Unknown nested docs/public files are not recursively copied. Missing modules,
production dependencies or license notices fail the build. Locked production
dependencies are installed with lifecycle scripts disabled.

Windows downloads the fixed official Node.js 24 x64 archive, checks both the
official checksum list and pinned SHA-256, and preserves its license notices.
Keep `Start.cmd`, `runtime` and `app` together. Settings belong in the operating
system's private data directory, never the ZIP. `--skip-runtime`/`--skip-install`
require `--no-zip` and produce development directories, not release assets.

Builds create private audit receipts binding every final file and the archive
hash. The checker reads ZIP entries without extracting paths; it rejects
traversal, duplicate paths, unsupported/encrypted entries, oversized expansion,
bad checksums, missing modules/dependencies and content mismatches:

```powershell
node .\scripts\check-release.mjs --archive $windowsZip --receipt $windowsReceipt
node .\scripts\check-release.mjs --archive $azureZip --receipt $azureReceipt
```

Keep receipts private; they are evidence, not independently signed approvals.
Inspect the final inventories as well as the source lists. Never upload a
partial directory, arbitrary wildcard ZIPs, private settings, recordings or receipts.

## Windows smoke and evidence boundaries

Extract a complete ZIP in a disposable directory. Remove Node from that process's
PATH, clear `NODE_PATH`/`NODE_OPTIONS`, set a fresh private `APP_DATA_DIR` and independent
`PORT`, and run `.\Start.cmd`. Check health,
setup, EN/ZH drafts, local synthetic media state, synthetic saved settings and
restart preservation. Ensure no settings appear under the package.

API-key and managed-identity fixtures are not provider compatibility proof.
Real connection, interruption, audio delivery, search sources and cloud restart
checks require separate environment/cost authorization. Record them separately;
never reinterpret a fixture, model discovery or old recording as a new live pass.

## Customer documents and video

Rebuild both Word handbooks from reviewed `docs/demo/presenter-guide*.md` and
the new diagram. Use `turbo998` for approved author metadata; remove private
properties, comments, revisions, hidden text, embedded originals and thumbnails.
Render and inspect every page. Do not reuse the original customer ZIP.

Place only `presenter-guide.docx`, `presenter-guide.zh-CN.docx` and (when cleared)
`GPT-Live-Azure-demo.mp4` in an outside-repository staging directory. A separate
private approval JSON has `schema: 1` and an `assets` object keyed by each exact
filename with `sha256` and `review`. Word review is
`public-text-rendered-metadata-approved`; video review is
`full-visual-and-audio-approved`. Only record these after review of those exact bytes.

```powershell
.\scripts\build-demo-materials.ps1 -StagingDirectory $privateStage `
  -ApprovalFile $privateApproval -OutputDirectory $newPrivateOutput
```

If video is not cleared, explicitly use `-DocumentsOnly` and a stage containing
only the two Word files. The archive is labeled documents-only, never a completed
video delivery. The builder refuses unexpected inputs/overwrite and writes a
payload manifest, final audit receipt and `SHA256SUMS.txt`. Recheck links, Word
metadata and final archive contents. Never upload original owner-private files.

## Draft-first publication

CI audits source/history. Windows Actions audits the exact ZIP **before**
`upload-artifact` and again before Release creation. Only the exact versioned ZIP
and its `SHA256SUMS.txt` are uploaded. A matching approved `v*` tag creates a
**draft**, never a published Release. Manual dispatch builds an artifact only.

After version approval, synchronize package/lockfile, notes and README, rebuild
and re-audit exact final bytes, then tag the exact tested main commit after its CI
passes. Wait for the tagged Windows workflow to finish successfully before changing
its draft or assets. Download and independently audit its Windows ZIP, including
the no-system-Node smoke; use that exact file rather than upload a second build with
the same name. Then add only the reviewed additional assets. Replace the workflow's
Windows-only checksum file with a checksum file covering the complete set, after
verifying the old file's contents and removing only that specific draft asset.
Do not run competing release jobs, use wildcard uploads or overwrite binary assets.
For v0.4.0 the complete list is:

- `gpt-live-1-demo-0.4.0-windows-x64.zip`
- `gpt-live-1-demo-0.4.0-azure.zip`
- `gpt-live-demo-documents-only.zip`
- `presenter-guide.docx`
- `presenter-guide.zh-CN.docx`
- `SHA256SUMS.txt` covering those five files

Verify the tag SHA, workflow results, exact asset set and independently downloaded
hashes before publishing the draft. This release excludes MP4 and video-containing
archives. Staged media require their separate clearance. Keep the
fork relationship, MIT attribution and real contributor history.

Render/Azure templates are deployment starting points, not hosted-service claims.
Stopping an App Service app does not stop plan billing. This release process
does not authorize any cloud operation or paid model call.
