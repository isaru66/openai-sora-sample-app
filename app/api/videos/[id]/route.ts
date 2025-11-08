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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
  const azureApiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
  
  if (!azureEndpoint || !azureApiKey) {
    const message = "Azure OpenAI configuration is not complete. Please set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY";
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
      "api-key": azureApiKey,
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
