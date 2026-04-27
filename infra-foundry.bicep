param aiFoundryName string
param aiProjectName string
param location string = resourceGroup().location
param deploySora bool = true
param deployImage bool = true
param deployMaiImage bool = true
param deployLlm bool = true

resource aiFoundry 'Microsoft.CognitiveServices/accounts@2025-06-01' = {
  name: aiFoundryName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  sku: {
    name: 'S0'
  }
  kind: 'AIServices'
  properties: {
    allowProjectManagement: true
    customSubDomainName: aiFoundryName
    disableLocalAuth: true
  }
}

resource aiProject 'Microsoft.CognitiveServices/accounts/projects@2025-06-01' = {
  name: aiProjectName
  parent: aiFoundry
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {}
}

resource llmDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = if (deployLlm) {
  parent: aiFoundry
  name: 'gpt-4.1-mini'
  sku: {
    name: 'GlobalStandard'
    capacity: 1
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-4.1-mini'
      version: '2025-04-14'
    }
  }
}

resource imageDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = if (deployImage) {
  parent: aiFoundry
  name: 'gpt-image-2'
  sku: {
    name: 'GlobalStandard'
    capacity: 1
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'gpt-image-2'
      version: '2026-04-21'
    }
  }
}

resource soraDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = if (deploySora) {
  parent: aiFoundry
  name: 'sora-2'
  sku: {
    name: 'GlobalStandard'
    capacity: 1
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: 'sora-2'
      version: '2025-10-06'
    }
  }
}

resource maiImageDeployment 'Microsoft.CognitiveServices/accounts/deployments@2025-06-01' = if (deployMaiImage) {
  parent: aiFoundry
  name: 'MAI-Image-2'
  sku: {
    name: 'GlobalStandard'
    capacity: 1
  }
  properties: {
    model: {
      format: 'Microsoft'
      name: 'MAI-Image-2'
      version: '2026-02-20'
    }
  }
}

output aiFoundryId string = aiFoundry.id
output aiProjectId string = aiProject.id
output endpoint string = aiFoundry.properties.endpoint
