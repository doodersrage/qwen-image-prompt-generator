import {
  buildClothingCoherenceUserDirective,
  buildClothingPickFilters,
  type ClothingPickFilters,
} from "./clothing-tags";
import {
  hintsMentionClothing,
  mergeAssignedWardrobeIntoPrompt,
  mergeWardrobeRespectingLimits,
  pickRandomCharacterOutfit,
  trimWardrobeSummaryToMaxChars,
  wardrobeBudgetForPrompt,
  type RandomCharacterOutfit,
} from "./clothing-catalog";
import { trimPromptToMaxChars } from "./qwen-clarity";
import {
  isMultiPersonInput,
  parsePeopleConstraint,
} from "./distinct-people";
import type { GenerationSettings } from "./generation-settings";
import { parseSettingHint } from "./hint-location";
import type { SubjectGender } from "./variation-seed";

export type GenerateWardrobeAssignment = {
  label?: string;
  summary: string;
  filters: ClothingPickFilters;
};

const PERSON_HINT =
  /\b(?:\d+\s+(?:people|persons|figures|characters|models|women|men|girls|boys))\b|\b(?:a\s+)?(?:young|old|elderly|middle-aged|teen(?:age)?)?\s*(?:man|woman|person|girl|boy|guy|lady|gentleman|model|character|vendor|monk|dancer|fisherman|boxer|chef|waiter|nurse|doctor|soldier|knight|wizard|hero|villain|protagonist|musician|courier|diver|painter|botanist|mechanic|sailor|archivist|chef|dancer)\b|\b(?:portrait\s+of|selfie\s+of|headshot\s+of|bust\s+of)\b/i;

export function inputImpliesPeople(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) {
    return false;
  }

  return isMultiPersonInput(trimmed) || PERSON_HINT.test(trimmed);
}

export function shouldPickGenerateWardrobe(
  input: string,
  alwaysIncludeClothing?: boolean,
  assumePeople = false,
): boolean {
  if (!assumePeople && !inputImpliesPeople(input)) {
    return false;
  }

  if (alwaysIncludeClothing === false) {
    return !hintsMentionClothing(input);
  }

  return true;
}

function assignmentGenderForSlot(
  slotIndex: number,
  constraintGender: SubjectGender,
): SubjectGender | undefined {
  if (constraintGender === "women" || constraintGender === "men") {
    return constraintGender;
  }

  if (constraintGender === "mixed") {
    return slotIndex === 0 ? "women" : "men";
  }

  return undefined;
}

function assignmentCount(input: string, settings: GenerationSettings): number {
  if (!isMultiPersonInput(input)) {
    return 1;
  }

  if (!settings.distinctPeople) {
    return 1;
  }

  const count = parsePeopleConstraint(input).count ?? 2;
  return Math.min(Math.max(count, 2), 4);
}

function assignmentLabel(
  index: number,
  count: number,
  distinctPeople: boolean,
): string | undefined {
  if (count <= 1 || !distinctPeople) {
    return undefined;
  }

  if (index === 0) {
    return "person on the left";
  }

  if (index === 1) {
    return "person on the right";
  }

  return `person ${index + 1}`;
}

function collectOutfitIds(outfit: RandomCharacterOutfit): string[] {
  return [outfit.wardrobeId, outfit.footwearId, outfit.accessoriesId].filter(
    (id): id is string => Boolean(id),
  );
}

export function buildGenerateWardrobeAssignments(
  input: string,
  settings: GenerationSettings,
  options?: { assumePeople?: boolean },
): GenerateWardrobeAssignment[] | null {
  if (
    !shouldPickGenerateWardrobe(
      input,
      settings.alwaysIncludeClothing,
      options?.assumePeople,
    )
  ) {
    return null;
  }

  const trimmed = input.trim();
  const location = parseSettingHint(trimmed).location;
  const constraint = parsePeopleConstraint(trimmed);
  const count = assignmentCount(trimmed, settings);
  const excludeIds: string[] = [];
  const assignments: GenerateWardrobeAssignment[] = [];

  for (let index = 0; index < count; index += 1) {
    const filters = buildClothingPickFilters({
      gender: assignmentGenderForSlot(index, constraint.gender),
      sceneLocation: location,
      environmentSeed: trimmed,
      hints: trimmed,
      excludeIds,
    });
    const outfit = pickRandomCharacterOutfit(filters);
    if (!outfit.summary.trim()) {
      continue;
    }

    excludeIds.push(...collectOutfitIds(outfit));
    assignments.push({
      label: assignmentLabel(index, count, settings.distinctPeople),
      summary: outfit.summary,
      filters: outfit.filters,
    });
  }

  return assignments.length > 0 ? assignments : null;
}

export function buildGenerateWardrobeUserDirective(
  assignments: GenerateWardrobeAssignment[],
): string | null {
  if (assignments.length === 0) {
    return null;
  }

  if (assignments.length === 1 && !assignments[0]?.label) {
    const assignment = assignments[0]!;
    return buildClothingCoherenceUserDirective(
      assignment.filters,
      assignment.summary,
    );
  }

  const lines = assignments.map((assignment) => {
    const who = assignment.label ?? "the subject";
    return `${who}: ${assignment.summary}`;
  });

  return [
    "WARDROBE COHERENCE (mandatory):",
    "Each person gets their own scene-appropriate outfit.",
    ...lines.map((line) => `- ${line}`),
    "Keep every assigned garment type in the final prompt for each person.",
    "Use short garment labels only—not long material paragraphs.",
    "Do not swap to unrelated outfits or merge separate wardrobes into one blob.",
  ].join(" ");
}

export function mergeGenerateWardrobeIntoPrompt(
  prompt: string,
  assignments: GenerateWardrobeAssignment[],
  maxChars?: number,
): string {
  if (assignments.length === 0) {
    return prompt.trim();
  }

  const peopleCount = assignments.length;
  const wardrobeBudget = maxChars
    ? wardrobeBudgetForPrompt(maxChars, peopleCount)
    : undefined;
  const perPersonBudget =
    wardrobeBudget && peopleCount > 1
      ? Math.max(40, Math.floor(wardrobeBudget / peopleCount))
      : wardrobeBudget;

  if (assignments.length === 1 && !assignments[0]?.label) {
    const summary = assignments[0]!.summary;
    return maxChars
      ? mergeWardrobeRespectingLimits(prompt, summary, maxChars, 1)
      : mergeAssignedWardrobeIntoPrompt(prompt, summary);
  }

  const clause = assignments
    .map((assignment) => {
      const who = assignment.label ?? "the subject";
      const summary = perPersonBudget
        ? trimWardrobeSummaryToMaxChars(
            assignment.summary.replace(/\.$/, ""),
            perPersonBudget,
          )
        : assignment.summary.replace(/\.$/, "");
      return `${who} wearing ${summary}`;
    })
    .join("; ");

  const normPrompt = prompt.toLowerCase();
  const firstChunk = assignments[0]?.summary
    .split(",")[0]
    ?.trim()
    .slice(0, 20)
    .toLowerCase();

  if (firstChunk && normPrompt.includes(firstChunk)) {
    return maxChars ? trimPromptToMaxChars(prompt.trim(), maxChars) : prompt.trim();
  }

  let merged = prompt.trim() ? `${clause}. ${prompt.trim()}` : `${clause}.`;

  if (maxChars && merged.length > maxChars) {
    merged = trimPromptToMaxChars(merged, maxChars);
  }

  return merged;
}
