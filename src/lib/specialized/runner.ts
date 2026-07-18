import {
  buildModelClarityAddendum,
  buildModelSystemPrompt,
  getComfyModelDefinition,
  type ComfyImageModel,
} from "../comfy-models";
import { getDetailLimits } from "../detail-level";
import {
  allowTemplateFallback,
  chatCompletion,
  isLlmEnabled,
} from "../llm-client";
import { stripPromptArtifacts } from "../prompt-cleanup";
import { sanitizeQwenPrompt } from "../qwen-clarity";
import type { DetailLevel } from "../detail-level";
import type { ToolGenerateResult, ToolLimits } from "./types";

export function buildToolResult(
  prompt: string,
  provider: ToolGenerateResult["provider"],
  model: ComfyImageModel,
  detail: DetailLevel,
  extras?: Partial<ToolGenerateResult>,
): ToolGenerateResult {
  const limits = getDetailLimits(detail, model);
  const modelDef = getComfyModelDefinition(model);

  return {
    prompt,
    provider,
    model,
    comfyNode: modelDef.comfyNode,
    limits: {
      minChars: limits.minChars,
      maxChars: limits.maxChars,
      maxSentences: limits.maxSentences,
      maxTokens: limits.maxTokens,
    },
    ...extras,
  };
}

export async function runSpecializedPrompt(options: {
  model: ComfyImageModel;
  detail: DetailLevel;
  toolInstructions: string;
  userMessage: string;
  templateFallback: () => string | Promise<string>;
  sanitizeInput?: string;
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
  seed?: string;
}): Promise<ToolGenerateResult> {
  const limits = getDetailLimits(options.detail, options.model);
  const maxTokens = options.maxTokens ?? limits.maxTokens;
  const systemPrompt = `${buildModelSystemPrompt(options.model, "positive")}

${options.toolInstructions}

${buildModelClarityAddendum(options.detail, options.model)}

Output ONLY the raw prompt text. No quotes around the whole prompt, labels, markdown, or explanations.`;

  if (isLlmEnabled()) {
    try {
      const content = await chatCompletion({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: options.userMessage },
        ],
        maxTokens,
        temperature: options.temperature,
      });

      const prompt = finalizeSpecializedPrompt(
        content,
        options.detail,
        options.model,
        options.sanitizeInput ?? options.userMessage,
      );

      return buildToolResult(prompt, "llm", options.model, options.detail, {
        seed: options.seed,
        metadata: options.metadata,
      });
    } catch (error) {
      if (!allowTemplateFallback()) {
        throw error instanceof Error ? error : new Error("Generation failed.");
      }
      console.warn(
        "[specialized-generator] LLM failed, using template fallback:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  const prompt = finalizeSpecializedPrompt(
    await Promise.resolve(options.templateFallback()),
    options.detail,
    options.model,
    options.sanitizeInput ?? options.userMessage,
  );

  return buildToolResult(prompt, "template", options.model, options.detail, {
    seed: options.seed,
    metadata: options.metadata,
  });
}

function finalizeSpecializedPrompt(
  raw: string,
  detail: DetailLevel,
  model: ComfyImageModel,
  input: string,
): string {
  const cleaned = stripPromptArtifacts(raw);
  return sanitizeQwenPrompt(cleaned, detail, input, model);
}

export function richDetailLimits(model: ComfyImageModel): ToolLimits {
  return getDetailLimits("rich", model);
}
