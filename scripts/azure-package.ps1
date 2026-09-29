[CmdletBinding()]
param([Parameter(Mandatory)][string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$output = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $output) { throw 'Use a new output path; existing artifacts are never overwritten.' }
& node (Join-Path $PSScriptRoot 'check-release.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Source publication check failed.' }
$stage = Join-Path $output 'app'
& node (Join-Path $PSScriptRoot 'package-application.mjs') copy azure $stage
if ($LASTEXITCODE -ne 0) { throw 'Required application file missing; packaging stopped.' }
& npm ci --prefix $stage --omit=dev --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'Locked production dependency installation failed.' }
& node (Join-Path $PSScriptRoot 'package-application.mjs') audit azure $stage
if ($LASTEXITCODE -ne 0) { throw 'Application content/dependency audit failed.' }
$archive = Join-Path $output 'app.zip'
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $archive
& node (Join-Path $PSScriptRoot 'package-application.mjs') receipt azure $stage $archive
if ($LASTEXITCODE -ne 0) { throw 'Final Azure archive audit failed.' }
Get-FileHash -Algorithm SHA256 -LiteralPath $archive | Select-Object Algorithm,Hash
