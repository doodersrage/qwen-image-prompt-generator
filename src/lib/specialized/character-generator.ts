import {
  buildCharacterPresetBlock,
  buildCharacterPresetSanitizeContext,
  buildCharacterPresetUserDirective,
  buildPoseAnchorUserDirective,
  countCharacterPresetSelections,
  hasCharacterPresetOptions,
  hasPoseAnchor,
  isDuoHeadcount,
  mergeCharacterPresetsIntoPrompt,
  normalizeCharacterPresetOptions,
} from "../character-options";
import {
  buildCharacterMandatoryBlock,
  parseCharacterHints,
  pickCharacterIdentitySeed,
} from "../character-hints";
import {
  buildMandatoryLocationBlock,
  parseSettingHint,
} from "../hint-location";
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
  const presetOptions = normalizeCharacterPresetOptions(options.presetOptions);
  const duoMode = isDuoHeadcount(presetOptions);
  const parsed = parseCharacterHints(options.hints);
  const settingHint = parseSettingHint(options.hints);
  const { seed, location: sceneLocation } = buildRandomCharacterSeed(
    options.hints,
    portraitStyle,
    options.recentLocations,
  );
  const identitySeed = pickCharacterIdentitySeed(parsed);
  const mandatoryBlock = buildCharacterMandatoryBlock(parsed);
  const locationBlock = buildMandatoryLocationBlock(settingHint.location);
  const presetBlock = buildCharacterPresetBlock(presetOptions);
  const presetDirective = buildCharacterPresetUserDirective(presetOptions);
  const hasPresets = hasCharacterPresetOptions(presetOptions);
  const sanitizeContext = buildCharacterPresetSanitizeContext(
    options.hints,
    seed,
    presetOptions,
  );

  const actionBlock =
    portraitStyle === "action" && !hasPoseAnchor(presetOptions)
      ? `\n${ACTION_INSTRUCTIONS}`
      : "";

  const framingInstruction = hasPoseAnchor(presetOptions)
    ? "Frame enough of the body and anchored object that the pose anchor reads clearly—avoid tight face-only portrait cropping that hides limb placement."
    : PORTRAIT_FRAMING[portraitStyle];

  const soloRules = duoMode
    ? `- Describe EXACTLY TWO people interacting—balanced visual weight, readable gestures, and clear spatial relationship. No crowd, no extras with faces.
- Both subjects need distinct identity, clothing, and pose detail.`
    : `- Describe EXACTLY ONE person—never a couple, group, crowd, or background extras with faces.
- No second person, no silhouettes, no reflections with another face, no bystanders, no staff, no audience.
${buildSinglePersonSystemAddendum()}`;

  const toolInstructions = `You are a character prompt generator for ComfyUI.
${soloRules}
- ${framingInstruction}${actionBlock}
- Include concrete visual identity: age read, ethnicity, face shape, hair, eyes, skin details, clothing materials, accessories, pose, expression, and one environmental context beat.
- When a MANDATORY SETTING block is present, place the character in that exact location with visible environmental detail.
- When an environment seed is provided, use it for pose/mood/lighting—but never override a mandatory setting with a different place.
- When a CHARACTER PRESET block is present, follow its composition, lens, camera angle, lighting, physique, expression, gaze, realism, hair, pose anchor, wardrobe, and accessory phrases exactly—integrate them smoothly into prose.
- Positional anchors must tie limbs to the named object; avoid impossible contortions or floating limbs.
- Be highly specific and renderable—avoid generic phrases like "beautiful woman" without detail.
- When a MANDATORY CHARACTER block is present, follow it exactly for sex/gender, age, and hair. Never override it with a random identity seed.
- Do not default to bald or shaved hair unless the mandatory block explicitly requests it.`;

  const poseAnchorDirective = buildPoseAnchorUserDirective(presetOptions);

  const userParts = [
    presetBlock,
    presetDirective,
    poseAnchorDirective,
    mandatoryBlock,
    locationBlock || null,
    mandatoryBlock
      ? null
      : identitySeed
        ? `Optional identity inspiration (use only if compatible with mandatory direction): ${identitySeed}`
        : null,
    `Environment and mood: ${seed}`,
    hasPoseAnchor(presetOptions)
      ? "Pose anchor preset is active—prioritize it over default portrait/action framing."
      : `Framing: ${portraitStyle}`,
    portraitStyle === "action" && !hasPoseAnchor(presetOptions)
      ? "The character must be actively doing something—not posing for a portrait."
      : null,
    duoMode
      ? "DUO MODE (mandatory): exactly two interacting people in frame. No third person, crowd, or background faces."
      : buildSinglePersonUserDirective(),
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
      buildCharacterTemplate(parsed.raw, portraitStyle, identitySeed, presetOptions),
    sanitizeInput: sanitizeContext,
    enforceMinimum: !(hasPresets || hasPoseAnchor(presetOptions)),
    postProcessPrompt:
      hasPresets || hasPoseAnchor(presetOptions)
        ? (prompt) => mergeCharacterPresetsIntoPrompt(prompt, presetOptions)
        : undefined,
    temperature,
    soloSubject: !duoMode,
    metadata: {
      portraitStyle,
      hints: parsed.raw || null,
      location: settingHint.location,
      sceneLocation,
      seed,
      identitySeed,
      parsedHints: parsed,
      presetOptions,
      duoMode,
      presetCount: hasPresets
        ? countCharacterPresetSelections(presetOptions)
        : 0,
    },
  });
}

function buildCharacterTemplate(
  hints: string,
  portraitStyle: NonNullable<CharacterOptions["portraitStyle"]>,
  identitySeed: string | null,
  presetOptions: ReturnType<typeof normalizeCharacterPresetOptions>,
): string {
  const base = (() => {
    const subject = hints.trim() || identitySeed || "a distinctive original person";
    const parsed = parseCharacterHints(hints);
    const location = parseSettingHint(hints).location;
    const locationNote = location ? ` The scene is set in ${location}.` : "";
    const hairNote = parsed.wantsMinimalHair
      ? "Head and scalp read exactly as described."
      : "Hair is visible and specific—color, length, and texture read clearly—not bald or shaved unless requested.";
    const soloNote = isDuoHeadcount(presetOptions)
      ? "Both subjects read as distinct individuals with balanced visual weight."
      : "No other people appear anywhere in the frame.";

    if (hasPoseAnchor(presetOptions)) {
      return `${capitalize(subject)}${locationNote} ${hairNote}. ${soloNote}`;
    }

    if (portraitStyle === "full-body") {
      return `${capitalize(subject)} stands in clear directional light, full body visible from head to worn shoes.${locationNote} ${hairNote} Clothing shows material texture and fit; posture and expression read distinctly in the same moment. ${soloNote}`;
    }

    if (portraitStyle === "action") {
      return `${capitalize(subject)} is caught mid-action—body driving through the scene with clear momentum under sharp directional light.${locationNote} Weight shifts forward, limbs extend, and clothing or hair reacts to the movement; muscles read engaged, not at rest. ${hairNote} One concrete environment beat ties to the motion (dust, spray, wind, or debris). ${soloNote}`;
    }

    return `${capitalize(subject)} in a close portrait under soft directional light.${locationNote} ${hairNote} Face, skin texture, and expression are rendered with specific detail; shoulders and clothing edge into frame. ${soloNote}`;
  })();

  return mergeCharacterPresetsIntoPrompt(base, presetOptions);
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}
