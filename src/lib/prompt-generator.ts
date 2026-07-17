import {
  QWEN_FEW_SHOT_EXAMPLES,
  QWEN_NEGATIVE_SYSTEM_PROMPT,
  QWEN_POSITIVE_SYSTEM_PROMPT,
} from "./qwen-system-prompt";
import {
  buildTemplateVariation,
  buildVariationSeed,
  pickFewShotExamples,
} from "./variation-seed";

export type PromptMode = "positive" | "negative";

export type GenerateResult = {
  prompt: string;
  mode: PromptMode;
  provider: "llm" | "template";
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function buildFewShotMessages(mode: PromptMode): ChatMessage[] {
  if (mode === "negative") {
    return [];
  }

  return pickFewShotExamples(QWEN_FEW_SHOT_EXAMPLES, 2).flatMap((example) => [
    { role: "user" as const, content: example.input },
    { role: "assistant" as const, content: example.output },
  ]);
}

function shouldPreserveSubject(input: string): boolean {
  return /keep|preserve|same (face|person|subject|pose)/i.test(input);
}

function buildUserMessage(input: string, mode: PromptMode): string {
  const trimmed = input.trim();
  if (mode === "negative" || shouldPreserveSubject(trimmed)) {
    return trimmed;
  }

  return `${trimmed}\n\nCreative variation (weave naturally, do not quote): ${buildVariationSeed()}`;
}

function getLlmTemperature(): number {
  const configured = Number(process.env.LLM_TEMPERATURE);
  if (Number.isFinite(configured) && configured >= 0 && configured <= 2) {
    return configured;
  }
  return 0.95;
}

function getLlmSeed(): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0]! % 2_147_483_647;
}

function getLlmConfig() {
  const baseUrl =
    process.env.LLM_API_BASE_URL?.replace(/\/$/, "") ??
    "http://localhost:11434/v1";
  const apiKey = process.env.LLM_API_KEY ?? "";
  const model = process.env.LLM_MODEL ?? "dolphin-llama3";

  return { baseUrl, apiKey, model };
}

export async function generateWithLlm(
  input: string,
  mode: PromptMode,
): Promise<string> {
  const { baseUrl, apiKey, model } = getLlmConfig();
  const systemPrompt =
    mode === "negative"
      ? QWEN_NEGATIVE_SYSTEM_PROMPT
      : QWEN_POSITIVE_SYSTEM_PROMPT;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...buildFewShotMessages(mode),
    { role: "user", content: buildUserMessage(input, mode) },
  ];

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
      messages,
      temperature: getLlmTemperature(),
      max_tokens: 1024,
      seed: getLlmSeed(),
      stream: false,
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

  return sanitizePrompt(content);
}

function sanitizePrompt(raw: string): string {
  return raw
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^prompt:\s*/i, "")
    .replace(/^output:\s*/i, "")
    .trim();
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function parseKeywords(input: string): string[] {
  return input
    .split(/[,;|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function paintSceneFromKeywords(input: string, withVariation = true): string {
  const keywords = parseKeywords(input);
  const primary = keywords[0] ?? input.trim();
  const supporting = keywords.slice(1);

  let scene = `The image shows ${primary.toLowerCase().startsWith("a ") || primary.toLowerCase().startsWith("an ") ? primary : primary.charAt(0).toLowerCase() + primary.slice(1)}`;

  if (supporting.length > 0) {
    scene += `, with ${supporting.join(", ")} visible throughout the composition`;
  }

  scene +=
    ". Light falls with clear direction across the frame, casting defined shadows that separate foreground from background. Surfaces carry tangible texture and material detail—fabric, stone, skin, water, or metal rendered with physical weight. Colors read rich and intentional, atmosphere building depth from the nearest objects to the far distance. Every element sits in a single frozen moment, arranged so the full picture reads as one unified scene.";

  if (withVariation) {
    scene += ` ${buildTemplateVariation()}`;
  }

  return scene;
}

export function generateWithTemplate(
  input: string,
  mode: PromptMode,
): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Input cannot be empty.");
  }

  if (mode === "negative") {
    return `Do not alter unrelated elements. Keep facial features, pose, proportions, and background composition unchanged unless explicitly requested. Avoid changing: ${trimmed}.`;
  }

  const lower = trimmed.toLowerCase();
  const preserveRequested = shouldPreserveSubject(trimmed);

  if (/^(remove|delete|erase)\b/.test(lower)) {
    return `Keep the subject's identity, pose, and proportions unchanged. ${capitalize(trimmed)}. Fill the removed area naturally so it matches the surrounding scene in light, texture, and color.`;
  }

  if (/^(add|insert|put)\b/.test(lower)) {
    return `Keep the subject's identity, pose, and proportions unchanged. ${capitalize(trimmed)}. The added elements sit naturally in the frame with matching perspective, lighting, and atmosphere.`;
  }

  if (/figure\s*[12]|picture\s*[12]/i.test(trimmed)) {
    return `Keep identity, pose, and framing from Figure 1 unless specified. ${capitalize(trimmed)}.`;
  }

  if (preserveRequested) {
    const sceneWords = trimmed
      .replace(/\b(keep|preserve|same)\b[^,.;|]*/gi, "")
      .replace(/^[,;\s|]+|[,;\s|]+$/g, "")
      .trim();

    const painted = paintSceneFromKeywords(sceneWords || trimmed, false);
    return `Keep the subject's facial features, body proportions, and pose exactly unchanged. ${painted.replace(/^The image shows /, "The surrounding scene becomes ")}`;
  }

  return paintSceneFromKeywords(trimmed);
}

export async function generatePrompt(
  input: string,
  mode: PromptMode,
): Promise<GenerateResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Input cannot be empty.");
  }

  const llmEnabled = process.env.LLM_ENABLED !== "false";

  if (llmEnabled) {
    try {
      const prompt = await generateWithLlm(trimmed, mode);
      return { prompt, mode, provider: "llm" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown LLM error";
      const fallbackAllowed = process.env.ALLOW_TEMPLATE_FALLBACK !== "false";

      if (!fallbackAllowed) {
        throw new Error(message);
      }

      console.warn("[prompt-generator] LLM failed, using template fallback:", message);
    }
  }

  return {
    prompt: generateWithTemplate(trimmed, mode),
    mode,
    provider: "template",
  };
}
