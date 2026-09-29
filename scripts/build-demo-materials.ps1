[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$StagingDirectory,
    [Parameter(Mandatory)][string]$ApprovalFile,
    [Parameter(Mandatory)][string]$OutputDirectory,
    [switch]$DocumentsOnly
)
$ErrorActionPreference = 'Stop'
$arguments = @((Join-Path $PSScriptRoot 'build-demo-materials.mjs'), $StagingDirectory, $ApprovalFile, $OutputDirectory)
if ($DocumentsOnly) { $arguments += '--documents-only' }
& node @arguments
if ($LASTEXITCODE -ne 0) { throw 'Demo materials build/audit failed; nothing is approved for upload.' }
