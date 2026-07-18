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
  shouldEnforceMinPadding,
  type ComfyImageModel,
} from "./comfy-models";
import {
  expandTagsToMinChars,
  expansionBeatsForSanitize,
  profileSkipsProsePadding,
  profileUsesTagFormat,
  resolveProfile,
  splitSentences,
  splitTags,
  trimSentencesByPriority,
  trimSentencesForDistinctPeople,
  trimTagsToMaxChars,
} from "./prompt-shape";

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

function expandPromptToMinChars(
  text: string,
  detail: DetailLevel,
  model: ComfyImageModel,
  soloSubject = false,
): string {
  const profile = resolveProfile(model);
  const { minChars, maxChars, maxSentences } = getDetailLimits(detail, model);

  if (profileUsesTagFormat(profile)) {
    return expandTagsToMinChars(text, detail, model, soloSubject);
  }

  if (profileSkipsProsePadding(profile)) {
    return text.length > maxChars ? text.slice(0, maxChars).trim() : text;
  }

  if (!minChars || text.length >= minChars) {
    return text;
  }

  const beats = expansionBeatsForSanitize(profile, soloSubject);
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
  soloSubject = false,
): string {
  const profile = resolveProfile(model);

  if (profileUsesTagFormat(profile)) {
    return expandTagsToMinChars(text, detail, model, soloSubject);
  }

  if (profileSkipsProsePadding(profile)) {
    return expandPromptToMinChars(text, detail, model, soloSubject);
  }

  const { minSentences } = getDetailLimits(detail, model);
  const sentences = splitSentences(text);

  if (sentences.length >= minSentences) {
    return expandPromptToMinChars(text, detail, model, soloSubject);
  }

  const topic = extractShortTopic(input);
  const pads: string[] = [];

  if (detail === "balanced" && sentences.length < minSentences) {
    pads.push(
      soloSubject
        ? "The empty background adds depth under the same light, with no other people visible anywhere."
        : `A single background detail in ${topic.toLowerCase()} adds depth under the same light.`,
    );
  }

  if (shouldEnforceMinPadding(profile, detail)) {
    const beats = expansionBeatsForSanitize(profile, soloSubject);
    while (sentences.length + pads.length < minSentences) {
      const index = pads.length % beats.length;
      pads.push(beats[index]!);
    }
  }

  const combined = [...sentences, ...pads].join(" ");
  return expandPromptToMinChars(combined, detail, model, soloSubject);
}

function trimTextToMaxChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  const trimmed = text.slice(0, maxChars);
  const lastBreak = Math.max(
    trimmed.lastIndexOf(". "),
    trimmed.lastIndexOf("! "),
    trimmed.lastIndexOf("? "),
    trimmed.lastIndexOf(", "),
  );

  return lastBreak > maxChars * 0.45
    ? trimmed.slice(0, lastBreak + 1)
    : `${trimmed.trimEnd()}…`;
}

/** Trim prose or tag prompts to a model char limit at word or clause boundaries. */
export function trimPromptToMaxChars(text: string, maxChars: number): string {
  return trimTextToMaxChars(text.trim(), maxChars);
}

function sanitizeTagPrompt(
  text: string,
  detail: DetailLevel,
  model: ComfyImageModel,
  input: string,
  enforceMinimum: boolean,
  soloSubject: boolean,
): string {
  const { maxChars } = getDetailLimits(detail, model);
  let tags = splitTags(text);

  if (tags.length === 0 && text.trim()) {
    tags = [text.trim()];
  }

  let result = trimTagsToMaxChars(tags, maxChars);

  if (enforceMinimum) {
    result = padPromptToMinimum(result, detail, model, input, soloSubject);
  }

  return trimTagsToMaxChars(splitTags(result), maxChars);
}

export type SanitizeOptions = {
  enforceMinimum?: boolean;
  distinctPeople?: boolean;
  soloSubject?: boolean;
};

export function sanitizeQwenPrompt(
  raw: string,
  detail: DetailLevel = "balanced",
  input = "",
  model: ComfyImageModel = DEFAULT_QWEN_MODEL,
  options: SanitizeOptions = {},
): string {
  const profile = resolveProfile(model);
  const { maxSentences, maxChars } = getDetailLimits(detail, model);
  const enforceMinimum = options.enforceMinimum !== false;
  const distinctPeople = options.distinctPeople === true;
  const soloSubject = options.soloSubject === true;
  const effectiveMaxSentences =
    distinctPeople && input.trim()
      ? Math.max(maxSentences, detail === "concise" ? 2 : 3)
      : maxSentences;

  let text = stripPromptArtifacts(raw);
  text = stripMetaInstructions(text);

  if (profileUsesTagFormat(profile)) {
    return sanitizeTagPrompt(
      text,
      detail,
      model,
      input,
      enforceMinimum,
      soloSubject,
    );
  }

  let sentences = splitSentences(text);

  if (sentences.length > effectiveMaxSentences) {
    sentences = distinctPeople
      ? trimSentencesForDistinctPeople(sentences, effectiveMaxSentences)
      : trimSentencesByPriority(sentences, effectiveMaxSentences);
  }

  text = sentences.join(" ");

  if (enforceMinimum && input) {
    text = padPromptToMinimum(text, detail, model, input, soloSubject);
    sentences = splitSentences(text);
    if (sentences.length > effectiveMaxSentences) {
      text = distinctPeople
        ? trimSentencesForDistinctPeople(sentences, effectiveMaxSentences).join(
            " ",
          )
        : trimSentencesByPriority(sentences, effectiveMaxSentences).join(" ");
      text = expandPromptToMinChars(text, detail, model, soloSubject);
    }
  } else if (enforceMinimum) {
    text = expandPromptToMinChars(text, detail, model, soloSubject);
  }

  return trimTextToMaxChars(text.trim(), maxChars);
}
