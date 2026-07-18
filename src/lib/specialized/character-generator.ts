import {
  buildCharacterMandatoryBlock,
  parseCharacterHints,
  pickCharacterIdentitySeed,
} from "../character-hints";
import {
  buildSinglePersonSystemAddendum,
  buildSinglePersonUserDirective,
} from "../single-person";
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
  const parsed = parseCharacterHints(options.hints);
  const seed = buildRandomCharacterSeed(options.hints);
  const identitySeed = pickCharacterIdentitySeed(parsed);
  const mandatoryBlock = buildCharacterMandatoryBlock(parsed);

  const toolInstructions = `You are a single-character prompt generator for ComfyUI.
- Describe EXACTLY ONE person—never a couple, group, crowd, or background extras with faces.
- ${PORTRAIT_FRAMING[portraitStyle]}
- Include concrete visual identity: age read, ethnicity, face shape, hair, eyes, skin details, clothing materials, accessories, pose, expression, and one environmental context beat.
- Be highly specific and renderable—avoid generic phrases like "beautiful woman" without detail.
- No second person, no silhouettes, no reflections with another face, no bystanders, no staff, no audience.
- When a MANDATORY CHARACTER block is present, follow it exactly for sex/gender, age, and hair. Never override it with a random identity seed.
- Do not default to bald or shaved hair unless the mandatory block explicitly requests it.

${buildSinglePersonSystemAddendum()}`;

  const userParts = [
    mandatoryBlock,
    mandatoryBlock
      ? null
      : identitySeed
        ? `Optional identity inspiration (use only if compatible with mandatory direction): ${identitySeed}`
        : null,
    `Environment and mood: ${seed}`,
    `Framing: ${portraitStyle}`,
    buildSinglePersonUserDirective(),
    "Write one model-ready character prompt.",
  ].filter(Boolean);

  const userMessage = userParts.join("\n\n");
  const variationStrength = options.variationStrength ?? 50;
  const temperature = parsed.hasIdentityConstraints
    ? 0.55 + variationStrength / 400
    : 0.75 + variationStrength / 200;

  return runSpecializedPrompt({
    model: options.model,
    detail,
    toolInstructions,
    userMessage,
    templateFallback: () =>
      buildCharacterTemplate(parsed.raw, portraitStyle, identitySeed),
    sanitizeInput: parsed.raw || seed,
    temperature,
    soloSubject: true,
    metadata: {
      portraitStyle,
      hints: parsed.raw || null,
      seed,
      identitySeed,
      parsedHints: parsed,
    },
  });
}

function buildCharacterTemplate(
  hints: string,
  portraitStyle: NonNullable<CharacterOptions["portraitStyle"]>,
  identitySeed: string | null,
): string {
  const subject = hints.trim() || identitySeed || "a distinctive original person";
  const parsed = parseCharacterHints(hints);
  const hairNote = parsed.wantsMinimalHair
    ? "Head and scalp read exactly as described."
    : "Hair is visible and specific—color, length, and texture read clearly—not bald or shaved unless requested.";

  if (portraitStyle === "full-body") {
    return `${capitalize(subject)} stands in clear directional light, full body visible from head to worn shoes. ${hairNote} Clothing shows material texture and fit; posture and expression read distinctly in the same moment. No other people appear anywhere in the frame.`;
  }

  if (portraitStyle === "action") {
    return `${capitalize(subject)} moves through a concrete environment, body caught mid-action under sharp directional light. ${hairNote} Fabric, muscle tension, and expression read clearly while the background stays secondary. No other people appear anywhere in the frame.`;
  }

  return `${capitalize(subject)} in a close portrait under soft directional light. ${hairNote} Face, skin texture, and expression are rendered with specific detail; shoulders and clothing edge into frame. No other people appear anywhere in the frame.`;
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}
