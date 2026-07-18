import { pickDistinctSubjects } from "../variation-seed";
import { buildRandomCharacterSeed } from "./scene-pools";
import { runSpecializedPrompt } from "./runner";
import type { CharacterOptions, ToolGenerateResult } from "./types";

const PORTRAIT_FRAMING: Record<
  NonNullable<CharacterOptions["portraitStyle"]>,
  string
> = {
  portrait: "tight portrait framing on face, hair, expression, and shoulders",
  "full-body": "full-body framing from head to shoes with readable posture",
  action: "dynamic action framing with visible motion and environment interaction",
};

export async function generateCharacterPrompt(
  options: CharacterOptions,
): Promise<ToolGenerateResult> {
  const detail = options.detail === "concise" ? "balanced" : options.detail;
  const portraitStyle = options.portraitStyle ?? "portrait";
  const seed = buildRandomCharacterSeed(options.hints);
  const [subjectSeed] = pickDistinctSubjects(1, "any");

  const toolInstructions = `You are a single-character prompt generator for ComfyUI.
- Describe EXACTLY ONE person—never a couple, group, crowd, or background extras with faces.
- ${PORTRAIT_FRAMING[portraitStyle]}
- Include concrete visual identity: age read, ethnicity, face shape, hair, eyes, skin details, clothing materials, accessories, pose, expression, and one environmental context beat.
- Be highly specific and renderable—avoid generic phrases like "beautiful woman" without detail.
- No second person, no silhouettes, no reflections with another face.`;

  const userMessage = [
    options.hints?.trim()
      ? `Character direction: ${options.hints.trim()}`
      : "Character direction: invent a distinctive original person.",
    `Style seed: ${subjectSeed}`,
    `Scene seed: ${seed}`,
    `Framing: ${portraitStyle}`,
    "Write one model-ready character prompt.",
  ].join("\n");

  return runSpecializedPrompt({
    model: options.model,
    detail,
    toolInstructions,
    userMessage,
    templateFallback: () => buildCharacterTemplate(subjectSeed, portraitStyle, options.hints),
    sanitizeInput: seed,
    temperature: 0.75 + (options.variationStrength ?? 50) / 200,
    metadata: {
      portraitStyle,
      hints: options.hints?.trim() || null,
      seed,
    },
  });
}

function buildCharacterTemplate(
  subject: string,
  portraitStyle: NonNullable<CharacterOptions["portraitStyle"]>,
  hints?: string,
): string {
  const hintPhrase = hints?.trim()
    ? `${hints.trim()}, `
    : "";

  if (portraitStyle === "full-body") {
    return `${capitalize(subject)} stands in ${hintPhrase}clear directional light, full body visible from head to worn shoes. Clothing shows material texture and fit; posture and expression read distinctly in the same moment.`;
  }

  if (portraitStyle === "action") {
    return `${capitalize(subject)} moves through ${hintPhrase}a concrete environment, body caught mid-action under sharp directional light. Fabric, muscle tension, and expression read clearly while the background stays secondary.`;
  }

  return `${capitalize(subject)} in ${hintPhrase}a close portrait under soft directional light. Face, hair, skin texture, and expression are rendered with specific detail; shoulders and clothing edge into frame without a second person anywhere.`;
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}
