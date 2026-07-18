import type { DetailLevel } from "./detail-level";
import { getDetailLimits, normalizeDetailLevel } from "./detail-level";
import { sanitizeQwenPrompt } from "./qwen-clarity";
import { stripPromptArtifacts } from "./prompt-cleanup";
import {
  buildModelClarityAddendum,
  buildModelSystemPrompt,
  formatPromptForModel,
  fluxIgnoresNegative,
  getComfyModelDefinition,
  isEditInstructionProfile,
  normalizeQwenModel,
  type ComfyImageModel,
} from "./comfy-models";

export type FormatMode = "positive" | "negative";

export type FormatSettings = {
  model: ComfyImageModel;
  detail: DetailLevel;
  mode: FormatMode;
  smartFormat: boolean;
};

export type FormatResult = {
  prompt: string;
  mode: FormatMode;
  model: ComfyImageModel;
  comfyNode: string;
  provider: "llm" | "rules";
  limits: {
    minChars?: number;
    maxChars: number;
    maxSentences: number;
    maxTokens: number;
  };
  inputChars: number;
  outputChars: number;
};

const DEFAULT_FORMAT_SETTINGS: FormatSettings = {
  model: "qwen-image-edit",
  detail: "balanced",
  mode: "positive",
  smartFormat: true,
};

export function normalizeFormatSettings(
  value?: Partial<Omit<FormatSettings, "model" | "detail">> & {
    model?: string | ComfyImageModel;
    detail?: string | DetailLevel;
  } | null,
): FormatSettings {
  return {
    model: normalizeQwenModel(value?.model),
    detail: normalizeDetailLevel(value?.detail),
    mode: value?.mode === "negative" ? "negative" : "positive",
    smartFormat:
      typeof value?.smartFormat === "boolean"
        ? value.smartFormat
        : DEFAULT_FORMAT_SETTINGS.smartFormat,
  };
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function cleanDraft(raw: string): string {
  return stripPromptArtifacts(raw);
}

function isSceneDescription(text: string): boolean {
  return /[.!?]\s/.test(text) && splitSentences(text).length >= 2;
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function looksLikeTagSoup(text: string): boolean {
  if (/[.!?]\s/.test(text) && text.split(/[.!?]/).filter(Boolean).length >= 2) {
    return false;
  }

  const parts = text.split(/[,;|]+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3) {
    return false;
  }

  const avgPartLen =
    parts.reduce((sum, part) => sum + part.length, 0) / parts.length;
  return avgPartLen < 35;
}

function tagSoupToProse(text: string): string {
  const parts = text.split(/[,;|]+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return text;
  }

  const [primary, ...supporting] = parts;
  const lead = capitalize(primary!);

  if (supporting.length === 0) {
    return `${lead} under clear directional light in a unified scene.`;
  }

  if (supporting.length === 1) {
    return `${lead}, with ${supporting[0]!.toLowerCase()}, under clear directional light.`;
  }

  return `${lead}, featuring ${supporting.slice(0, -1).join(", ").toLowerCase()}, and ${supporting.at(-1)!.toLowerCase()}, in one cohesive scene with readable lighting.`;
}

function applyModelStructure(
  text: string,
  settings: FormatSettings,
): string {
  const profile = getComfyModelDefinition(settings.model).profile;

  if (settings.mode === "negative") {
    if (fluxIgnoresNegative(profile)) {
      const stripped = text
        .replace(/\b(do not|don't|avoid|no|never)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      return `Stable composition with unchanged identity and proportions. ${capitalize(stripped)}.`;
    }
    return text;
  }

  if (profile === "qwen_edit_instruction") {
    const hasEditPattern =
      /\b(keep|preserve|replace|change|figure\s*[12])\b/i.test(text);

    if (hasEditPattern || /^replace the scene with/i.test(text)) {
      return text;
    }

    if (looksLikeTagSoup(text)) {
      const prose = tagSoupToProse(text);
      return `Replace the scene with ${prose.charAt(0).toLowerCase() + prose.slice(1)}`;
    }

    if (isSceneDescription(text)) {
      return `Replace the scene with ${text.charAt(0).toLowerCase() + text.slice(1)}`;
    }

    if (!/^replace\b/i.test(text) && !/^keep\b/i.test(text)) {
      return `Replace the scene with ${text.charAt(0).toLowerCase() + text.slice(1)}`;
    }
  }

  if (profile === "instruct_pix2pix") {
    if (/^(make|turn|change|add|remove|transform)\b/i.test(text)) {
      return text;
    }
    if (looksLikeTagSoup(text)) {
      const prose = tagSoupToProse(text);
      return `Transform the image to show ${prose.charAt(0).toLowerCase() + prose.slice(1)}`;
    }
    if (!/^transform the image\b/i.test(text)) {
      return `Transform the image to show ${text.charAt(0).toLowerCase() + text.slice(1)}`;
    }
  }

  if (profile === "omnigen_instruction" && !/\b(keep|replace|change|figure\s*[12])\b/i.test(text)) {
    if (looksLikeTagSoup(text)) {
      const prose = tagSoupToProse(text);
      return `Generate an image showing ${prose.charAt(0).toLowerCase() + prose.slice(1)}`;
    }
    return text;
  }

  if (profile === "sd15_weighted" && looksLikeTagSoup(text)) {
    return text;
  }

  if (
    (profile === "flux_klein" ||
      profile === "flux_prose" ||
      profile === "flux_schnell") &&
    looksLikeTagSoup(text)
  ) {
    return tagSoupToProse(text);
  }

  if (isEditInstructionProfile(profile) && looksLikeTagSoup(text)) {
    return tagSoupToProse(text);
  }

  return text;
}

function finalizeFormattedPrompt(
  raw: string,
  input: string,
  settings: FormatSettings,
): string {
  const cleaned = applyModelStructure(cleanDraft(raw), settings);
  const sanitized = sanitizeQwenPrompt(
    cleaned,
    settings.detail,
    input,
    settings.model,
    { enforceMinimum: false },
  );
  return formatPromptForModel(
    sanitized,
    settings.model,
    input,
    settings.mode,
  );
}

function getLlmConfig() {
  const baseUrl =
    process.env.LLM_API_BASE_URL?.replace(/\/$/, "") ??
    "http://localhost:11434/v1";
  const apiKey = process.env.LLM_API_KEY ?? "";
  const model = process.env.LLM_MODEL ?? "dolphin-llama3";

  return { baseUrl, apiKey, model };
}

async function formatWithLlm(
  input: string,
  settings: FormatSettings,
): Promise<string> {
  const { baseUrl, apiKey, model } = getLlmConfig();
  const modelDef = getComfyModelDefinition(settings.model);

  const fluxNegativeNote =
    settings.mode === "negative" && fluxIgnoresNegative(modelDef.profile)
      ? "FLUX ignores negatives—phrase positively what must stay unchanged."
      : "";

  const systemPrompt = `${buildModelSystemPrompt(settings.model, settings.mode)}

You are adapting an EXISTING prompt draft for ${modelDef.label} (${modelDef.comfyNode}).
- Preserve the user's subjects, actions, mood, and key details—do not invent unrelated content.
- Rewrite structure and phrasing to match the target model's format.
- Remove tag soup, labels, markdown, and meta commentary.
- ${fluxNegativeNote}
${buildModelClarityAddendum(settings.detail, settings.model)}

Output ONLY the formatted prompt text. No quotes around the whole prompt, labels, or explanations.`;

  const userMessage = `Adapt this draft for ${modelDef.label}. Preserve all subjects and details. Output only the rewritten prompt.

---
${input}
---`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: getDetailLimits(settings.detail, settings.model).maxTokens,
      stream: false,
      top_p: 0.9,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `LLM request failed (${response.status}): ${detail.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("LLM returned an empty response.");
  }

  return stripPromptArtifacts(content);
}

function formatWithRules(input: string, settings: FormatSettings): string {
  let draft = cleanDraft(input);

  if (looksLikeTagSoup(draft)) {
    draft = tagSoupToProse(draft);
  }

  return finalizeFormattedPrompt(draft, input, settings);
}

function buildFormatResult(
  prompt: string,
  input: string,
  settings: FormatSettings,
  provider: FormatResult["provider"],
): FormatResult {
  const limits = getDetailLimits(settings.detail, settings.model);
  const modelDef = getComfyModelDefinition(settings.model);

  return {
    prompt,
    mode: settings.mode,
    model: settings.model,
    comfyNode: modelDef.comfyNode,
    provider,
    limits: {
      minChars: limits.minChars,
      maxChars: limits.maxChars,
      maxSentences: limits.maxSentences,
      maxTokens: limits.maxTokens,
    },
    inputChars: input.length,
    outputChars: prompt.length,
  };
}

export async function formatPrompt(
  input: string,
  settings: FormatSettings = DEFAULT_FORMAT_SETTINGS,
): Promise<FormatResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Input cannot be empty.");
  }

  const normalized = normalizeFormatSettings(settings);
  const llmEnabled = process.env.LLM_ENABLED !== "false";
  const useLlm = normalized.smartFormat && llmEnabled;

  if (useLlm) {
    try {
      const llmOutput = await formatWithLlm(trimmed, normalized);
      const prompt = finalizeFormattedPrompt(llmOutput, trimmed, normalized);
      return buildFormatResult(prompt, trimmed, normalized, "llm");
    } catch (error) {
      const fallbackAllowed = process.env.ALLOW_TEMPLATE_FALLBACK !== "false";
      if (!fallbackAllowed) {
        throw error instanceof Error ? error : new Error("Formatting failed.");
      }
      console.warn(
        "[prompt-formatter] LLM failed, using rules fallback:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  const prompt = formatWithRules(trimmed, normalized);
  return buildFormatResult(prompt, trimmed, normalized, "rules");
}
