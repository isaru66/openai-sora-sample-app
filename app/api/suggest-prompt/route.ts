import { NextResponse } from "next/server";
import {
  coerceVideoModel,
  coerceVideoSeconds,
  coerceVideoSize,
  describeError,
  resolveErrorStatus,
} from "@/lib/sora";
import { createAzureOpenAIClient, getAzureOpenAIConfig } from "@/lib/azure-openai";
import { getImagePromptTemplate } from "@/lib/image-prompt-templates";

// Model is determined by deployment name in Azure OpenAI

interface SuggestPromptPayload {
  prompt?: unknown;
  model?: unknown;
  size?: unknown;
  seconds?: unknown;
  mode?: unknown;
  imageTemplateId?: unknown;
  imageModel?: unknown;
  imageSize?: unknown;
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
  const mode = readString(payload.mode) === "image" ? "image" : "video";
  const model = coerceVideoModel(readString(payload.model));
  const size = coerceVideoSize(readString(payload.size));
  const seconds = coerceVideoSeconds(readString(payload.seconds));
  const imageTemplate = getImagePromptTemplate(readString(payload.imageTemplateId));
  const imageModel = readString(payload.imageModel) ?? "gpt-image-2";
  const imageSize = readString(payload.imageSize) ?? "1024x1024";

  const contextLines = mode === "image"
    ? [
        `Target model: ${imageModel}`,
        `Image size: ${imageSize}`,
        `Selected template: ${imageTemplate.label}`,
        `Template category: ${imageTemplate.category}`,
        `Preferred aspect ratio: ${imageTemplate.preferredAspectRatio}`,
        `Template prompt: ${imageTemplate.prompt}`,
      ]
    : [
        `Target model: ${model}`,
        `Frame size: ${size}`,
        `Duration: ${seconds} seconds`,
      ];

  if (existingPrompt) {
    contextLines.push(
      mode === "image"
        ? `User draft to fine-tune: ${existingPrompt}`
        : `Existing prompt: ${existingPrompt}`,
    );
  }

  try {
    const response = await client.chat.completions.create({
      model: "", // Azure OpenAI uses deployment name instead of model
      max_tokens: mode === "image" ? 900 : 700,
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content: mode === "image"
            ? "You are a GPT-Image-2 prompt engineer. Produce one production-ready image prompt only, no headings or bullets. Use the selected template as the primary structure. If the user provided a draft, fine-tune it into the template instead of replacing the intent. Compose natural director-style sentences in this order when relevant: style/medium, subject, environment/setting, lighting, composition, technical specs, exact text overlay wrapped in single quotes, texture or micro-details, negative constraints, and explicit aspect ratio. Front-load the most important details in the first 50 words. Keep unresolved user-editable placeholders in [BRACKETS] when no value was provided."
            : "You are a creative director crafting production-ready prompts for the OpenAI Sora model. Respond with one prompt only. Include visual style, timing/scene beats, on-screen text when useful, camera motion, audio or voiceover direction, and reference-image instructions when the user mentions a character or uploaded image.",
        },
        {
          role: "user",
          content: `Context for the ${mode} prompt:\n${contextLines.join("\n")}`,
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
