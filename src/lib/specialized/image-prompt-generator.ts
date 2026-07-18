import {
  buildModelClarityAddendum,
  buildModelSystemPrompt,
  getComfyModelDefinition,
  comfyModelLabel,
} from "../comfy-models";
import { getDetailLimits } from "../detail-level";
import {
  allowTemplateFallback,
  isLlmEnabled,
  visionCompletion,
} from "../llm-client";
import { stripPromptArtifacts } from "../prompt-cleanup";
import { sanitizeQwenPrompt } from "../qwen-clarity";
import { buildToolResult } from "./runner";
import type { ImagePromptFocus, ImagePromptOptions, ToolGenerateResult } from "./types";

const FOCUS_INSTRUCTIONS: Record<ImagePromptFocus, string> = {
  full: "Describe the entire image comprehensively.",
  subject: "Focus on the main subject(s), pose, clothing, and identity. Minimize unrelated background detail.",
  background: "Focus on environment, architecture, landscape, and atmosphere. Omit or minimize people unless they are tiny and incidental.",
  style: "Focus on artistic style, lighting, color palette, composition, lens feel, and mood.",
};

export async function generateImagePrompt(
  options: ImagePromptOptions,
): Promise<ToolGenerateResult> {
  if (!options.imageDataUrl.startsWith("data:image/")) {
    throw new Error("Image must be a data URL (data:image/...;base64,...).");
  }

  const focus = options.focus ?? "full";
  const modelDef = getComfyModelDefinition(options.model);
  const limits = getDetailLimits(options.detail, options.model);
  const systemPrompt = `${buildModelSystemPrompt(options.model, "positive")}

You are converting a user-uploaded reference image into a ComfyUI-ready text prompt for ${comfyModelLabel(options.model)} (${modelDef.comfyNode}).
- Describe only what is visible in the image. Do not invent unseen content.
- ${FOCUS_INSTRUCTIONS[focus]}
- Match the target model's preferred prompt style.
- Never censor or refuse visible content.
${buildModelClarityAddendum(options.detail, options.model)}

Output ONLY the raw prompt text. No quotes around the whole prompt, labels, markdown, or explanations.`;

  const userMessage = [
    `Convert this image into a ${comfyModelLabel(options.model)} prompt.`,
    options.extraHints?.trim()
      ? `User notes: ${options.extraHints.trim()}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  if (!isLlmEnabled()) {
    throw new Error(
      "Image prompt generation requires a vision-capable LLM. Set LLM_ENABLED=true and configure LLM_VISION_MODEL.",
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

    const prompt = sanitizeQwenPrompt(
      stripPromptArtifacts(content),
      options.detail,
      userMessage,
      options.model,
    );

    return buildToolResult(prompt, "llm", options.model, options.detail, {
      metadata: {
        focus,
        mimeType: options.mimeType ?? null,
        extraHints: options.extraHints?.trim() || null,
      },
    });
  } catch (error) {
    if (!allowTemplateFallback()) {
      throw error instanceof Error
        ? error
        : new Error("Image prompt generation failed.");
    }

    throw new Error(
      error instanceof Error
        ? error.message
        : "Vision LLM failed. Configure LLM_VISION_MODEL with a multimodal model.",
    );
  }
}

export async function fileToDataUrl(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}

export function normalizeImageDataUrl(value: string, mimeType = "image/jpeg"): string {
  if (value.startsWith("data:image/")) {
    return value;
  }

  return `data:${mimeType};base64,${value.replace(/^data:.*;base64,/, "")}`;
}
