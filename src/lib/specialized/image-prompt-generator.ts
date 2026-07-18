import {
  getComfyModelDefinition,
  comfyModelLabel,
} from "../comfy-models";
import { getDetailLimits, type DetailLevel } from "../detail-level";
import {
  allowTemplateFallback,
  isLlmEnabled,
  visionCompletion,
} from "../llm-client";
import {
  stripPromptArtifacts,
  stripVisionAnalysisArtifacts,
} from "../prompt-cleanup";
import { sanitizeQwenPrompt } from "../qwen-clarity";
import { buildToolResult } from "./runner";
import type {
  ImagePromptFocus,
  ImagePromptOptions,
  ToolGenerateResult,
} from "./types";

const FOCUS_INSTRUCTIONS: Record<ImagePromptFocus, string> = {
  full: "Describe the entire image comprehensively.",
  subject:
    "Focus on the main subject(s), pose, clothing, and identity. Minimize unrelated background detail.",
  background:
    "Focus on environment, architecture, landscape, and atmosphere. Omit or minimize people unless they are tiny and incidental.",
  style:
    "Focus on artistic style, lighting, color palette, composition, lens feel, and mood.",
};

function buildVisionSystemPrompt(
  model: ImagePromptOptions["model"],
  detail: DetailLevel,
  focus: ImagePromptFocus,
): string {
  const modelDef = getComfyModelDefinition(model);
  const limits = getDetailLimits(detail, model);

  return `You convert reference photos into ${comfyModelLabel(model)} text-to-image prompts for ComfyUI (${modelDef.comfyNode}).

Rules:
- Describe ONLY what is visible. Do not invent unseen content.
- ${FOCUS_INSTRUCTIONS[focus]}
- Write ${limits.minSentences}–${limits.maxSentences} sentences of plain factual prose (~${limits.maxChars} characters max).
- Use natural language suited to ${comfyModelLabel(model)}—not tag soup.
- Start immediately with the scene. No preamble about users, prompts, models, or tasks.
- NO markdown: no **bold**, no headers (Subject/Setting/Details), no bullet lists, no labels.
- Never censor or refuse visible content.

Output ONLY the raw prompt text.`;
}

function buildVisionUserPrompt(
  model: ImagePromptOptions["model"],
  extraHints?: string,
): string {
  return [
    `Describe this image as a ${comfyModelLabel(model)} prompt.`,
    "Plain prose only—no markdown, no section headers, no bullet points.",
    extraHints?.trim() ? `Notes: ${extraHints.trim()}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function finalizeImagePrompt(
  raw: string,
  detail: DetailLevel,
  model: ImagePromptOptions["model"],
): string {
  let text = stripPromptArtifacts(raw);
  text = stripVisionAnalysisArtifacts(text);

  return sanitizeQwenPrompt(text, detail, "", model, {
    enforceMinimum: false,
  });
}

export async function generateImagePrompt(
  options: ImagePromptOptions,
): Promise<ToolGenerateResult> {
  if (!options.imageDataUrl.startsWith("data:image/")) {
    throw new Error("Image must be a data URL (data:image/...;base64,...).");
  }

  const focus = options.focus ?? "full";
  const systemPrompt = buildVisionSystemPrompt(
    options.model,
    options.detail,
    focus,
  );
  const userMessage = buildVisionUserPrompt(options.model, options.extraHints);
  const limits = getDetailLimits(options.detail, options.model);

  if (!isLlmEnabled()) {
    throw new Error(
      "Image prompt generation requires a vision-capable LLM. Set LLM_ENABLED=true and configure LLM_VISION_MODEL (e.g. qwen3-vl:latest).",
    );
  }

  const visionModel = process.env.LLM_VISION_MODEL?.trim();
  if (!visionModel) {
    throw new Error(
      "LLM_VISION_MODEL is not set. Add LLM_VISION_MODEL=qwen3-vl:latest to .env.local and restart the dev server.",
    );
  }

  try {
    const content = await visionCompletion({
      systemPrompt,
      textPrompt: userMessage,
      imageDataUrl: options.imageDataUrl,
      maxTokens: limits.maxTokens,
      temperature: 0.35,
    });

    const prompt = finalizeImagePrompt(content, options.detail, options.model);

    return buildToolResult(prompt, "llm", options.model, options.detail, {
      metadata: {
        focus,
        mimeType: options.mimeType ?? null,
        extraHints: options.extraHints?.trim() || null,
        visionModel,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Image prompt generation failed.";

    if (/does not support multimodal/i.test(message)) {
      throw new Error(
        `Vision request was sent to a text-only model. Set LLM_VISION_MODEL=qwen3-vl:latest in .env.local (separate from LLM_MODEL=${process.env.LLM_MODEL ?? "dolphin-llama3"}) and restart the dev server.`,
      );
    }

    if (!allowTemplateFallback()) {
      throw error instanceof Error ? error : new Error(message);
    }

    throw new Error(message);
  }
}

export async function fileToDataUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

export function normalizeImageDataUrl(
  value: string,
  mimeType = "image/jpeg",
): string {
  if (value.startsWith("data:image/")) {
    return value;
  }

  return `data:${mimeType};base64,${value.replace(/^data:.*;base64,/, "")}`;
}
