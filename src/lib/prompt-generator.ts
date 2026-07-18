import {
  getSamplingBoost,
  pickFewShotExamples,
} from "./variation-seed";
import {
  buildClaritySystemAddendum,
  buildDetailUserDirective,
  compactVariationHint,
  formatPromptForModel,
  getModelFewShots,
  QWEN_FEW_SHOT_BY_DETAIL,
  sanitizeQwenPrompt,
} from "./qwen-clarity";
import {
  DISTINCT_PEOPLE_FEW_SHOT_BY_DETAIL,
  DISTINCT_PEOPLE_FEW_SHOT_INPUT,
  getDetailLimits,
  GROUPED_COUPLE_FEW_SHOT_BY_DETAIL,
  GROUPED_COUPLE_FEW_SHOT_INPUT,
} from "./detail-level";
import {
  buildModelSystemPrompt,
  getQwenModelDefinition,
} from "./qwen-model";
import {
  buildDistinctPeopleSystemAddendum,
  buildGroupedPeopleSystemAddendum,
  countImpliedPeople,
  paintDistinctPeopleScene,
  paintGroupedPeopleScene,
  parsePeopleConstraint,
} from "./distinct-people";
import {
  DEFAULT_GENERATION_SETTINGS,
  type GenerationSettings,
} from "./generation-settings";
import {
  type VariationSettings,
} from "./variation-settings";

export type PromptMode = "positive" | "negative";
export type { GenerationSettings, VariationSettings } from "./generation-settings";
export type { DetailLevel } from "./detail-level";
export type { QwenImageModel } from "./qwen-model";

export type GenerateResult = {
  prompt: string;
  mode: PromptMode;
  provider: "llm" | "template";
  model: GenerationSettings["model"];
  comfyNode: string;
  limits: {
    minChars?: number;
    maxChars: number;
    maxSentences: number;
    maxTokens: number;
  };
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function isMultiPersonInput(input: string): boolean {
  return (
    countImpliedPeople(input) !== null || /\b(couple|pair|duo)\b/i.test(input)
  );
}

function buildFewShotMessages(
  mode: PromptMode,
  settings: GenerationSettings,
  input: string,
): ChatMessage[] {
  if (mode === "negative") {
    return [];
  }

  const multiPerson = isMultiPersonInput(input);
  const baseExamples = QWEN_FEW_SHOT_BY_DETAIL[settings.detail];
  const detailExamples = getModelFewShots(
    settings.model,
    settings.detail,
    baseExamples,
  );

  const pinnedExample = multiPerson
    ? settings.distinctPeople
      ? DISTINCT_PEOPLE_FEW_SHOT_BY_DETAIL[settings.detail]
      : GROUPED_COUPLE_FEW_SHOT_BY_DETAIL[settings.detail]
    : undefined;

  const pool = detailExamples.filter(
    (example) =>
      example.input !== DISTINCT_PEOPLE_FEW_SHOT_INPUT &&
      example.input !== GROUPED_COUPLE_FEW_SHOT_INPUT,
  );

  const selected = pickFewShotExamples(
    pool,
    settings.variation.strength,
    settings.variation.enabled,
  );

  const messages = pinnedExample ? [pinnedExample, ...selected] : selected;

  return messages.flatMap((example) => [
    { role: "user" as const, content: example.input },
    { role: "assistant" as const, content: example.output },
  ]);
}

function shouldPreserveSubject(input: string): boolean {
  return /keep|preserve|same (face|person|subject|pose)/i.test(input);
}

function buildUserMessage(
  input: string,
  mode: PromptMode,
  settings: GenerationSettings,
): string {
  const trimmed = input.trim();
  if (mode === "negative" || shouldPreserveSubject(trimmed)) {
    return trimmed;
  }

  const extras: string[] = [
    buildDetailUserDirective(settings.detail, settings.model),
  ];
  const peopleConstraint = parsePeopleConstraint(trimmed);

  if (settings.variation.enabled) {
    const hint = compactVariationHint(
      settings.variation.strength,
      settings.detail,
      {
        distinctPeople: settings.distinctPeople,
        peopleCount: peopleConstraint.count,
        gender: peopleConstraint.gender,
      },
    );
    if (hint) {
      extras.push(hint);
    }
  }

  return `${trimmed}\n\n${extras.join("\n\n")}`;
}

function getLlmTemperature(variation: VariationSettings): number {
  const configured = Number(process.env.LLM_TEMPERATURE);
  const base =
    Number.isFinite(configured) && configured >= 0 && configured <= 2
      ? configured
      : 0.95;

  if (!variation.enabled) {
    return Math.max(0, base - 0.1);
  }

  const { temperatureBoost } = getSamplingBoost(variation.strength);
  return Math.min(2, base + temperatureBoost);
}

function getLlmSamplingParams(
  variation: VariationSettings,
): Record<string, number> {
  if (!variation.enabled) {
    return { top_p: 0.9 };
  }

  const { topP, frequencyPenalty, presencePenalty } = getSamplingBoost(
    variation.strength,
  );

  return {
    top_p: topP,
    frequency_penalty: frequencyPenalty,
    presence_penalty: presencePenalty,
  };
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

function finalizePrompt(
  raw: string,
  input: string,
  mode: PromptMode,
  settings: GenerationSettings,
): string {
  const cleaned = sanitizePrompt(raw);
  const sanitized = sanitizeQwenPrompt(
    cleaned,
    settings.detail,
    input,
    settings.model,
  );
  return formatPromptForModel(sanitized, settings.model, input, mode);
}

export async function generateWithLlm(
  input: string,
  mode: PromptMode,
  settings: GenerationSettings = DEFAULT_GENERATION_SETTINGS,
): Promise<string> {
  const { baseUrl, apiKey, model } = getLlmConfig();
  const { variation } = settings;
  let systemPrompt = buildModelSystemPrompt(settings.model, mode);

  if (mode === "positive") {
    systemPrompt = `${systemPrompt}\n\n${buildClaritySystemAddendum(settings.detail, settings.model)}`;

    if (isMultiPersonInput(input.trim())) {
      if (settings.distinctPeople) {
        systemPrompt = `${systemPrompt}\n\n${buildDistinctPeopleSystemAddendum(input.trim())}`;
      } else {
        systemPrompt = `${systemPrompt}\n\n${buildGroupedPeopleSystemAddendum(input.trim())}`;
      }
    }
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...buildFewShotMessages(mode, settings, input),
    { role: "user", content: buildUserMessage(input, mode, settings) },
  ];

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const requestBody: Record<string, unknown> = {
    model,
    messages,
    temperature: getLlmTemperature(settings.variation),
    max_tokens: getDetailLimits(settings.detail, settings.model).maxTokens,
    stream: false,
    ...getLlmSamplingParams(settings.variation),
  };

  if (settings.variation.enabled) {
    requestBody.seed = getLlmSeed();
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
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

  return finalizePrompt(content, input.trim(), mode, settings);
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

function paintSceneFromKeywords(
  input: string,
  settings: GenerationSettings = DEFAULT_GENERATION_SETTINGS,
): string {
  const keywords = parseKeywords(input);
  const primary = keywords[0] ?? input.trim();
  const supporting = keywords.slice(0, settings.detail === "rich" ? 3 : 2);
  const topic =
    supporting.length > 0
      ? `${primary}, ${supporting.join(", ")}`
      : primary;
  const normalized =
    topic.toLowerCase().startsWith("a ") || topic.toLowerCase().startsWith("an ")
      ? topic
      : topic.charAt(0).toLowerCase() + topic.slice(1);

  if (settings.model === "qwen-image-edit-2511") {
    if (settings.detail === "concise") {
      return `Replace the scene with ${normalized} under clear directional light.`;
    }
    if (settings.detail === "rich") {
      return `Replace the scene with ${capitalize(normalized)} under clear directional light, surfaces showing tangible texture. The main subject anchors the frame while atmosphere builds from foreground to background. One distant environmental beat completes the unified composition.`;
    }
    return `Replace the scene with ${capitalize(normalized)} under clear directional light, with visible texture. The main subject anchors the frame while one background detail adds depth.`;
  }

  if (settings.model === "flux-2-klein") {
    if (settings.detail === "concise") {
      return `${capitalize(normalized)} holds the frame under clear directional light. The subject reads sharply in the foreground with a simple background.`;
    }
    if (settings.detail === "rich") {
      return `${capitalize(normalized)} anchors the foreground, posture and materials rendered with tactile detail—worn surfaces, visible texture, and weight in the light. The setting unfolds in layered depth from near detail through midground forms to a hazy background, warm key light from camera-left mixing with cool ambient fill. Lighting follows a photographic logic: soft key, gentle fill, subtle rim separation on the subject. Materials read distinctly throughout—matte versus glossy, fine grain, natural imperfections. Shot at eye level with moderate depth of field, the main subject tack sharp while the environment recedes into atmospheric perspective.`;
    }
    return `${capitalize(normalized)} anchors the frame in the foreground with clear material detail. The setting builds behind in layered depth under soft directional light with warm key and cool fill. Moderate depth of field, eye-level composition.`;
  }

  if (settings.model === "qwen-image-2.0") {
    if (settings.detail === "concise") {
      return `${capitalize(normalized)} under clear directional light. The main subject holds the frame in one cohesive moment.`;
    }
    if (settings.detail === "rich") {
      return `${capitalize(normalized)} anchors the foreground with posture, clothing, and surface texture reading clearly in the light. The setting builds through midground detail into a soft atmospheric background, wet or worn materials catching specular highlights beside matte surfaces. Warm key light from camera-left mixes with cooler ambient fill across the frame, color temperature shifting from golden highlights to blue-gray shadows. Fine environmental beats—distant glow, weathered architecture, or natural depth—settle into the background while the air holds tangible atmosphere. The composition holds at eye level with moderate depth of field, the subject sharp while the scene recedes into unified perspective.`;
    }
    return `${capitalize(normalized)} under clear directional light, with visible texture and a cohesive palette. The main subject anchors the frame while one background detail adds depth to the same moment.`;
  }

  if (settings.detail === "concise") {
    return `${capitalize(normalized)} under clear directional light. The main subject holds the frame in one cohesive moment.`;
  }

  if (settings.detail === "rich") {
    return `${capitalize(normalized)} under clear directional light, surfaces showing tangible texture and material weight. The main subject anchors the frame in a single frozen moment, posture and clothing reading clearly in the light. Atmosphere builds depth from foreground to background while supporting details settle naturally into the midground. One distant environmental beat completes the same unified scene.`;
  }

  return `${capitalize(normalized)} under clear directional light, with visible texture and a cohesive palette. The main subject anchors the frame while one background detail adds depth to the same moment.`;
}

export function generateWithTemplate(
  input: string,
  mode: PromptMode,
  settings: GenerationSettings = DEFAULT_GENERATION_SETTINGS,
): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Input cannot be empty.");
  }

  if (mode === "negative") {
    if (settings.model === "flux-2-klein") {
      return `Stable composition with unchanged facial features, pose, and proportions. Clean unmarked surfaces. ${trimmed}.`;
    }
    if (settings.model === "qwen-image-2.0") {
      return `Avoid changing facial features, pose, proportions, and composition unless requested. ${trimmed}.`;
    }
    if (settings.model === "qwen-image-edit-2511") {
      return `Do not change pose, face, or lighting unless specified. Only edit what is requested. Avoid: ${trimmed}.`;
    }
    return `Do not alter unrelated elements. Keep facial features, pose, proportions, and background composition unchanged unless explicitly requested. Avoid changing: ${trimmed}.`;
  }

  const lower = trimmed.toLowerCase();
  const preserveRequested = shouldPreserveSubject(trimmed);

  if (/^(remove|delete|erase)\b/.test(lower)) {
    return finalizePrompt(
      `Keep the subject's identity, pose, and proportions unchanged. ${capitalize(trimmed)}. Fill the removed area naturally so it matches the surrounding scene in light, texture, and color.`,
      trimmed,
      mode,
      settings,
    );
  }

  if (/^(add|insert|put)\b/.test(lower)) {
    return finalizePrompt(
      `Keep the subject's identity, pose, and proportions unchanged. ${capitalize(trimmed)}. The added elements sit naturally in the frame with matching perspective, lighting, and atmosphere.`,
      trimmed,
      mode,
      settings,
    );
  }

  if (/figure\s*[12]|picture\s*[12]/i.test(trimmed)) {
    return finalizePrompt(
      `Keep identity, pose, and framing from Figure 1 unless specified. ${capitalize(trimmed)}.`,
      trimmed,
      mode,
      settings,
    );
  }

  if (preserveRequested) {
    const sceneWords = trimmed
      .replace(/\b(keep|preserve|same)\b[^,.;|]*/gi, "")
      .replace(/^[,;\s|]+|[,;\s|]+$/g, "")
      .trim();

    const painted = paintSceneFromKeywords(sceneWords || trimmed, {
      ...settings,
      variation: { enabled: false, strength: 0 },
      distinctPeople: false,
      detail: "balanced",
    });
    return finalizePrompt(
      `Keep the subject's facial features, body proportions, and pose exactly unchanged. ${painted.replace(/^The image shows /, "The surrounding scene becomes ")}`,
      trimmed,
      mode,
      settings,
    );
  }

  if (!settings.distinctPeople && isMultiPersonInput(trimmed)) {
    const groupedScene = paintGroupedPeopleScene(trimmed, settings);
    if (groupedScene) {
      return finalizePrompt(groupedScene, trimmed, mode, settings);
    }
  }

  if (settings.distinctPeople && isMultiPersonInput(trimmed)) {
    const distinctScene = paintDistinctPeopleScene(trimmed, settings);
    if (distinctScene) {
      return finalizePrompt(distinctScene, trimmed, mode, settings);
    }
  }

  return finalizePrompt(
    paintSceneFromKeywords(trimmed, settings),
    trimmed,
    mode,
    settings,
  );
}

function buildGenerateResult(
  prompt: string,
  mode: PromptMode,
  provider: GenerateResult["provider"],
  settings: GenerationSettings,
): GenerateResult {
  const limits = getDetailLimits(settings.detail, settings.model);
  const modelDef = getQwenModelDefinition(settings.model);

  return {
    prompt,
    mode,
    provider,
    model: settings.model,
    comfyNode: modelDef.comfyNode,
    limits: {
      minChars: limits.minChars,
      maxChars: limits.maxChars,
      maxSentences: limits.maxSentences,
      maxTokens: limits.maxTokens,
    },
  };
}

export async function generatePrompt(
  input: string,
  mode: PromptMode,
  settings: GenerationSettings = DEFAULT_GENERATION_SETTINGS,
): Promise<GenerateResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Input cannot be empty.");
  }

  const llmEnabled = process.env.LLM_ENABLED !== "false";

  if (llmEnabled) {
    try {
      const prompt = await generateWithLlm(trimmed, mode, settings);
      return buildGenerateResult(prompt, mode, "llm", settings);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown LLM error";
      const fallbackAllowed = process.env.ALLOW_TEMPLATE_FALLBACK !== "false";

      if (!fallbackAllowed) {
        throw new Error(message);
      }

      console.warn("[prompt-generator] LLM failed, using template fallback:", message);
    }
  }

  return buildGenerateResult(
    generateWithTemplate(trimmed, mode, settings),
    mode,
    "template",
    settings,
  );
}
