targetScope = 'resourceGroup'

@description('Existing Foundry account. No account, existing deployment, or role is modified.')
param accountName string
@description('New, independent deployment name, never an existing production name.')
param deploymentName string

resource account 'Microsoft.CognitiveServices/accounts@2025-06-01' existing = {
  name: accountName
}

resource voice 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = {
  parent: account
  name: deploymentName
  sku: {
    name: 'GlobalStandard'
    capacity: 1
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-live-1'
      version: '2026-09-10'
    }
    versionUpgradeOption: 'NoAutoUpgrade'
  }
}

output model string = voice.properties.model.name
