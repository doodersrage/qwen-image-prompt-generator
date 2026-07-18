import { buildRandomBackgroundSeed } from "./scene-pools";
import { runSpecializedPrompt } from "./runner";
import type { BackgroundOptions, ToolGenerateResult } from "./types";

export async function generateBackgroundPrompt(
  options: BackgroundOptions,
): Promise<ToolGenerateResult> {
  const seed = buildRandomBackgroundSeed({
    settingType: options.settingType,
    timeOfDay: options.timeOfDay,
    mood: options.mood,
  });

  const toolInstructions = `You are an environment/background prompt generator for ComfyUI.
- Describe ONLY the setting—architecture, landscape, objects, weather, materials, lighting, atmosphere, and depth.
- ABSOLUTELY NO people, human figures, faces, silhouettes, crowds, mannequins, statues of people, or body parts.
- No "a person", "someone", "figure in the distance", or similar.
- Write one unified environment that could be used as a backdrop plate or empty scene.`;

  const userMessage = `Background ingredients:
${seed}

Write one highly detailed background-only prompt.`;

  return runSpecializedPrompt({
    model: options.model,
    detail: options.detail === "concise" ? "balanced" : options.detail,
    toolInstructions,
    userMessage,
    templateFallback: () => buildBackgroundTemplate(seed),
    sanitizeInput: seed,
    metadata: {
      seed,
      settingType: options.settingType?.trim() || null,
      timeOfDay: options.timeOfDay?.trim() || null,
      mood: options.mood?.trim() || null,
    },
  });
}

function buildBackgroundTemplate(seed: string): string {
  const normalized = seed.replace(
    /,\s*empty of people, figures, silhouettes, and crowds\.?$/i,
    "",
  );

  return `${capitalize(normalized)}. The space is completely empty of people and figures, with layered depth from foreground texture through midground forms to a soft atmospheric background. Materials, weather, and directional light read clearly across the entire environment.`;
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}
