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
  action:
    "dynamic action framing: mid-motion body with visible momentum, engaged muscles, and environment interaction—never a static standing pose",
};

const ACTION_INSTRUCTIONS = `- Name a specific verb/action (sprint, leap, dodge, climb, strike, vault, slide, reach, etc.) and show the body mid-movement.
- Describe weight shift, limb extension, muscle tension, and fabric/hair reacting to motion.
- Include one concrete environment beat tied to the action (splashing water, kicked dust, swinging door, wind-lifted coat).
- Prefer energetic camera language: low angle, slight motion blur on extremities, or freeze-frame peak action.`;

export async function generateCharacterPrompt(
  options: CharacterOptions,
): Promise<ToolGenerateResult> {
  const detail = options.detail === "concise" ? "balanced" : options.detail;
  const portraitStyle = options.portraitStyle ?? "portrait";
  const parsed = parseCharacterHints(options.hints);
  const seed = buildRandomCharacterSeed(options.hints, portraitStyle);
  const identitySeed = pickCharacterIdentitySeed(parsed);
  const mandatoryBlock = buildCharacterMandatoryBlock(parsed);

  const actionBlock =
    portraitStyle === "action" ? `\n${ACTION_INSTRUCTIONS}` : "";

  const toolInstructions = `You are a single-character prompt generator for ComfyUI.
- Describe EXACTLY ONE person—never a couple, group, crowd, or background extras with faces.
- ${PORTRAIT_FRAMING[portraitStyle]}${actionBlock}
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
    portraitStyle === "action"
      ? "The character must be actively doing something—not posing for a portrait."
      : null,
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
    return `${capitalize(subject)} is caught mid-action—body driving through the scene with clear momentum under sharp directional light. Weight shifts forward, limbs extend, and clothing or hair reacts to the movement; muscles read engaged, not at rest. ${hairNote} One concrete environment beat ties to the motion (dust, spray, wind, or debris). No other people appear anywhere in the frame.`;
  }

  return `${capitalize(subject)} in a close portrait under soft directional light. ${hairNote} Face, skin texture, and expression are rendered with specific detail; shoulders and clothing edge into frame. No other people appear anywhere in the frame.`;
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}
