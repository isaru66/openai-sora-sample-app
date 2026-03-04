import { Buffer } from "node:buffer";
import {
  coerceVideoModel,
  coerceVideoSeconds,
  coerceVideoSize,
  describeError,
  isRecord,
  normalizeVideoResponse,
  resolveErrorStatus,
  VideoRequestPayload,
} from "@/lib/sora";
import { getAzureAuthHeaders } from "@/lib/azure-openai";

type VideoCreateParams = {
  prompt: string;
  model: string;
  size: string;
  seconds: string;
};

export async function POST(request: Request) {
  // For video generation, we call the REST API directly with an Azure AD Bearer token
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();

  if (!azureEndpoint) {
    const message = "Azure OpenAI configuration is not complete. Please set AZURE_OPENAI_ENDPOINT.";
    return Response.json({ error: { message } }, { status: 500 });
  }

  let azureAuthHeaders: Record<string, string>;
  try {
    azureAuthHeaders = await getAzureAuthHeaders();
  } catch (error) {
    const message = describeError(error, "Failed to acquire Azure auth credentials");
    return Response.json({ error: { message } }, { status: 500 });
  }

  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch {
    return Response.json(
      { error: { message: "Invalid JSON payload" } },
      { status: 400 }
    );
  }

  const payload = isRecord(rawPayload) ? rawPayload : {};

  const prompt =
    typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  if (!prompt) {
    return Response.json(
      { error: { message: "Prompt is required" } },
      { status: 400 }
    );
  }

  const model = coerceVideoModel(
    typeof payload.model === "string" ? payload.model : null
  );
  const size = coerceVideoSize(
    typeof payload.size === "string" ? payload.size : null
  );
  const seconds = coerceVideoSeconds(
    payload.seconds != null ? String(payload.seconds) : null
  );

  const imageData = isRecord(payload.image) ? payload.image : null;

  const videoPayload: VideoRequestPayload = {
    prompt,
    model,
    size,
    seconds,
  };

  try {
    // For Azure OpenAI, construct the endpoint for video generation
    const endpoint = `${azureEndpoint}/openai/v1/videos`;
    const headers: Record<string, string> = {
      ...azureAuthHeaders,
      "api-version": process.env.AZURE_OPENAI_API_VERSION || "2024-10-21",
    };

    let response: Response;
    if (imageData?.data != null) {
      const formData = new FormData();
      formData.set("prompt", prompt);
      formData.set("model", model);
      formData.set("size", size);
      formData.set("seconds", seconds);

      const buffer = Buffer.from(String(imageData.data), "base64");
      const mimeType =
        typeof imageData.mimeType === "string" && imageData.mimeType.trim()
          ? imageData.mimeType
          : "image/png";
      const filename =
        typeof imageData.name === "string" && imageData.name.trim()
          ? imageData.name.trim()
          : "input-reference";
      const blob = new Blob([buffer], { type: mimeType });
      formData.append("input_reference", blob, filename);

      response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: formData,
      });
    } else {
      headers["Content-Type"] = "application/json";
      const payload: VideoCreateParams = {
        prompt,
        model,
        size,
        seconds,
      };
      response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    }

    const result = await response.json().catch(() => null);
    if (!response.ok || !result) {
      const message = describeError(result, "Failed to create video");
      const derivedStatus = result ? resolveErrorStatus(result) : undefined;
      const status =
        typeof derivedStatus === "number" && derivedStatus > 0
          ? derivedStatus
          : response.status || 500;
      return Response.json({ error: { message } }, { status });
    }

    const normalized = normalizeVideoResponse(result, videoPayload);
    return Response.json(normalized);
  } catch (error) {
    console.error("generate-video error", error);
    const message = describeError(error, "Failed to create video");
    const status = resolveErrorStatus(error);
    return Response.json({ error: { message } }, { status });
  }
}
