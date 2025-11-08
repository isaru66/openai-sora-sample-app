import { AzureOpenAI } from 'openai';
import '@azure/openai/types';

export interface AzureOpenAIConfig {
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  apiVersion?: string;
}

export function createAzureOpenAIClient(config: AzureOpenAIConfig): AzureOpenAI {
  const { endpoint, apiKey, apiVersion = '2024-10-21' } = config;
  
  // Create Azure OpenAI client with API key authentication
  return new AzureOpenAI({
    endpoint,
    apiKey,
    apiVersion,
    deployment: config.deploymentName
  });
}

/**
 * Validates required environment variables for Azure OpenAI
 */
function validateAzureOpenAIEnvironment(): { endpoint: string; apiKey: string; apiVersion: string } {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION?.trim() || '2024-10-21';

  if (!endpoint) {
    throw new Error(
      'AZURE_OPENAI_ENDPOINT environment variable is required. ' +
      'Please set it to your Azure OpenAI resource endpoint (e.g., https://your-resource.openai.azure.com/)'
    );
  }

  if (!apiKey) {
    throw new Error(
      'AZURE_OPENAI_API_KEY environment variable is required. ' +
      'Please set it to your Azure OpenAI API key.'
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

  return { endpoint, apiKey, apiVersion };
}

// Configuration helper for general chat/text models
export function getAzureOpenAIConfig(): AzureOpenAIConfig {
  const { endpoint, apiKey, apiVersion } = validateAzureOpenAIEnvironment();
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME?.trim() || 'gpt-4';

  return {
    endpoint,
    apiKey,
    deploymentName,
    apiVersion
  };
}

// Video generation configuration
export function getAzureOpenAIVideoConfig(): AzureOpenAIConfig {
  const { endpoint, apiKey, apiVersion } = validateAzureOpenAIEnvironment();
  const deploymentName = process.env.AZURE_OPENAI_VIDEO_DEPLOYMENT_NAME?.trim() || 'sora-2';

  return {
    endpoint,
    apiKey,
    deploymentName,
    apiVersion
  };
}

// Image generation configuration
export function getAzureOpenAIImageConfig(): AzureOpenAIConfig {
  const { endpoint, apiKey, apiVersion } = validateAzureOpenAIEnvironment();
  const deploymentName = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT_NAME?.trim() || 'dall-e-3';

  return {
    endpoint,
    apiKey,
    deploymentName,
    apiVersion
  };
}