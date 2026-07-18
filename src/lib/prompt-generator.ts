import {
  QWEN_FEW_SHOT_EXAMPLES,
  QWEN_NEGATIVE_SYSTEM_PROMPT,
  QWEN_POSITIVE_SYSTEM_PROMPT,
} from "./qwen-system-prompt";
import {
  buildTemplateVariation,
  buildVariationSeed,
  buildVariationSystemAddendum,
  getSamplingBoost,
  pickFewShotExamples,
} from "./variation-seed";
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
export type { GenerationSettings, VariationSettings };

export type GenerateResult = {
  prompt: string;
  mode: PromptMode;
  provider: "llm" | "template";
};

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const DISTINCT_PEOPLE_FEW_SHOT_INPUT = "two women, rooftop bar, city lights";
const GROUPED_COUPLE_FEW_SHOT_INPUT = "tropical beach sunset, couple walking";

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

  let examples = QWEN_FEW_SHOT_EXAMPLES;
  const multiPerson = isMultiPersonInput(input);

  if (settings.distinctPeople) {
    examples = examples.filter(
      (example) => example.input !== GROUPED_COUPLE_FEW_SHOT_INPUT,
    );
  } else {
    examples = examples.filter(
      (example) => example.input !== DISTINCT_PEOPLE_FEW_SHOT_INPUT,
    );
  }

  const pinnedInput = settings.distinctPeople
    ? DISTINCT_PEOPLE_FEW_SHOT_INPUT
    : GROUPED_COUPLE_FEW_SHOT_INPUT;

  const pinnedExample = multiPerson
    ? examples.find((example) => example.input === pinnedInput) ??
      QWEN_FEW_SHOT_EXAMPLES.find((example) => example.input === pinnedInput)
    : undefined;

  const pool = pinnedExample
    ? examples.filter((example) => example.input !== pinnedInput)
    : examples;

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

  const extras: string[] = [];
  const peopleConstraint = parsePeopleConstraint(trimmed);

  if (settings.variation.enabled) {
    extras.push(
      `Creative variation (weave naturally, do not quote): ${buildVariationSeed(settings.variation.strength, {
        distinctPeople: settings.distinctPeople,
        impliedPeopleCount: peopleConstraint.count,
        gender: peopleConstraint.gender,
      })}`,
    );
  }

  if (extras.length === 0) {
    return trimmed;
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

export async function generateWithLlm(
  input: string,
  mode: PromptMode,
  settings: GenerationSettings = DEFAULT_GENERATION_SETTINGS,
): Promise<string> {
  const { baseUrl, apiKey, model } = getLlmConfig();
  const { variation } = settings;
  let systemPrompt =
    mode === "negative"
      ? QWEN_NEGATIVE_SYSTEM_PROMPT
      : QWEN_POSITIVE_SYSTEM_PROMPT;

  if (mode === "positive" && isMultiPersonInput(input.trim())) {
    if (settings.distinctPeople) {
      systemPrompt = `${systemPrompt}\n\n${buildDistinctPeopleSystemAddendum(input.trim())}`;
    } else {
      systemPrompt = `${systemPrompt}\n\n${buildGroupedPeopleSystemAddendum(input.trim())}`;
    }
  }

  if (mode === "positive" && variation.enabled) {
    const addendum = buildVariationSystemAddendum(variation.strength);
    if (addendum) {
      systemPrompt = `${systemPrompt}\n\n${addendum}`;
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
    max_tokens: 1024,
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

function paintSceneFromKeywords(
  input: string,
  settings: GenerationSettings = DEFAULT_GENERATION_SETTINGS,
): string {
  const keywords = parseKeywords(input);
  const primary = keywords[0] ?? input.trim();
  const supporting = keywords.slice(1);
  const peopleConstraint = parsePeopleConstraint(input);

  let scene = `The image shows ${primary.toLowerCase().startsWith("a ") || primary.toLowerCase().startsWith("an ") ? primary : primary.charAt(0).toLowerCase() + primary.slice(1)}`;

  if (supporting.length > 0) {
    scene += `, with ${supporting.join(", ")} visible throughout the composition`;
  }

  scene +=
    ". Light falls with clear direction across the frame, casting defined shadows that separate foreground from background. Surfaces carry tangible texture and material detail—fabric, stone, skin, water, or metal rendered with physical weight. Colors read rich and intentional, atmosphere building depth from the nearest objects to the far distance. Every element sits in a single frozen moment, arranged so the full picture reads as one unified scene.";

  if (settings.variation.enabled) {
    const templateVariation = buildTemplateVariation(
      settings.variation.strength,
      settings.distinctPeople,
      peopleConstraint.count,
      peopleConstraint.gender,
    );
    if (templateVariation) {
      scene += ` ${templateVariation}`;
    }
  }

  return scene;
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

    const painted = paintSceneFromKeywords(sceneWords || trimmed, {
      variation: { enabled: false, strength: 0 },
      distinctPeople: false,
    });
    return `Keep the subject's facial features, body proportions, and pose exactly unchanged. ${painted.replace(/^The image shows /, "The surrounding scene becomes ")}`;
  }

  if (!settings.distinctPeople && isMultiPersonInput(trimmed)) {
    const groupedScene = paintGroupedPeopleScene(trimmed, settings);
    if (groupedScene) {
      return groupedScene;
    }
  }

  if (settings.distinctPeople && isMultiPersonInput(trimmed)) {
    const distinctScene = paintDistinctPeopleScene(trimmed, settings);
    if (distinctScene) {
      return distinctScene;
    }
  }

  return paintSceneFromKeywords(trimmed, settings);
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
    prompt: generateWithTemplate(trimmed, mode, settings),
    mode,
    provider: "template",
  };
}
