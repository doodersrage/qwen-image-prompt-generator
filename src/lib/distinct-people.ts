import {
  buildTemplateVariation,
  pickDistinctSubjects,
  type SubjectGender,
} from "./variation-seed";
import type { GenerationSettings } from "./generation-settings";

export type PeopleConstraint = {
  count: number | null;
  gender: SubjectGender;
};

function parseCount(raw: string): number {
  const wordToNumber: Record<string, number> = {
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
  };
  return wordToNumber[raw] ?? Number.parseInt(raw, 10);
}

function nounToGender(noun: string): SubjectGender {
  if (/^(men|man|guys|guy|boys|boy)$/.test(noun)) {
    return "men";
  }
  if (/^(women|woman|girls|girl)$/.test(noun)) {
    return "women";
  }
  return "any";
}

export function parsePeopleConstraint(input: string): PeopleConstraint {
  const lower = input.toLowerCase();

  const numericMatch = lower.match(
    /\b(\d+|two|three|four|five|six|seven|eight)\s+(men|man|women|woman|people|persons|person|guys|guy|girls|girl|boys|boy|figures|characters|models|friends|strangers|lovers)\b/,
  );

  if (numericMatch) {
    const count = parseCount(numericMatch[1]!);
    const gender = nounToGender(numericMatch[2]!);
    if (Number.isFinite(count) && count >= 2) {
      return { count, gender };
    }
  }

  if (/\b(two|2)\s+(women|woman|girls|girl)\b/.test(lower)) {
    return { count: 2, gender: "women" };
  }

  if (/\b(two|2)\s+(men|man|guys|guy|boys|boy)\b/.test(lower)) {
    return { count: 2, gender: "men" };
  }

  if (/\b(couple|pair|duo|twosome|both of them)\b/.test(lower)) {
    if (/\b(two men|2 men|gay men|men only)\b/i.test(input)) {
      return { count: 2, gender: "men" };
    }
    if (/\b(two women|2 women|lesbian|women only)\b/i.test(input)) {
      return { count: 2, gender: "women" };
    }
    return { count: 2, gender: "mixed" };
  }

  if (/\b(group|crowd|party of|gathering)\b/.test(lower)) {
    return { count: null, gender: "any" };
  }

  return { count: null, gender: "any" };
}

export function countImpliedPeople(input: string): number | null {
  return parsePeopleConstraint(input).count;
}

export function impliesMultiplePeople(input: string): boolean {
  return countImpliedPeople(input) !== null;
}

function extractSceneSetting(input: string): string {
  const stripped = input
    .replace(
      /\b(\d+|two|three|four|five|six|seven|eight)\s+(men|man|women|woman|people|persons|person|guys|guy|girls|girl|boys|boy|figures|characters|models|friends|strangers|lovers)\b/gi,
      "",
    )
    .replace(/\b(couple|pair|duo|twosome)\b/gi, "")
    .replace(/^[,;\s|]+|[,;\s|]+$/g, "")
    .trim();

  return stripped || input.trim();
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function genderMandate(gender: SubjectGender): string {
  if (gender === "women") {
    return "Both people MUST be women. Do not introduce men or masculine figures.";
  }
  if (gender === "men") {
    return "Both people MUST be men. Do not introduce women or feminine figures.";
  }
  if (gender === "mixed") {
    return "The pair must be one man and one woman unless the topic states otherwise.";
  }
  return "";
}

function groupedLabel(constraint: PeopleConstraint): string {
  if (constraint.gender === "women") {
    return "Two women";
  }
  if (constraint.gender === "men") {
    return "Two men";
  }
  return "A couple";
}

export function buildDistinctPeopleSystemAddendum(input: string): string {
  const constraint = parsePeopleConstraint(input);
  const genderRule = genderMandate(constraint.gender);

  if (constraint.count === 2 || /\b(couple|pair|duo)\b/i.test(input)) {
    const gender =
      constraint.gender === "mixed" ? "mixed" : constraint.gender;
    const [personOne, personTwo] = pickDistinctSubjects(2, gender);

    return [
      "DISTINCT INDIVIDUALS MODE (mandatory): write two separate people, not one merged couple.",
      genderRule,
      `Person A must read as: ${personOne}.`,
      `Person B must read as: ${personTwo}—different age, ethnicity, build, hair, clothing, and expression.`,
      "Give each person at least one dedicated sentence with their own face, body, and pose.",
      'Use spatial anchors: "on the left", "on the right", "in the foreground", or "behind".',
      'Do NOT write "a couple", "they", "both figures", or one shared description.',
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (constraint.count !== null && constraint.count > 2) {
    const subjects = pickDistinctSubjects(
      Math.min(constraint.count, 4),
      constraint.gender === "any" ? "any" : constraint.gender,
    );

    return [
      `DISTINCT INDIVIDUALS MODE (mandatory): ${constraint.count} separate people.`,
      genderRule,
      ...subjects.map(
        (subject, index) => `Person ${index + 1} must read as: ${subject}.`,
      ),
      "Give each person their own sentence—never a faceless group blob.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return [
    "DISTINCT INDIVIDUALS MODE: when multiple people appear, describe each separately.",
    genderRule,
    "Never collapse multiple people into one vague subject or shared silhouette.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildGroupedPeopleSystemAddendum(input: string): string {
  const constraint = parsePeopleConstraint(input);
  const genderRule = genderMandate(constraint.gender);
  const label = groupedLabel(constraint);

  return [
    "GROUPED / COUPLE MODE (mandatory): describe the pair as one unified subject in flowing prose.",
    genderRule,
    `Write ${label.toLowerCase()} together as a single focal moment—not Person A/Person B and not left/right split catalog entries.`,
    'Use natural couple phrasing such as "a couple", "two women together", or "both men" in one cohesive description.',
    "Do NOT separate them into individually catalogued characters.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function paintDistinctPeopleScene(
  input: string,
  settings: GenerationSettings,
): string | null {
  const constraint = parsePeopleConstraint(input);
  const setting = extractSceneSetting(input);
  const settingPhrase =
    setting.toLowerCase().startsWith("a ") ||
    setting.toLowerCase().startsWith("an ")
      ? setting
      : setting.charAt(0).toLowerCase() + setting.slice(1);

  if (constraint.count === 2 || /\b(couple|pair|duo)\b/i.test(input)) {
    const gender =
      constraint.gender === "mixed" ? "mixed" : constraint.gender;
    const [personOne, personTwo] = pickDistinctSubjects(2, gender);
    let scene = `${capitalize(settingPhrase)}. On the left, ${personOne}, with clear facial detail, defined clothing, and a specific posture. On the right, ${personTwo}—entirely different in age, ethnicity, build, hair, and expression—holds a separate pose and visible identity. Light falls across both figures while keeping each person visually distinct.`;

    if (settings.variation.enabled) {
      const variation = buildTemplateVariation(
        settings.variation.strength,
        true,
        2,
        constraint.gender,
      );
      if (variation) {
        scene += ` ${variation}`;
      }
    }

    return scene;
  }

  if (constraint.count !== null && constraint.count > 2) {
    const subjects = pickDistinctSubjects(
      Math.min(constraint.count, 4),
      constraint.gender === "any" ? "any" : constraint.gender,
    );
    const placements = [
      "in the foreground",
      "to the left",
      "to the right",
      "in the midground",
    ];
    const people = subjects
      .map(
        (subject, index) =>
          `${capitalize(placements[index] ?? "nearby")}, ${subject}, with distinct face, clothing, and posture`,
      )
      .join(". ");

    return `${capitalize(settingPhrase)}. ${people}. Each person reads as a separate individual, not a merged group.`;
  }

  return null;
}

export function paintGroupedPeopleScene(
  input: string,
  settings: GenerationSettings,
): string | null {
  const constraint = parsePeopleConstraint(input);
  if (constraint.count !== 2 && !/\b(couple|pair|duo)\b/i.test(input)) {
    return null;
  }

  const setting = extractSceneSetting(input);
  const settingPhrase =
    setting.toLowerCase().startsWith("a ") ||
    setting.toLowerCase().startsWith("an ")
      ? setting
      : setting.charAt(0).toLowerCase() + setting.slice(1);
  const label = groupedLabel(constraint);

  let scene = `${capitalize(settingPhrase)}. ${label} share the frame as one unified subject—described together in flowing prose, close to one another, their combined interaction forming a single focal moment rather than two separately catalogued individuals. Warm light wraps both figures as one scene element.`;

  if (settings.variation.enabled) {
    const variation = buildTemplateVariation(
      settings.variation.strength,
      false,
      2,
      constraint.gender,
    );
    if (variation) {
      scene += ` ${variation}`;
    }
  }

  return scene;
}
