import {
  buildMandatoryLocationBlock,
  parseSettingHint,
} from "../hint-location";
import { generatePrompt } from "../prompt-generator";
import { buildRandomSceneSeed } from "./scene-pools";
import { buildToolResult, runSpecializedPrompt } from "./runner";
import type { RandomSceneOptions, ToolGenerateResult } from "./types";

export async function generateRandomScene(
  options: RandomSceneOptions,
): Promise<ToolGenerateResult> {
  const genreHint = parseSettingHint(options.genre);
  const seed = buildRandomSceneSeed({
    genre: options.genre,
    includePeople: options.includePeople,
  });
  const locationBlock = buildMandatoryLocationBlock(genreHint.location);

  const wildness = Math.min(100, Math.max(0, options.wildness ?? 65));
  const toolInstructions = `You are a random scene prompt generator for ComfyUI.
- Invent ONE cohesive scene from the provided random ingredients.
- When a MANDATORY SETTING block is present, use that exact place. Do not substitute a different location.
- Follow the target model's prompt style exactly.
- ${options.includePeople === false ? "Do not include any people, figures, silhouettes, or crowds." : "If people appear, give them specific visual identity—not generic figures."}
- Surprise the viewer with at least one unexpected but coherent detail.
- Wildness level: ${wildness}/100 (higher = stranger combinations, still one unified image).`;

  const userMessage = [
    locationBlock,
    `Random scene ingredients:\n${seed}`,
    "Write a single model-ready prompt using every major ingredient above.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const metadata = {
    seed,
    includePeople: options.includePeople !== false,
    wildness,
    genre: options.genre?.trim() || null,
    location: genreHint.location,
  };

  const templateFallback = async () =>
    generatePrompt(seed, "positive", {
      model: options.model,
      detail: options.detail,
      distinctPeople: false,
      variation: {
        enabled: true,
        strength: wildness,
      },
    });

  try {
    return await runSpecializedPrompt({
      model: options.model,
      detail: options.detail,
      toolInstructions,
      userMessage,
      templateFallback: async () => (await templateFallback()).prompt,
      sanitizeInput: seed,
      temperature: 0.85 + wildness / 200,
      seed,
      metadata,
    });
  } catch {
    const result = await templateFallback();
    return buildToolResult(
      result.prompt,
      result.provider,
      result.model,
      options.detail,
      {
        seed,
        metadata,
      },
    );
  }
}
