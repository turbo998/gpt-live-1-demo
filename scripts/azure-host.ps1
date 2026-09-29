[CmdletBinding(SupportsShouldProcess,ConfirmImpact='High')]
param(
    [Parameter(Mandatory)][guid]$SubscriptionId,
    [Parameter(Mandatory)][string]$ExpectedUser,
    [Parameter(Mandatory)][ValidatePattern('^rg-gpt-live-demo-[a-z0-9-]+$')][string]$ResourceGroup,
    [Parameter(Mandatory)][ValidatePattern('^gpt-live-demo-[a-z0-9-]+$')][string]$AppName,
    [ValidateSet('Validate','Provision','Publish','Start','Stop','Delete')][string]$Action = 'Validate',
    [string]$Location = 'westus2',
    [string]$ParameterFile,
    [string]$Archive,
    [switch]$Apply
)
$ErrorActionPreference = 'Stop'
function Invoke-Az([string[]]$Arguments) {
    & az @Arguments --subscription $SubscriptionId --only-show-errors
    if ($LASTEXITCODE -ne 0) { throw "Azure operation failed: $($Arguments[0..1] -join ' ')" }
}
$identity = Invoke-Az @('account','show','--output','json') | ConvertFrom-Json
if ($identity.user.name -ne $ExpectedUser -or $identity.state -ne 'Enabled') { throw 'Azure identity does not match approval.' }
if ($Action -ne 'Validate' -and !$Apply) { throw 'Cloud writes require -Apply after explicit approval.' }
$exists = (Invoke-Az @('group','exists','--name',$ResourceGroup,'--output','tsv')) -eq 'true'
if ($exists) {
    $group = Invoke-Az @('group','show','--name',$ResourceGroup,'--output','json') | ConvertFrom-Json
    if ($group.tags.workload -ne 'gpt-live-demo') { throw 'Refusing an unmarked resource group.' }
}
if ($Action -eq 'Delete') {
    Write-Warning 'Deletes ONLY this dedicated hosting group. The separately deployed voice model and private backups remain.'
} elseif ($Action -eq 'Stop') {
    Write-Warning 'Stopping the web app does NOT stop App Service Plan billing.'
}
if ($Action -in @('Validate','Provision') -and !(Test-Path -LiteralPath $ParameterFile)) { throw 'A private ARM parameter file is required; never commit setupToken.' }
if ($Action -eq 'Publish' -and !(Test-Path -LiteralPath $Archive)) { throw 'A reviewed allowlisted deployment ZIP is required.' }
if ($Action -ne 'Validate' -and !$PSCmdlet.ShouldProcess("$SubscriptionId / $ResourceGroup / $AppName",$Action)) { return }
if (!$exists -and $Action -eq 'Provision') {
    Invoke-Az @('group','create','--name',$ResourceGroup,'--location',$Location,'--tags','workload=gpt-live-demo','--output','none')
} elseif (!$exists) { throw 'Target group does not exist. Offline Bicep build is available without provisioning.' }
$template = Join-Path (Split-Path $PSScriptRoot -Parent) 'infra\main.bicep'
switch ($Action) {
    'Validate' { Invoke-Az @('deployment','group','validate','--resource-group',$ResourceGroup,'--template-file',$template,'--parameters',"@$ParameterFile","appName=$AppName","location=$Location",'--output','none') }
    'Provision' {
        Invoke-Az @('deployment','group','validate','--resource-group',$ResourceGroup,'--template-file',$template,'--parameters',"@$ParameterFile","appName=$AppName","location=$Location",'--output','none')
        Invoke-Az @('deployment','group','create','--name','gpt-live-demo-host','--resource-group',$ResourceGroup,'--template-file',$template,'--parameters',"@$ParameterFile","appName=$AppName","location=$Location",'--output','none')
    }
    'Publish' { Invoke-Az @('webapp','deploy','--resource-group',$ResourceGroup,'--name',$AppName,'--type','zip','--src-path',$Archive,'--output','none') }
    'Start' { Invoke-Az @('webapp','start','--resource-group',$ResourceGroup,'--name',$AppName,'--output','none') }
    'Stop' { Invoke-Az @('webapp','stop','--resource-group',$ResourceGroup,'--name',$AppName,'--output','none') }
    'Delete' { Invoke-Az @('group','delete','--name',$ResourceGroup,'--yes','--output','none') }
}
