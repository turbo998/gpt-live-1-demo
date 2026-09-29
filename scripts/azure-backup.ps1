[CmdletBinding()]
param(
    [Parameter(Mandatory)][guid]$SubscriptionId,
    [Parameter(Mandatory)][string]$ExpectedUser,
    [Parameter(Mandatory)][ValidatePattern('^rg-gpt-live-demo-[a-z0-9-]+$')][string]$ResourceGroup,
    [Parameter(Mandatory)][ValidatePattern('^gpt-live-demo-[a-z0-9-]+$')][string]$AppName,
    [Parameter(Mandatory)][string]$OutputFile
)
$ErrorActionPreference = 'Stop'
if (![OperatingSystem]::IsWindows()) { throw 'This backup uses Windows DPAPI; run it as the Windows owner who will restore it.' }
if (Test-Path -LiteralPath $OutputFile) { throw 'Refusing to overwrite an existing private backup.' }
$account = az account show --subscription $SubscriptionId --only-show-errors -o json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $account.user.name -ne $ExpectedUser) { throw 'Azure identity mismatch.' }
$app = az webapp show --subscription $SubscriptionId --resource-group $ResourceGroup --name $AppName --only-show-errors -o json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $app.tags.workload -ne 'gpt-live-demo') { throw 'Refusing to read an unmarked application.' }
$scm = @($app.enabledHostNames | Where-Object { $_ -like '*.scm.azurewebsites.net' })[0]
if (!$scm) { throw 'No SCM endpoint was returned by Azure.' }
$token = az account get-access-token --subscription $SubscriptionId --resource https://management.azure.com/ --query accessToken --only-show-errors -o tsv
if ($LASTEXITCODE -ne 0 -or !$token) { throw 'Cannot obtain a control-plane access token.' }
try {
    $response = Invoke-WebRequest "https://$scm/api/vfs/gpt-live-demo/settings.json" -Headers @{Authorization="Bearer $token"}
    $text = if ($response.Content -is [byte[]]) { [Text.Encoding]::UTF8.GetString($response.Content) } else { [string]$response.Content }
    $value = $text | ConvertFrom-Json
    if ($value.version -ne 1 -or !$value.admin.hash) { throw 'Unexpected private settings format; backup not written.' }
    $text | ConvertTo-SecureString -AsPlainText -Force | Export-Clixml -LiteralPath $OutputFile
    Write-Output 'Private settings saved as a current-user Windows DPAPI backup. No plaintext was written.'
} finally {
    $token = $null
    $text = $null
    $response = $null
}
