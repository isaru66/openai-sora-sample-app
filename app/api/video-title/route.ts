import { NextResponse } from "next/server";
import { describeError, resolveErrorStatus } from "@/lib/sora";
import { createAzureOpenAIClient, getAzureOpenAIConfig } from "@/lib/azure-openai";

export async function POST(request: Request) {
  let client;
  try {
    const config = getAzureOpenAIConfig();
    client = createAzureOpenAIClient(config);
  } catch (error) {
    const message = describeError(error, "Azure OpenAI configuration error");
    return NextResponse.json({ error: { message } }, { status: 500 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid JSON payload" } },
      { status: 400 }
    );
  }

  const prompt =
    typeof (payload as { prompt?: unknown })?.prompt === "string"
      ? (payload as { prompt: string }).prompt.trim()
      : "";
  if (!prompt) {
    return NextResponse.json(
      { error: { message: "Prompt is required" } },
      { status: 400 }
    );
  }

  try {
    const response = await client.chat.completions.create({
      model: "", // Azure OpenAI uses deployment name instead of model
      messages: [
        {
          role: "user",
          content: `Propose a short reel-style title for this video prompt (don't include quotes around the title): ${prompt}`,
        },
      ],
      max_tokens: 80,
    });

    const title = response.choices[0]?.message?.content?.trim();
    return NextResponse.json({ title });
  } catch (error) {
    const message = describeError(error, "Failed to generate title");
    const status = resolveErrorStatus(error);
    return NextResponse.json({ error: { message } }, { status });
  }
}
