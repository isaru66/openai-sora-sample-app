import { NextResponse } from "next/server";
import type { GeneratedImageSuggestion } from "@/types/generated";
import { describeError, resolveErrorStatus } from "@/lib/sora";
import { createAzureOpenAIClient, getAzureOpenAIImageConfig } from "@/lib/azure-openai";
import axios, { AxiosRequestConfig } from "axios";

const IMAGE_MODEL_FALLBACK = "dall-e-3";
const ALLOWED_IMAGE_MODELS = new Set<string>(["gpt-image-1","dall-e-3", "dall-e-2"]);
const MAX_IMAGE_COUNT = 4;
const DEFAULT_IMAGE_COUNT = 3;

type ImageSize = "256x256" | "512x512" | "1024x1024" | "1024x1536" | "1536x1024" | "1024x1792" | "1792x1024";

const DEFAULT_IMAGE_SIZE: ImageSize = "1024x1024";
const ALLOWED_IMAGE_SIZES = new Set<ImageSize>([
  "256x256",
  "512x512",
  "1024x1024",
  "1024x1536",
  "1536x1024",
  "1024x1792",
  "1792x1024",
]);

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
  let client;
  try {
    const config = getAzureOpenAIImageConfig();
    client = createAzureOpenAIClient(config);
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
    /*
    // Commented out OpenAI gpt-image-1 generation, replace with BFR-Flux-1.1

    const generation = await client.images.generate({
      model: "FLUX-1.1-pro",
      prompt,
      size,
      quality: "high",
      output_format: "png",
      n: count,
    });

    const suggestions = (generation.data ?? []).reduce<
      GeneratedImageSuggestion[]
    >((acc: GeneratedImageSuggestion[], entry: { b64_json?: string; url?: string }, index: number) => {
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
    }, []);
    */
    
    // BlackForest Flux-1.1 image generation via Azure OpenAI REST API
    const endpoint = process.env["AZURE_OPENAI_ENDPOINT"] || "https://ai-isarar-2855.cognitiveservices.azure.com/";
    const deployment = "FLUX-1.1-pro";
    const apiVersion = "2025-04-01-preview";
    const subscriptionKey = process.env["AZURE_OPENAI_API_KEY"];

    const generationsPath = `openai/deployments/${deployment}/images/generations`;
    const params = `?api-version=${apiVersion}`;
    const generationsUrl = `${endpoint}${generationsPath}${params}`;
    
    const generationBody = {
      prompt,
      n: count,
      size,
      output_format: "png",
    };
    const headers: AxiosRequestConfig = {
      headers: {
        "Api-Key": subscriptionKey,
        "Content-Type": "application/json",
      },
    };
    const generationResponse = await axios.post(generationsUrl, generationBody, headers);
    
    const imageData = (generationResponse.data?.data ?? []) as Array<{ b64_json?: string; url?: string }>;
    const suggestions = imageData.reduce<GeneratedImageSuggestion[]>((acc: GeneratedImageSuggestion[], entry: { b64_json?: string; url?: string }, index: number) => {
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
    }, []);

    return NextResponse.json({ images: suggestions });
  } catch (error) {
    const message = describeError(error, "Failed to generate images");
    const status = resolveErrorStatus(error);
    return NextResponse.json({ error: { message } }, { status });
  }
}
