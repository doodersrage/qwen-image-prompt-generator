import { applyLockedVariationSeed } from "./locked-variation-seed";
import { applyLockedLocation } from "./locked-location";
import { enrichGenerateResult } from "./generation-diagnostics";
import { normalizeGenerationSettings } from "./generation-settings";
import { generatePrompt } from "./prompt-generator";
import { generateCharacterPrompt } from "./specialized/character-generator";
import type { ComfyImageModel } from "./comfy-models";
import type { DetailLevel } from "./detail-level";

export type BatchFromTopicsOptions = {
  topics: string[];
  target: "generate" | "duo";
  model: ComfyImageModel;
  detail: DetailLevel;
  lockedWardrobeId?: string;
  lockedLocation?: string;
  variationSeed?: string;
  recentClothing?: string[];
  alwaysIncludeClothing?: boolean;
  distinctPeople?: boolean;
  teamKit?: boolean;
};

export type BatchFromTopicsItem = {
  topic: string;
  prompt: string;
  provider: "llm" | "template";
};

export type BatchFromTopicsResult = {
  results: BatchFromTopicsItem[];
  count: number;
};

export async function batchGenerateFromTopics(
  options: BatchFromTopicsOptions,
): Promise<BatchFromTopicsResult> {
  const topics = options.topics
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 12);

  const results: BatchFromTopicsItem[] = [];

  for (const topic of topics) {
    const hints = applyLockedLocation(topic, options.lockedLocation) ?? topic;

    if (options.target === "duo") {
      const result = await generateCharacterPrompt({
        model: options.model,
        detail: options.detail,
        hints,
        portraitStyle: "action",
        variationStrength: 50,
        presetOptions: { headcount: "duo" },
        alwaysIncludeClothing: options.alwaysIncludeClothing !== false,
        teamKit: options.teamKit === true,
        lockedWardrobeId: options.lockedWardrobeId,
        lockedLocation: options.lockedLocation,
        variationSeed: options.variationSeed,
      });
      const enriched = enrichGenerateResult(result, hints, {
        teamKit: options.teamKit,
      });
      results.push({
        topic,
        prompt: enriched.prompt,
        provider: enriched.provider,
      });
      continue;
    }

    const settings = normalizeGenerationSettings({
      model: options.model,
      detail: options.detail,
      distinctPeople: options.distinctPeople,
      alwaysIncludeClothing: options.alwaysIncludeClothing,
    });

    const result = await generatePrompt(hints, "positive", settings, {
      recentClothing: options.recentClothing,
      lockedWardrobeId: options.lockedWardrobeId,
    });

    results.push({
      topic,
      prompt: result.prompt,
      provider: result.provider,
    });
  }

  return { results, count: results.length };
}
