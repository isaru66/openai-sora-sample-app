import { NextResponse } from "next/server";
import type { GeneratedImageSuggestion } from "@/types/generated";
import { describeError, resolveErrorStatus } from "@/lib/sora";
import {
  buildAzureOpenAIUrl,
  getAzureOpenAIAuthHeaders,
  getAzureOpenAIImageConfig,
  getAzureMAIImageConfig,
} from "@/lib/azure-openai";

const IMAGE_MODEL_FALLBACK = "gpt-image-2";
const MAI_IMAGE_MODEL = "MAI-Image-2";
const ALLOWED_IMAGE_MODELS = new Set<string>(["gpt-image-2", MAI_IMAGE_MODEL]);
const MAX_IMAGE_COUNT = 4;
const DEFAULT_IMAGE_COUNT = 3;

type ImageSize =
  | "256x256"
  | "512x512"
  | "1024x1024"
  | "768x1365"
  | "1024x1440"
  | "1024x1536"
  | "1365x768"
  | "1440x1024"
  | "1536x1024"
  | "1024x1792"
  | "1792x1024";

const DEFAULT_IMAGE_SIZE: ImageSize = "1024x1024";
const ALLOWED_IMAGE_SIZES = new Set<ImageSize>([
  "256x256",
  "512x512",
  "1024x1024",
  "768x1365",
  "1024x1440",
  "1024x1536",
  "1365x768",
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

const toImageGenerationResponse = (
  payloads: ImageGenerationResponse[],
): ImageGenerationResponse => ({
  data: payloads.flatMap((payload) => payload.data ?? []),
});

interface GenerateImagesPayload {
  prompt?: unknown;
  size?: unknown;
  count?: unknown;
  model?: unknown;
  image?: unknown;
}

interface ImageInputPayload {
  data: string;
  mimeType?: string;
  name?: string;
}

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const readImageInput = (value: unknown): ImageInputPayload | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const data = readString(candidate.data);
  if (!data) return null;
  return {
    data: data.includes(",") ? data.split(",").pop() ?? data : data,
    mimeType: readString(candidate.mimeType) ?? "image/png",
    name: readString(candidate.name) ?? "reference-image.png",
  };
};

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
  if (candidate.toLowerCase() === "mai") return MAI_IMAGE_MODEL;
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

const parseDimensions = (size: ImageSize): { width: number; height: number } => {
  const [widthRaw, heightRaw] = size.split("x");
  const width = Number(widthRaw);
  const height = Number(heightRaw);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return { width: 1024, height: 1024 };
  }
  return { width, height };
};

const generateWithGptImage = async ({
  prompt,
  size,
  count,
  model,
  image,
}: {
  prompt: string;
  size: ImageSize;
  count: number;
  model: string;
  image: ImageInputPayload | null;
}): Promise<{ generation: ImageGenerationResponse | null; status: number; ok: boolean }> => {
  const config = getAzureOpenAIImageConfig();
  const basePath = `/openai/deployments/${encodeURIComponent(config.deploymentName)}/images`;
  const endpoint = buildAzureOpenAIUrl(
    config.endpoint,
    `${basePath}/${image ? "edits" : "generations"}`,
    config.apiVersion ?? "2025-04-01-preview",
  );
  const authHeaders = await getAzureOpenAIAuthHeaders(config.apiKey);
  const response = image
    ? await fetch(endpoint, {
        method: "POST",
        headers: authHeaders,
        body: (() => {
          const form = new FormData();
          const imageBuffer = Buffer.from(image.data, "base64");
          const imageBlob = new Blob([imageBuffer], {
            type: image.mimeType || "image/png",
          });
          form.set("image", imageBlob, image.name || "reference-image.png");
          form.set("prompt", prompt);
          form.set("n", String(count));
          form.set("quality", "medium");
          form.set("size", size);
          return form;
        })(),
      })
    : await fetch(endpoint, {
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

  return {
    generation: (await response.json().catch(() => null)) as ImageGenerationResponse | null,
    ok: response.ok,
    status: response.status,
  };
};

const generateWithMaiImage = async ({
  prompt,
  size,
  count,
}: {
  prompt: string;
  size: ImageSize;
  count: number;
}): Promise<{ generation: ImageGenerationResponse | null; status: number; ok: boolean }> => {
  const config = getAzureMAIImageConfig();
  const endpoint = `${config.endpoint.replace(/\/+$/, "")}/mai/v1/images/generations`;
  const authHeaders = await getAzureOpenAIAuthHeaders(config.apiKey);
  const { width, height } = parseDimensions(size);
  const generations: ImageGenerationResponse[] = [];

  for (let index = 0; index < count; index += 1) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.deploymentName,
        prompt,
        width,
        height,
      }),
    });
    const generation = (await response.json().catch(() => null)) as
      | ImageGenerationResponse
      | null;
    if (!response.ok || !generation) {
      return { generation, ok: response.ok, status: response.status };
    }
    generations.push(generation);
  }

  return { generation: toImageGenerationResponse(generations), ok: true, status: 200 };
};

export async function POST(request: Request) {
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
  const image = readImageInput(rawPayload.image);

  try {
    if (image && model === MAI_IMAGE_MODEL) {
      return NextResponse.json(
        {
          error: {
            message:
              "Reference images are supported for GPT-image-2. Switch the image model to GPT-image-2 to use the attached image.",
          },
        },
        { status: 400 },
      );
    }

    console.log("Image generation request", {
      model,
      size,
      count,
      hasReferenceImage: Boolean(image),
    });

    const result = model === MAI_IMAGE_MODEL
      ? await generateWithMaiImage({ prompt, size, count })
      : await generateWithGptImage({ prompt, size, count, model, image });

    const { generation } = result;
    if (!result.ok || !generation) {
      const message = describeError(generation, "Failed to generate images");
      console.error("Image generation failed", {
        model,
        status: result.status,
        message,
      });
      const derivedStatus = generation ? resolveErrorStatus(generation) : undefined;
      const status =
        typeof derivedStatus === "number" && derivedStatus > 0
          ? derivedStatus
          : result.status || 500;
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
          model,
          size,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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
