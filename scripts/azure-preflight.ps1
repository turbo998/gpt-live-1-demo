[CmdletBinding()]
param(
    [Parameter(Mandatory)][guid]$SubscriptionId,
    [Parameter(Mandatory)][string]$ExpectedUser,
    [Parameter(Mandatory)][string]$AiResourceGroup,
    [Parameter(Mandatory)][string]$AiAccount,
    [string]$Location = 'eastus2'
)
$ErrorActionPreference = 'Stop'
function Read-Az([string[]]$Arguments) {
    $result = & az @Arguments --subscription $SubscriptionId --only-show-errors --output json
    if ($LASTEXITCODE -ne 0) { throw 'Azure read failed; inspect CLI error. No fallback subscription is used.' }
    return ($result | ConvertFrom-Json)
}
$identity = Read-Az @('account','show')
if ($identity.user.name -ne $ExpectedUser -or $identity.state -ne 'Enabled') { throw 'Azure identity/subscription does not match approval.' }
$account = Read-Az @('cognitiveservices','account','show','--resource-group',$AiResourceGroup,'--name',$AiAccount)
if ($account.location -ne $Location) { throw 'Selected account region does not match the planned region.' }
$models = Read-Az @('cognitiveservices','account','list-models','--resource-group',$AiResourceGroup,'--name',$AiAccount)
$live = @($models | Where-Object { $_.name -eq 'gpt-live-1' -and $_.version -eq '2026-09-10' })
$usage = Read-Az @('cognitiveservices','usage','list','--location',$Location)
$quota = @($usage | Where-Object { $_.name.value -eq 'OpenAI.GlobalStandard.gpt-live-1' })
$deployments = Read-Az @('cognitiveservices','account','deployment','list','--resource-group',$AiResourceGroup,'--name',$AiAccount)
$provider = Read-Az @('provider','show','--namespace','Microsoft.Web')
[pscustomobject]@{
    IdentityMatched = $true
    Region = $Location
    LiveModelVisible = ($live.Count -gt 0)
    LiveQuota = @($quota | Select-Object currentValue,limit,unit)
    ExistingLiveDeployments = @($deployments | Where-Object { $_.properties.model.name -eq 'gpt-live-1' }).Count
    WebProviderRegistered = ($provider.registrationState -eq 'Registered')
    RealProviderVerified = $false
    Note = 'Read-only metadata, not deployment approval or voice/search compatibility proof.'
} | ConvertTo-Json -Depth 5
if (!$live.Count -or !$quota.Count -or $quota[0].limit -le $quota[0].currentValue) { throw 'Model visibility or free quota requires investigation before deployment.' }
