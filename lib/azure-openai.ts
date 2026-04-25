import { AzureOpenAI } from 'openai';
import '@azure/openai/types';
import {
  DefaultAzureCredential,
  ManagedIdentityCredential,
  getBearerTokenProvider,
  type TokenCredential,
} from '@azure/identity';

const COGNITIVE_SCOPE = 'https://cognitiveservices.azure.com/.default';

export interface AzureOpenAIConfig {
  endpoint: string;
  apiKey?: string;
  deploymentName: string;
  apiVersion?: string;
}

let cachedCredential: TokenCredential | null = null;
function getCredential(): TokenCredential {
  if (cachedCredential) return cachedCredential;
  const clientId = process.env.AZURE_CLIENT_ID?.trim();
  cachedCredential = clientId
    ? new ManagedIdentityCredential({ clientId })
    : new DefaultAzureCredential();
  return cachedCredential;
}

export function createAzureOpenAIClient(config: AzureOpenAIConfig): AzureOpenAI {
  const { endpoint, apiKey, apiVersion = '2024-10-21', deploymentName } = config;

  if (apiKey) {
    return new AzureOpenAI({
      endpoint,
      apiKey,
      apiVersion,
      deployment: deploymentName,
    });
  }

  const azureADTokenProvider = getBearerTokenProvider(getCredential(), COGNITIVE_SCOPE);
  return new AzureOpenAI({
    endpoint,
    azureADTokenProvider,
    apiVersion,
    deployment: deploymentName,
  });
}

interface AzureBaseEnv {
  endpoint: string;
  apiKey?: string;
  apiVersion: string;
}

function readBaseEnv(): AzureBaseEnv {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim() || undefined;
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION?.trim() || '2024-10-21';

  if (!endpoint) {
    throw new Error(
      'AZURE_OPENAI_ENDPOINT environment variable is required (e.g., https://your-resource.openai.azure.com/).'
    );
  }
  try {
    new URL(endpoint);
  } catch {
    throw new Error('AZURE_OPENAI_ENDPOINT must be a valid URL.');
  }
  return { endpoint, apiKey, apiVersion };
}

export function getAzureOpenAIConfig(): AzureOpenAIConfig {
  const { endpoint, apiKey, apiVersion } = readBaseEnv();
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME?.trim() || 'gpt-4o';
  return { endpoint, apiKey, deploymentName, apiVersion };
}

export function getAzureOpenAIImageConfig(): AzureOpenAIConfig {
  const { endpoint, apiKey, apiVersion } = readBaseEnv();
  const deploymentName = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT_NAME?.trim() || 'gpt-image-2';
  return { endpoint, apiKey, deploymentName, apiVersion };
}

export interface AzureOpenAIVideoEndpoint {
  endpoint: string;
  apiVersion: string;
  deploymentName: string;
  // Returns an Authorization header value (either "api-key" pair or "Bearer ...")
  getAuthHeaders: () => Promise<Record<string, string>>;
}

export function getAzureOpenAIVideoEndpoint(): AzureOpenAIVideoEndpoint {
  const endpoint =
    process.env.AZURE_OPENAI_VIDEO_ENDPOINT?.trim() ||
    process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiKey =
    process.env.AZURE_OPENAI_VIDEO_API_KEY?.trim() ||
    process.env.AZURE_OPENAI_API_KEY?.trim();
  const apiVersion =
    process.env.AZURE_OPENAI_VIDEO_API_VERSION?.trim() ||
    process.env.AZURE_OPENAI_API_VERSION?.trim() ||
    '2024-10-21';
  const deploymentName =
    process.env.AZURE_OPENAI_VIDEO_DEPLOYMENT_NAME?.trim() || 'sora-2';

  if (!endpoint) {
    throw new Error(
      'Azure OpenAI video endpoint is not configured. Set AZURE_OPENAI_VIDEO_ENDPOINT or AZURE_OPENAI_ENDPOINT.'
    );
  }

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    if (apiKey) {
      return { 'api-key': apiKey };
    }
    const token = await getCredential().getToken(COGNITIVE_SCOPE);
    if (!token) {
      throw new Error('Failed to acquire Azure AD token for Cognitive Services.');
    }
    return { Authorization: `Bearer ${token.token}` };
  };

  return { endpoint, apiVersion, deploymentName, getAuthHeaders };
}
