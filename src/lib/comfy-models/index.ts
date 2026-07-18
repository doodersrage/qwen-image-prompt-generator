import type { DetailLevel } from "../detail-level";
import {
  buildProfileClarityAddendum,
  buildProfileSystemPrompt,
  buildProfileUserDirective,
  fluxIgnoresNegative,
  getProfileFewShots,
} from "./prompt-profiles";
import { enforcePromptShapeForProfile } from "../prompt-shape";
import { compactPromptForProfile } from "../prompt-compact";
import {
  COMFY_IMAGE_MODELS,
  COMFY_MODEL_IDS,
  DEFAULT_COMFY_MODEL,
} from "./registry";
import type {
  ComfyImageModel,
  ComfyImageModelDefinition,
  PromptLimits,
} from "./types";

export {
  COMFY_IMAGE_MODELS,
  COMFY_MODEL_CATEGORIES,
  COMFY_MODEL_IDS,
  DEFAULT_COMFY_MODEL,
} from "./registry";
export {
  expansionBeatsForProfile,
  fluxIgnoresNegative,
  isEditInstructionProfile,
  shouldEnforceMinPadding,
} from "./prompt-profiles";
export type {
  ComfyImageModel,
  ComfyImageModelDefinition,
  ComfyModelCategory,
  PromptLimits,
  PromptProfileId,
} from "./types";

/** @deprecated Use DEFAULT_COMFY_MODEL */
export const DEFAULT_QWEN_MODEL = DEFAULT_COMFY_MODEL;

/** @deprecated Use COMFY_IMAGE_MODELS */
export const QWEN_MODELS = COMFY_IMAGE_MODELS;

export function normalizeComfyModel(value?: string | null): ComfyImageModel {
  if (value && COMFY_MODEL_IDS.has(value)) {
    return value;
  }
  return DEFAULT_COMFY_MODEL;
}

/** @deprecated Use normalizeComfyModel */
export const normalizeQwenModel = normalizeComfyModel;

export function getComfyModelDefinition(
  model: ComfyImageModel = DEFAULT_COMFY_MODEL,
): ComfyImageModelDefinition {
  return (
    COMFY_IMAGE_MODELS.find((entry) => entry.id === model) ??
    COMFY_IMAGE_MODELS.find((entry) => entry.id === DEFAULT_COMFY_MODEL)!
  );
}

/** @deprecated Use getComfyModelDefinition */
export const getQwenModelDefinition = getComfyModelDefinition;

export function getPromptLimits(
  detail: DetailLevel,
  model: ComfyImageModel = DEFAULT_COMFY_MODEL,
): PromptLimits {
  return getComfyModelDefinition(model).limitsByDetail[detail];
}

export function comfyModelLabel(model: ComfyImageModel): string {
  return getComfyModelDefinition(model).label;
}

/** @deprecated Use comfyModelLabel */
export const qwenModelLabel = comfyModelLabel;

export function buildModelSystemPrompt(
  model: ComfyImageModel,
  mode: "positive" | "negative",
): string {
  return buildProfileSystemPrompt(getComfyModelDefinition(model), mode);
}

export function buildModelClarityAddendum(
  detail: DetailLevel,
  model: ComfyImageModel,
): string {
  return buildProfileClarityAddendum(detail, getComfyModelDefinition(model));
}

export function buildModelUserDirective(
  detail: DetailLevel,
  model: ComfyImageModel,
): string {
  return buildProfileUserDirective(detail, getComfyModelDefinition(model));
}

export function getModelFewShots(
  model: ComfyImageModel,
  detail: DetailLevel,
  fallback: import("../detail-level").FewShotExample[],
): import("../detail-level").FewShotExample[] {
  return getProfileFewShots(getComfyModelDefinition(model), detail, fallback);
}


export function formatPromptForModel(
  prompt: string,
  model: ComfyImageModel,
  input: string,
  mode: "positive" | "negative",
): string {
  const def = getComfyModelDefinition(model);
  let shaped = enforcePromptShapeForProfile(
    prompt,
    def.profile,
    mode,
    input.trim(),
  );
  if (mode === "positive") {
    shaped = compactPromptForProfile(shaped, def.profile);
  }
  return shaped;
}

export function modelUsesFluxNegativeRewrite(model: ComfyImageModel): boolean {
  return fluxIgnoresNegative(getComfyModelDefinition(model).profile);
}

export type QwenImageModel = ComfyImageModel;
export type QwenModelDefinition = ComfyImageModelDefinition;
