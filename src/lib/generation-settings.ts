import {
  DEFAULT_VARIATION_SETTINGS,
  normalizeVariationSettings,
  type VariationSettings,
} from "./variation-settings";
import {
  normalizeDetailLevel,
  type DetailLevel,
} from "./detail-level";
import {
  DEFAULT_QWEN_MODEL,
  normalizeQwenModel,
  type QwenImageModel,
} from "./qwen-model";

export type { VariationSettings, DetailLevel, QwenImageModel };

export type GenerationSettings = {
  variation: VariationSettings;
  distinctPeople: boolean;
  detail: DetailLevel;
  model: QwenImageModel;
};

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  variation: DEFAULT_VARIATION_SETTINGS,
  distinctPeople: true,
  detail: "balanced",
  model: DEFAULT_QWEN_MODEL,
};

export function normalizeGenerationSettings(
  value?: Partial<Omit<GenerationSettings, "variation" | "detail" | "model">> & {
    variation?: Partial<VariationSettings>;
    detail?: string | DetailLevel;
    model?: string | QwenImageModel;
  } | null,
): GenerationSettings {
  return {
    variation: normalizeVariationSettings(value?.variation),
    distinctPeople:
      typeof value?.distinctPeople === "boolean"
        ? value.distinctPeople
        : DEFAULT_GENERATION_SETTINGS.distinctPeople,
    detail: normalizeDetailLevel(value?.detail),
    model: normalizeQwenModel(value?.model),
  };
}
