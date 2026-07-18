import {
  DEFAULT_VARIATION_SETTINGS,
  normalizeVariationSettings,
  type VariationSettings,
} from "./variation-settings";
import {
  normalizeDetailLevel,
  type DetailLevel,
} from "./detail-level";

export type { VariationSettings, DetailLevel };

export type GenerationSettings = {
  variation: VariationSettings;
  distinctPeople: boolean;
  detail: DetailLevel;
};

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  variation: DEFAULT_VARIATION_SETTINGS,
  distinctPeople: true,
  detail: "balanced",
};

export function normalizeGenerationSettings(
  value?: Partial<Omit<GenerationSettings, "variation" | "detail">> & {
    variation?: Partial<VariationSettings>;
    detail?: string | DetailLevel;
  } | null,
): GenerationSettings {
  return {
    variation: normalizeVariationSettings(value?.variation),
    distinctPeople:
      typeof value?.distinctPeople === "boolean"
        ? value.distinctPeople
        : DEFAULT_GENERATION_SETTINGS.distinctPeople,
    detail: normalizeDetailLevel(value?.detail),
  };
}
