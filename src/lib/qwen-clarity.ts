import type { DetailLevel } from "./detail-level";
import { getDetailLimits } from "./detail-level";
import {
  extractShortTopic,
  stripMetaInstructions,
  stripPromptArtifacts,
} from "./prompt-cleanup";
import type { QwenImageModel } from "./qwen-model";
import {
  buildModelClarityAddendum,
  buildModelUserDirective,
  DEFAULT_QWEN_MODEL,
} from "./qwen-model";

export type { DetailLevel };
export {
  extractShortTopic,
  stripMetaInstructions,
  stripPromptArtifacts,
} from "./prompt-cleanup";
export {
  detailLevelLabel,
  DISTINCT_PEOPLE_FEW_SHOT_BY_DETAIL,
  GROUPED_COUPLE_FEW_SHOT_BY_DETAIL,
  QWEN_FEW_SHOT_BY_DETAIL,
  type FewShotExample,
  type QwenImageModel,
} from "./detail-level";
export {
  DEFAULT_QWEN_MODEL,
  formatPromptForModel,
  getModelFewShots,
  getPromptLimits,
  getQwenModelDefinition,
  normalizeQwenModel,
  QWEN_MODELS,
  qwenModelLabel,
} from "./qwen-model";

export function buildClaritySystemAddendum(
  detail: DetailLevel,
  model: QwenImageModel = DEFAULT_QWEN_MODEL,
): string {
  return buildModelClarityAddendum(detail, model);
}

export function buildDetailUserDirective(
  detail: DetailLevel,
  model: QwenImageModel = DEFAULT_QWEN_MODEL,
): string {
  return buildModelUserDirective(detail, model);
}

export function compactVariationHint(
  strength: number,
  detail: DetailLevel,
  options: {
    distinctPeople?: boolean;
    peopleCount?: number | null;
    gender?: string;
  } = {},
): string {
  if (strength <= 0 || detail === "concise") {
    return "";
  }

  const hints: string[] = [];

  if (strength >= 45) {
    hints.push("cohesive palette");
  }
  if (strength >= 70 && detail === "rich") {
    hints.push("layered depth");
  }

  if (
    options.distinctPeople &&
    typeof options.peopleCount === "number" &&
    options.peopleCount >= 2
  ) {
    hints.push(options.gender === "women" ? "two separate women" : "two separate people");
  }

  if (hints.length === 0) {
    return "";
  }

  return `Optional flavor only: ${hints.slice(0, detail === "rich" ? 2 : 1).join(", ")}.`;
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

const RICH_EXPANSION_BEATS = [
  "Fine surface textures read clearly in the directional light—matte stone, worn fabric, brushed metal, or damp pavement catching subtle specular highlights.",
  "The lighting mixes a warm key from camera-left with cooler ambient fill, color temperature shifting from golden highlights to blue-gray shadows across the scene.",
  "In the midground, supporting elements settle into layered depth while background forms fade through atmospheric haze that keeps the frame unified.",
  "Material weight grounds the image: glossy wet surfaces beside matte aged wood, fine grain in metal, and soft organic texture in fabric or foliage.",
  "The composition holds at a natural eye level with moderate depth of field—the main subject sharp while the environment recedes into soft perspective.",
  "Small environmental details in the distance—distant glow, fading architecture, or weather-worn surfaces—complete the same continuous moment.",
];

const RICH_EXPANSION_BEATS_2512 = [
  "Foreground and background elements read in clear spatial layers under the same light.",
  "Surface color and texture stay consistent across the frame with readable depth.",
  "The main subject remains centered in the midground with supporting details placed left and right.",
  "Lighting stays even enough to preserve shape, material, and any visible text in the scene.",
];

function expansionBeatsForModel(model: QwenImageModel): string[] {
  if (model === "qwen-image-2512") {
    return RICH_EXPANSION_BEATS_2512;
  }
  return RICH_EXPANSION_BEATS;
}

function expandPromptToMinChars(
  text: string,
  detail: DetailLevel,
  model: QwenImageModel,
): string {
  const { minChars, maxChars, maxSentences } = getDetailLimits(detail, model);
  if (!minChars || text.length >= minChars) {
    return text;
  }

  const beats = expansionBeatsForModel(model);
  let expanded = text;
  let beatIndex = 0;

  while (expanded.length < minChars && beatIndex < beats.length) {
    const sentences = splitSentences(expanded);
    const beat = beats[beatIndex]!.replace(/\.$/, "");

    if (sentences.length >= maxSentences && sentences.length > 0) {
      const last = sentences[sentences.length - 1]!.replace(/\.$/, "");
      sentences[sentences.length - 1] = `${last}, ${beat}.`;
      expanded = sentences.join(" ");
    } else {
      expanded = `${expanded} ${beats[beatIndex]!}`;
    }

    beatIndex += 1;
  }

  if (expanded.length > maxChars) {
    const trimmed = expanded.slice(0, maxChars);
    const lastBreak = Math.max(
      trimmed.lastIndexOf(". "),
      trimmed.lastIndexOf("! "),
      trimmed.lastIndexOf("? "),
      trimmed.lastIndexOf(", "),
    );
    expanded =
      lastBreak > maxChars * 0.45
        ? trimmed.slice(0, lastBreak + 1)
        : `${trimmed.trimEnd()}…`;
  }

  return expanded.trim();
}

function padPromptToMinimum(
  text: string,
  detail: DetailLevel,
  model: QwenImageModel,
  input: string,
): string {
  const { minSentences } = getDetailLimits(detail, model);
  const sentences = splitSentences(text);

  if (sentences.length >= minSentences) {
    return expandPromptToMinChars(text, detail, model);
  }

  const topic = extractShortTopic(input);
  const pads: string[] = [];

  if (detail === "balanced" && sentences.length < minSentences) {
    pads.push(
      `A single background detail in ${topic.toLowerCase()} adds depth under the same light.`,
    );
  }

  if (detail === "rich" || model === "qwen-image-2512" || model === "qwen-image-2.0" || model === "flux-2-klein") {
    while (sentences.length + pads.length < minSentences) {
      const beats = expansionBeatsForModel(model);
      const index = pads.length % beats.length;
      pads.push(beats[index]!);
    }
  }

  const combined = [...sentences, ...pads].join(" ");
  return expandPromptToMinChars(combined, detail, model);
}

export type SanitizeOptions = {
  enforceMinimum?: boolean;
};

export function sanitizeQwenPrompt(
  raw: string,
  detail: DetailLevel = "balanced",
  input = "",
  model: QwenImageModel = DEFAULT_QWEN_MODEL,
  options: SanitizeOptions = {},
): string {
  const { maxSentences, maxChars } = getDetailLimits(detail, model);
  const enforceMinimum = options.enforceMinimum !== false;

  let text = stripPromptArtifacts(raw);
  text = stripMetaInstructions(text);

  let sentences = splitSentences(text);

  if (sentences.length > maxSentences) {
    sentences = sentences.slice(0, maxSentences);
  }

  text = sentences.join(" ");

  if (enforceMinimum && input) {
    text = padPromptToMinimum(text, detail, model, input);
    sentences = splitSentences(text);
    if (sentences.length > maxSentences) {
      text = sentences.slice(0, maxSentences).join(" ");
      text = expandPromptToMinChars(text, detail, model);
    }
  } else if (enforceMinimum) {
    text = expandPromptToMinChars(text, detail, model);
  }

  if (text.length > maxChars) {
    const trimmed = text.slice(0, maxChars);
    const lastBreak = Math.max(
      trimmed.lastIndexOf(". "),
      trimmed.lastIndexOf("! "),
      trimmed.lastIndexOf("? "),
    );
    text =
      lastBreak > maxChars * 0.45
        ? trimmed.slice(0, lastBreak + 1)
        : `${trimmed.trimEnd()}…`;
  }

  return text.trim();
}
