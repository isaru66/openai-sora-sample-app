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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const videoId = typeof id === "string" ? id.trim() : "";
  if (!videoId) {
    return Response.json(
      { error: { message: "Video id is required" } },
      { status: 400 }
    );
  }

  try {
    // For Azure OpenAI, construct the endpoint for video status
    const endpoint = `${azureEndpoint}/openai/v1/videos/${videoId}`;
    const headers = {
      ...azureAuthHeaders,
      "api-version": process.env.AZURE_OPENAI_API_VERSION || "2024-10-21",
    };

    const response = await fetch(endpoint, {
      method: "GET",
      headers,
    });

    const video = await response.json().catch(() => null);
    if (!response.ok || !video) {
      const message = describeError(video, "Failed to fetch video");
      const derivedStatus = video ? resolveErrorStatus(video) : undefined;
      const status =
        typeof derivedStatus === "number" && derivedStatus > 0
          ? derivedStatus
          : response.status || 500;
      return Response.json({ error: { message } }, { status });
    }

    const videoRecord = isRecord(video) ? video : {};

    const prompt =
      typeof videoRecord.prompt === "string" && videoRecord.prompt.trim()
        ? videoRecord.prompt.trim()
        : "";

    const fallback: VideoRequestPayload = {
      prompt,
      model: coerceVideoModel(
        typeof videoRecord.model === "string" ? videoRecord.model : null
      ),
      size: coerceVideoSize(
        typeof videoRecord.size === "string" ? videoRecord.size : null
      ),
      seconds: coerceVideoSeconds(
        videoRecord.seconds !== undefined && videoRecord.seconds !== null
          ? String(videoRecord.seconds)
          : null
      ),
    };

    const normalized = normalizeVideoResponse(video, fallback);
    return Response.json(normalized);
  } catch (error) {
    const message = describeError(error, "Failed to fetch video");
    const status = resolveErrorStatus(error);
    return Response.json({ error: { message } }, { status });
  }
}
