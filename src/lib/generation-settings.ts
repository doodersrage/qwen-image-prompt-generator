import {
  DEFAULT_VARIATION_SETTINGS,
  normalizeVariationSettings,
  type VariationSettings,
} from "./variation-settings";

export type { VariationSettings };

export type GenerationSettings = {
  variation: VariationSettings;
  distinctPeople: boolean;
};

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  variation: DEFAULT_VARIATION_SETTINGS,
  distinctPeople: true,
};

export function normalizeGenerationSettings(
  value?: Partial<Omit<GenerationSettings, "variation">> & {
    variation?: Partial<VariationSettings>;
  } | null,
): GenerationSettings {
  return {
    variation: normalizeVariationSettings(value?.variation),
    distinctPeople:
      typeof value?.distinctPeople === "boolean"
        ? value.distinctPeople
        : DEFAULT_GENERATION_SETTINGS.distinctPeople,
  };
}
