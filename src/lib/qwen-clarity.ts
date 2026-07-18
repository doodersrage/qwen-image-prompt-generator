import type { DetailLevel } from "./detail-level";
import { getDetailLimits } from "./detail-level";
import {
  extractShortTopic,
  stripMetaInstructions,
  stripPromptArtifacts,
} from "./prompt-cleanup";
import {
  buildModelClarityAddendum,
  buildModelUserDirective,
  DEFAULT_QWEN_MODEL,
  expansionBeatsForProfile,
  getComfyModelDefinition,
  shouldEnforceMinPadding,
  type ComfyImageModel,
} from "./comfy-models";

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
} from "./detail-level";
export {
  COMFY_IMAGE_MODELS,
  DEFAULT_QWEN_MODEL,
  formatPromptForModel,
  getComfyModelDefinition,
  getModelFewShots,
  getPromptLimits,
  getQwenModelDefinition,
  normalizeQwenModel,
  QWEN_MODELS,
  qwenModelLabel,
} from "./comfy-models";
export type { ComfyImageModel, QwenImageModel } from "./comfy-models";

export function buildClaritySystemAddendum(
  detail: DetailLevel,
  model: ComfyImageModel = DEFAULT_QWEN_MODEL,
): string {
  return buildModelClarityAddendum(detail, model);
}

export function buildDetailUserDirective(
  detail: DetailLevel,
  model: ComfyImageModel = DEFAULT_QWEN_MODEL,
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
  const hints: string[] = [];

  if (
    options.distinctPeople &&
    (typeof options.peopleCount === "number"
      ? options.peopleCount >= 2
      : true)
  ) {
    hints.push(
      options.gender === "women"
        ? "two separate women"
        : options.gender === "men"
          ? "two separate men"
          : "two separate people",
    );
  }

  if (strength <= 0 || detail === "concise") {
    return hints.length > 0
      ? `Optional flavor only: ${hints.join(", ")}.`
      : "";
  }

  if (strength >= 45) {
    hints.push("cohesive palette");
  }
  if (strength >= 70 && detail === "rich") {
    hints.push("layered depth");
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

function expandPromptToMinChars(
  text: string,
  detail: DetailLevel,
  model: ComfyImageModel,
): string {
  const { minChars, maxChars, maxSentences } = getDetailLimits(detail, model);
  if (!minChars || text.length >= minChars) {
    return text;
  }

  const beats = expansionBeatsForProfile(getComfyModelDefinition(model).profile);
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
  model: ComfyImageModel,
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

  if (shouldEnforceMinPadding(getComfyModelDefinition(model).profile, detail)) {
    while (sentences.length + pads.length < minSentences) {
      const beats = expansionBeatsForProfile(getComfyModelDefinition(model).profile);
      const index = pads.length % beats.length;
      pads.push(beats[index]!);
    }
  }

  const combined = [...sentences, ...pads].join(" ");
  return expandPromptToMinChars(combined, detail, model);
}

function trimSentencesForDistinctPeople(
  sentences: string[],
  maxSentences: number,
): string[] {
  if (sentences.length <= maxSentences) {
    return sentences;
  }

  const leftIdx = sentences.findIndex((sentence) =>
    /\bon the left\b/i.test(sentence),
  );
  const rightIdx = sentences.findIndex((sentence) =>
    /\bon the right\b/i.test(sentence),
  );

  if (leftIdx >= 0 && rightIdx >= 0) {
    const priority =
      leftIdx === rightIdx
        ? [leftIdx]
        : [leftIdx, rightIdx].sort((a, b) => a - b);

    if (maxSentences >= 3 && !priority.includes(0)) {
      priority.unshift(0);
    }

    const keepSet = new Set(priority);
    const result = [...priority];

    for (
      let index = 0;
      index < sentences.length && result.length < maxSentences;
      index += 1
    ) {
      if (!keepSet.has(index)) {
        result.push(index);
        keepSet.add(index);
      }
    }

    return result
      .sort((a, b) => a - b)
      .slice(0, maxSentences)
      .map((index) => sentences[index]!);
  }

  return sentences.slice(0, maxSentences);
}

export type SanitizeOptions = {
  enforceMinimum?: boolean;
  distinctPeople?: boolean;
};

export function sanitizeQwenPrompt(
  raw: string,
  detail: DetailLevel = "balanced",
  input = "",
  model: ComfyImageModel = DEFAULT_QWEN_MODEL,
  options: SanitizeOptions = {},
): string {
  const { maxSentences, maxChars } = getDetailLimits(detail, model);
  const enforceMinimum = options.enforceMinimum !== false;
  const distinctPeople = options.distinctPeople === true;
  const effectiveMaxSentences =
    distinctPeople && input.trim()
      ? Math.max(maxSentences, detail === "concise" ? 2 : 3)
      : maxSentences;

  let text = stripPromptArtifacts(raw);
  text = stripMetaInstructions(text);

  let sentences = splitSentences(text);

  if (sentences.length > effectiveMaxSentences) {
    sentences = distinctPeople
      ? trimSentencesForDistinctPeople(sentences, effectiveMaxSentences)
      : sentences.slice(0, effectiveMaxSentences);
  }

  text = sentences.join(" ");

  if (enforceMinimum && input) {
    text = padPromptToMinimum(text, detail, model, input);
    sentences = splitSentences(text);
    if (sentences.length > effectiveMaxSentences) {
      text = distinctPeople
        ? trimSentencesForDistinctPeople(sentences, effectiveMaxSentences).join(" ")
        : sentences.slice(0, effectiveMaxSentences).join(" ");
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
