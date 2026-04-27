import { describeError, resolveErrorStatus } from "@/lib/sora";
import { buildAzureOpenAIUrl, getAzureOpenAIVideoEndpoint } from "@/lib/azure-openai";

const asVariant = (value: string | null): "video" | "thumbnail" | "spritesheet" | undefined => {
  if (!value) return undefined;
  if (value === "video" || value === "thumbnail" || value === "spritesheet") {
    return value;
  }
  return undefined;
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let videoCfg;
  try {
    videoCfg = getAzureOpenAIVideoEndpoint();
  } catch (error) {
    const message = describeError(error, "Azure OpenAI video configuration error");
    return Response.json({ error: { message } }, { status: 500 });
  }
  const azureEndpoint = videoCfg.endpoint;

  const { id } = await params;
  const videoId = typeof id === "string" ? id.trim() : "";
  if (!videoId) {
    return Response.json({ error: { message: "Video id is required" } }, { status: 400 });
  }

  const url = new URL(request.url);
  const variant = asVariant(url.searchParams.get("variant"));

  try {
    // For Azure OpenAI, construct the endpoint for video content
    const endpoint = buildAzureOpenAIUrl(
      azureEndpoint,
      `/openai/v1/videos/${encodeURIComponent(videoId)}/content`,
      videoCfg.apiVersion,
      variant ? { variant } : {},
    );
    const authHeaders = await videoCfg.getAuthHeaders();
    const headers = {
      "Accept": "application/binary",
      ...authHeaders,
    };

    const response = await fetch(endpoint, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Failed to fetch video content");
      const message = describeError({ message: errorText }, "Failed to fetch video content");
      return Response.json({ error: { message } }, { status: response.status || 500 });
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type")
      || (variant === "thumbnail" ? "image/png" : "video/mp4");

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    const message = describeError(error, "Failed to fetch video content");
    const status = resolveErrorStatus(error);
    return Response.json({ error: { message } }, { status });
  }
}
