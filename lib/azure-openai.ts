import { AzureOpenAI } from 'openai';
import '@azure/openai/types';

const COGNITIVE_RESOURCE = 'https://cognitiveservices.azure.com/';
const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;
const TOKEN_TIMEOUT_MS = 10_000;

export interface AzureOpenAIConfig {
  endpoint: string;
  apiKey?: string;
  deploymentName: string;
  apiVersion?: string;
}

type ManagedIdentityTokenResponse = {
  access_token?: string;
  expires_on?: string | number;
  expires_in?: string | number;
};

let cachedAccessToken: { token: string; expiresAt: number } | null = null;
let pendingTokenRequest: Promise<string> | null = null;

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const parseExpiresAt = (response: ManagedIdentityTokenResponse): number => {
  const expiresOn = response.expires_on;
  if (typeof expiresOn === 'number' && Number.isFinite(expiresOn)) {
    return expiresOn * 1000;
  }
  if (typeof expiresOn === 'string' && expiresOn.trim()) {
    const numeric = Number(expiresOn);
    if (Number.isFinite(numeric)) {
      return numeric * 1000;
    }
    const parsed = Date.parse(expiresOn);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  const expiresIn = Number(response.expires_in);
  if (Number.isFinite(expiresIn) && expiresIn > 0) {
    return Date.now() + expiresIn * 1000;
  }

  return Date.now() + 30 * 60 * 1000;
};

const fetchJsonWithTimeout = async <T>(
  url: URL,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      const message = typeof payload === 'object' && payload && 'error' in payload
        ? JSON.stringify(payload.error)
        : response.statusText;
      throw new Error(`Managed Identity token request failed (${response.status}): ${message}`);
    }
    return payload as T;
  } finally {
    clearTimeout(timeout);
  }
};

const requestManagedIdentityToken = async (): Promise<string> => {
  const clientId = process.env.AZURE_CLIENT_ID?.trim();
  const identityEndpoint = process.env.IDENTITY_ENDPOINT?.trim();
  const identityHeader = process.env.IDENTITY_HEADER?.trim();

  if (identityEndpoint && identityHeader) {
    const url = new URL(identityEndpoint);
    url.searchParams.set('api-version', '2019-08-01');
    url.searchParams.set('resource', COGNITIVE_RESOURCE);
    if (clientId) {
      url.searchParams.set('client_id', clientId);
    }

    const tokenResponse = await fetchJsonWithTimeout<ManagedIdentityTokenResponse>(
      url,
      { 'X-IDENTITY-HEADER': identityHeader },
      TOKEN_TIMEOUT_MS,
    );
    if (!tokenResponse.access_token) {
      throw new Error('Managed Identity token response did not include an access token.');
    }
    cachedAccessToken = {
      token: tokenResponse.access_token,
      expiresAt: parseExpiresAt(tokenResponse),
    };
    return tokenResponse.access_token;
  }

  const imdsUrl = new URL('http://169.254.169.254/metadata/identity/oauth2/token');
  imdsUrl.searchParams.set('api-version', '2018-02-01');
  imdsUrl.searchParams.set('resource', COGNITIVE_RESOURCE);
  if (clientId) {
    imdsUrl.searchParams.set('client_id', clientId);
  }

  const tokenResponse = await fetchJsonWithTimeout<ManagedIdentityTokenResponse>(
    imdsUrl,
    { Metadata: 'true' },
    TOKEN_TIMEOUT_MS,
  );
  if (!tokenResponse.access_token) {
    throw new Error('IMDS token response did not include an access token.');
  }
  cachedAccessToken = {
    token: tokenResponse.access_token,
    expiresAt: parseExpiresAt(tokenResponse),
  };
  return tokenResponse.access_token;
};

export const getCognitiveAccessToken = async (): Promise<string> => {
  if (cachedAccessToken && cachedAccessToken.expiresAt - TOKEN_REFRESH_SKEW_MS > Date.now()) {
    return cachedAccessToken.token;
  }

  if (!pendingTokenRequest) {
    pendingTokenRequest = requestManagedIdentityToken().finally(() => {
      pendingTokenRequest = null;
    });
  }

  return pendingTokenRequest;
};

export const getAzureOpenAIAuthHeaders = async (
  apiKey?: string,
): Promise<Record<string, string>> => {
  if (apiKey) {
    return { 'api-key': apiKey };
  }

  const token = await getCognitiveAccessToken();
  return { Authorization: `Bearer ${token}` };
};

export function createAzureOpenAIClient(config: AzureOpenAIConfig): AzureOpenAI {
  const { endpoint, apiKey, apiVersion = '2025-04-01-preview', deploymentName } = config;

  if (apiKey) {
    return new AzureOpenAI({
      endpoint,
      apiKey,
      apiVersion,
      deployment: deploymentName,
    });
  }

  return new AzureOpenAI({
    endpoint,
    azureADTokenProvider: getCognitiveAccessToken,
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
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION?.trim() || '2025-04-01-preview';

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
  const base = readBaseEnv();
  const endpoint = process.env.AZURE_OPENAI_IMAGE_ENDPOINT?.trim() || base.endpoint;
  const apiKey =
    process.env.AZURE_OPENAI_IMAGE_API_KEY?.trim() ||
    base.apiKey;
  const apiVersion =
    process.env.AZURE_OPENAI_IMAGE_API_VERSION?.trim() ||
    process.env.AZURE_OPENAI_API_VERSION?.trim() ||
    '2025-04-01-preview';
  const deploymentName = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT_NAME?.trim() || 'gpt-image-2';
  return { endpoint, apiKey, deploymentName, apiVersion };
}

export function getAzureMAIImageConfig(): AzureOpenAIConfig {
  const endpoint =
    process.env.AZURE_MAI_ENDPOINT?.trim() ||
    process.env.AZURE_OPENAI_IMAGE_ENDPOINT?.trim() ||
    process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiKey =
    process.env.AZURE_MAI_API_KEY?.trim() ||
    process.env.AZURE_OPENAI_IMAGE_API_KEY?.trim() ||
    process.env.AZURE_OPENAI_API_KEY?.trim() ||
    undefined;
  const deploymentName =
    process.env.AZURE_MAI_IMAGE_DEPLOYMENT_NAME?.trim() ||
    'MAI-Image-2';

  if (!endpoint) {
    throw new Error(
      'AZURE_MAI_ENDPOINT or AZURE_OPENAI_IMAGE_ENDPOINT is required for MAI image generation.'
    );
  }
  try {
    new URL(endpoint);
  } catch {
    throw new Error('AZURE_MAI_ENDPOINT must be a valid URL.');
  }

  return { endpoint, apiKey, deploymentName };
}

export interface AzureOpenAIVideoEndpoint {
  endpoint: string;
  apiVersion: string;
  deploymentName: string;
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
    '2025-04-01-preview';
  const deploymentName =
    process.env.AZURE_OPENAI_VIDEO_DEPLOYMENT_NAME?.trim() || 'sora-2';

  if (!endpoint) {
    throw new Error(
      'Azure OpenAI video endpoint is not configured. Set AZURE_OPENAI_VIDEO_ENDPOINT or AZURE_OPENAI_ENDPOINT.'
    );
  }

  return {
    endpoint,
    apiVersion,
    deploymentName,
    getAuthHeaders: () => getAzureOpenAIAuthHeaders(apiKey),
  };
}

export const buildAzureOpenAIUrl = (
  endpoint: string,
  path: string,
  apiVersion: string,
  params: Record<string, string> = {},
): string => {
  const normalizedEndpoint = trimTrailingSlash(endpoint);
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${normalizedEndpoint}${normalizedPath}`);
  url.searchParams.set('api-version', apiVersion);
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
};
