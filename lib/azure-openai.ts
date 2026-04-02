import { AzureOpenAI } from 'openai';
import '@azure/openai/types';
import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';

// Azure Cognitive Services scope used for all Azure OpenAI requests
const AZURE_COGNITIVESERVICES_SCOPE = 'https://cognitiveservices.azure.com/.default';

export interface AzureOpenAIConfig {
  endpoint: string;
  deploymentName: string;
  apiVersion?: string;
}

/**
 * Returns true when API key authentication is explicitly opted in via USE_AZURE_OPENAI_API_KEY=true.
 * Defaults to false — uses DefaultAzureCredential instead.
 */
function isApiKeyMode(): boolean {
  return process.env.USE_AZURE_OPENAI_API_KEY?.trim().toLowerCase() === 'true';
}

export function createAzureOpenAIClient(config: AzureOpenAIConfig): AzureOpenAI {
  const { endpoint, apiVersion = '2024-10-21' } = config;

  if (isApiKeyMode()) {
    const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('AZURE_OPENAI_API_KEY is required when USE_AZURE_OPENAI_API_KEY=true');
    }
    return new AzureOpenAI({ endpoint, apiKey, apiVersion, deployment: config.deploymentName });
  }

  // Authenticate with DefaultAzureCredential (supports managed identity,
  // workload identity, Azure CLI, environment variables, etc.)
  // Pass apiKey: '' to prevent the SDK from auto-reading AZURE_OPENAI_API_KEY from
  // the environment, which would conflict with azureADTokenProvider.
  const credential = new DefaultAzureCredential();
  const azureADTokenProvider = getBearerTokenProvider(credential, AZURE_COGNITIVESERVICES_SCOPE);
  return new AzureOpenAI({ endpoint, azureADTokenProvider, apiKey: '', apiVersion, deployment: config.deploymentName });
}

/**
 * Returns the appropriate auth headers based on the configured auth mode.
 * - USE_AZURE_OPENAI_API_KEY=true  → { 'api-key': '<AZURE_OPENAI_API_KEY>' }
 * - USE_AZURE_OPENAI_API_KEY=false → { 'Authorization': 'Bearer <token>' }  (default)
 * Used by routes that call the REST API directly.
 */
export async function getAzureAuthHeaders(): Promise<Record<string, string>> {
  if (isApiKeyMode()) {
    const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('AZURE_OPENAI_API_KEY is required when USE_AZURE_OPENAI_API_KEY=true');
    }
    return { 'api-key': apiKey };
  }

  const credential = new DefaultAzureCredential();
  const tokenResponse = await credential.getToken(AZURE_COGNITIVESERVICES_SCOPE);
  if (!tokenResponse?.token) {
    throw new Error('Failed to acquire Azure AD token via DefaultAzureCredential.');
  }
  return { 'Authorization': `Bearer ${tokenResponse.token}` };
}

/**
 * Validates required environment variables for Azure OpenAI
 */
function validateAzureOpenAIEnvironment(): { endpoint: string; apiVersion: string } {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION?.trim() || '2024-10-21';

  if (!endpoint) {
    throw new Error(
      'AZURE_OPENAI_ENDPOINT environment variable is required. ' +
      'Please set it to your Azure OpenAI resource endpoint (e.g., https://your-resource.openai.azure.com/)'
    );
  }

  // Validate endpoint format
  try {
    new URL(endpoint);
  } catch {
    throw new Error(
      'AZURE_OPENAI_ENDPOINT must be a valid URL (e.g., https://your-resource.openai.azure.com/)'
    );
  }

  return { endpoint, apiVersion };
}

// Configuration helper for general chat/text models
export function getAzureOpenAIConfig(): AzureOpenAIConfig {
  const { endpoint, apiVersion } = validateAzureOpenAIEnvironment();
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME?.trim() || 'gpt-4';

  return {
    endpoint,
    deploymentName,
    apiVersion
  };
}

// Video generation configuration
export function getAzureOpenAIVideoConfig(): AzureOpenAIConfig {
  const { endpoint, apiVersion } = validateAzureOpenAIEnvironment();
  const deploymentName = process.env.AZURE_OPENAI_VIDEO_DEPLOYMENT_NAME?.trim() || 'sora-2';

  return {
    endpoint,
    deploymentName,
    apiVersion
  };
}

// Image generation configuration
export function getAzureOpenAIImageConfig(): AzureOpenAIConfig {
  const { endpoint, apiVersion } = validateAzureOpenAIEnvironment();
  const deploymentName = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT_NAME?.trim() || 'dall-e-3';

  return {
    endpoint,
    deploymentName,
    apiVersion
  };
}