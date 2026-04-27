import { NextResponse } from "next/server";
import type { GeneratedImageSuggestion } from "@/types/generated";
import { describeError, resolveErrorStatus } from "@/lib/sora";
import {
  buildAzureOpenAIUrl,
  getAzureOpenAIAuthHeaders,
  getAzureOpenAIImageConfig,
} from "@/lib/azure-openai";

const IMAGE_MODEL_FALLBACK = "gpt-image-2";
const ALLOWED_IMAGE_MODELS = new Set<string>(["gpt-image-2", "gpt-image-1", "dall-e-3", "dall-e-2"]);
const MAX_IMAGE_COUNT = 4;
const DEFAULT_IMAGE_COUNT = 3;

type ImageSize =
  | "256x256"
  | "512x512"
  | "1024x1024"
  | "1024x1440"
  | "1024x1536"
  | "1440x1024"
  | "1536x1024"
  | "1024x1792"
  | "1792x1024";

const DEFAULT_IMAGE_SIZE: ImageSize = "1024x1024";
const ALLOWED_IMAGE_SIZES = new Set<ImageSize>([
  "256x256",
  "512x512",
  "1024x1024",
  "1024x1440",
  "1024x1536",
  "1440x1024",
  "1536x1024",
  "1024x1792",
  "1792x1024",
]);

type ImageGenerationResponse = {
  data?: Array<{
    b64_json?: string | null;
    url?: string | null;
  }>;
};

interface GenerateImagesPayload {
  prompt?: unknown;
  size?: unknown;
  count?: unknown;
  model?: unknown;
}

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const readNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const coerceImageCount = (value: unknown): number => {
  const parsed = readNumber(value);
  if (parsed === null) return DEFAULT_IMAGE_COUNT;
  if (parsed <= 1) return 1;
  if (parsed >= MAX_IMAGE_COUNT) return MAX_IMAGE_COUNT;
  return Math.round(parsed);
};

const coerceImageModel = (value: unknown): string => {
  const candidate = readString(value);
  if (!candidate) return IMAGE_MODEL_FALLBACK;
  if (ALLOWED_IMAGE_MODELS.has(candidate)) return candidate;
  return IMAGE_MODEL_FALLBACK;
};

const coerceImageSize = (value: unknown): ImageSize => {
  const candidate = readString(value);
  if (!candidate) return DEFAULT_IMAGE_SIZE;
  if (ALLOWED_IMAGE_SIZES.has(candidate as ImageSize)) {
    return candidate as ImageSize;
  }
  return DEFAULT_IMAGE_SIZE;
};

export async function POST(request: Request) {
  let config;
  try {
    config = getAzureOpenAIImageConfig();
  } catch (error) {
    const message = describeError(error, "Azure OpenAI configuration error");
    return NextResponse.json({ error: { message } }, { status: 500 });
  }

  let rawPayload: GenerateImagesPayload;
  try {
    rawPayload = (await request.json()) as GenerateImagesPayload;
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid JSON payload" } },
      { status: 400 }
    );
  }

  const prompt = readString(rawPayload.prompt);
  if (!prompt) {
    return NextResponse.json(
      { error: { message: "Prompt is required" } },
      { status: 400 }
    );
  }

  const size = coerceImageSize(rawPayload.size);
  const count = coerceImageCount(rawPayload.count);
  const model = coerceImageModel(rawPayload.model);

  try {
    const endpoint = buildAzureOpenAIUrl(
      config.endpoint,
      `/openai/deployments/${encodeURIComponent(config.deploymentName)}/images/generations`,
      config.apiVersion ?? "2025-04-01-preview",
    );
    const authHeaders = await getAzureOpenAIAuthHeaders(config.apiKey);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        n: count,
        output_format: "png",
        prompt,
        quality: "medium",
        size,
      }),
    });

    const generation = (await response.json().catch(() => null)) as
      | ImageGenerationResponse
      | null;
    if (!response.ok || !generation) {
      const message = describeError(generation, "Failed to generate images");
      const derivedStatus = generation ? resolveErrorStatus(generation) : undefined;
      const status =
        typeof derivedStatus === "number" && derivedStatus > 0
          ? derivedStatus
          : response.status || 500;
      return NextResponse.json({ error: { message } }, { status });
    }

    const suggestions = (generation.data ?? []).reduce<GeneratedImageSuggestion[]>(
      (acc, entry, index) => {
        const base64 = entry.b64_json ?? null;
        const url = base64
          ? `data:image/png;base64,${base64}`
          : readString(entry.url);
        if (!url) return acc;
        acc.push({
          id: `generated-${Date.now()}-${index}`,
          url,
          base64,
          description: prompt,
        });
        return acc;
      },
      [],
    );

    return NextResponse.json({ images: suggestions });
  } catch (error) {
    const message = describeError(error, "Failed to generate images");
    const status = resolveErrorStatus(error);
    return NextResponse.json({ error: { message } }, { status });
  }
}
