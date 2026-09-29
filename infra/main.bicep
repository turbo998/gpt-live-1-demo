targetScope = 'resourceGroup'

@description('Globally unique web app name. Use a dedicated demo resource group.')
@minLength(2)
@maxLength(40)
param appName string
param location string = resourceGroup().location

@secure()
@minLength(24)
param setupToken string

var tags = {
  workload: 'gpt-live-demo'
  lifecycle: 'demo'
}

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: '${appName}-plan'
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: 'B1'
    tier: 'Basic'
    capacity: 1
  }
  properties: {
    reserved: true
  }
}

resource app 'Microsoft.Web/sites@2024-04-01' = {
  name: appName
  location: location
  tags: tags
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion: 'NODE|24-lts'
      appCommandLine: 'node server.mjs'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      healthCheckPath: '/api/health'
      http20Enabled: true
      appSettings: [
        { name: 'NODE_ENV', value: 'production' }
        { name: 'APP_MODE', value: 'remote' }
        { name: 'HOST', value: '0.0.0.0' }
        { name: 'PORT', value: '8080' }
        { name: 'APP_DATA_DIR', value: '/home/gpt-live-demo' }
        { name: 'MAX_SESSION_MINUTES', value: '10' }
        { name: 'SETUP_TOKEN', value: setupToken }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'false' }
        { name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE', value: 'true' }
      ]
    }
  }
}

resource ftp 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-04-01' = {
  parent: app
  name: 'ftp'
  properties: {
    allow: false
  }
}

resource scm 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2024-04-01' = {
  parent: app
  name: 'scm'
  properties: {
    allow: false
  }
}

output url string = 'https://${app.properties.defaultHostName}'
output principalId string = app.identity.principalId
