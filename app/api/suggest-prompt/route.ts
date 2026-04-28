import { NextResponse } from "next/server";
import {
  coerceVideoModel,
  coerceVideoSeconds,
  coerceVideoSize,
  describeError,
  resolveErrorStatus,
} from "@/lib/sora";
import { createAzureOpenAIClient, getAzureOpenAIConfig } from "@/lib/azure-openai";

// Model is determined by deployment name in Azure OpenAI

interface SuggestPromptPayload {
  prompt?: unknown;
  model?: unknown;
  size?: unknown;
  seconds?: unknown;
}

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

// Removed unused functions - using direct chat completion response parsing

export async function POST(request: Request) {
  let client;
  try {
    const config = getAzureOpenAIConfig();
    client = createAzureOpenAIClient(config);
  } catch (error) {
    const message = describeError(error, "Azure OpenAI configuration error");
    return NextResponse.json({ error: { message } }, { status: 500 });
  }

  let payload: SuggestPromptPayload;
  try {
    payload = (await request.json()) as SuggestPromptPayload;
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON payload" } }, { status: 400 });
  }

  const existingPrompt = readString(payload.prompt);
  const model = coerceVideoModel(readString(payload.model));
  const size = coerceVideoSize(readString(payload.size));
  const seconds = coerceVideoSeconds(readString(payload.seconds));

  const contextLines = [
    `Target model: ${model}`,
    `Frame size: ${size}`,
    `Duration: ${seconds} seconds`,
  ];

  if (existingPrompt) {
    contextLines.push(`Existing prompt: ${existingPrompt}`);
  }

  try {
    const response = await client.chat.completions.create({
      model: "", // Azure OpenAI uses deployment name instead of model
      max_tokens: 700,
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: "You are a creative director crafting production-ready prompts for the OpenAI Sora model. Respond with one prompt only. Include visual style, timing/scene beats, on-screen text when useful, camera motion, audio or voiceover direction, and reference-image instructions when the user mentions a character or uploaded image.",
        },
        {
          role: "user",
          content: `Context for the video prompt:\n${contextLines.join("\n")}`,
        },
      ],
    });

    const suggestion = response.choices[0]?.message?.content?.trim();
    if (!suggestion) {
      return NextResponse.json(
        { error: { message: "Prompt suggestion unavailable. Try again." } },
        { status: 502 },
      );
    }

    return NextResponse.json({ prompt: suggestion });
  } catch (error) {
    const message = describeError(error, "Failed to generate prompt suggestion");
    const status = resolveErrorStatus(error);
    return NextResponse.json({ error: { message } }, { status });
  }
}
