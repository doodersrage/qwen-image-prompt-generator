import {
  buildClaritySystemAddendum,
  buildDetailUserDirective,
  getDetailLimits,
  type DetailLevel,
} from "./detail-level";

export type { DetailLevel };
export {
  buildClaritySystemAddendum,
  buildDetailUserDirective,
  detailLevelLabel,
  DISTINCT_PEOPLE_FEW_SHOT_BY_DETAIL,
  GROUPED_COUPLE_FEW_SHOT_BY_DETAIL,
  QWEN_FEW_SHOT_BY_DETAIL,
  type FewShotExample,
} from "./detail-level";

export function compactVariationHint(
  strength: number,
  detail: DetailLevel,
  options: {
    distinctPeople?: boolean;
    peopleCount?: number | null;
    gender?: string;
  } = {},
): string {
  if (strength <= 0 || detail === "concise") {
    return "";
  }

  const hints: string[] = [];

  if (strength >= 45) {
    hints.push("cohesive palette");
  }
  if (strength >= 70 && detail === "rich") {
    hints.push("layered depth");
  }

  if (
    options.distinctPeople &&
    typeof options.peopleCount === "number" &&
    options.peopleCount >= 2
  ) {
    hints.push(options.gender === "women" ? "two separate women" : "two separate people");
  }

  if (hints.length === 0) {
    return "";
  }

  return `Optional flavor only: ${hints.slice(0, detail === "rich" ? 2 : 1).join(", ")}.`;
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function padPromptToMinimum(
  text: string,
  detail: DetailLevel,
  input: string,
): string {
  const { minSentences } = getDetailLimits(detail);
  const sentences = splitSentences(text);

  if (sentences.length >= minSentences) {
    return text;
  }

  const topic = input.split(/[,;|]+/)[0]?.trim() || "the scene";
  const pads: string[] = [];

  if (detail === "balanced" && sentences.length < 3) {
    pads.push(`A single background detail in ${topic.toLowerCase()} adds depth under the same light.`);
  }

  if (detail === "rich") {
    while (sentences.length + pads.length < minSentences) {
      if (pads.length === 0) {
        pads.push(
          "Surface textures and material weight read clearly in the directional light.",
        );
      } else if (pads.length === 1) {
        pads.push(
          "Atmosphere builds softly from foreground to background within the same frozen moment.",
        );
      } else {
        pads.push(
          "One environmental detail in the distance completes the unified composition.",
        );
      }
    }
  }

  return [...sentences, ...pads].join(" ");
}

export function sanitizeQwenPrompt(
  raw: string,
  detail: DetailLevel = "balanced",
  input = "",
): string {
  const { maxSentences, maxChars } = getDetailLimits(detail);

  let text = raw
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^prompt:\s*/i, "")
    .replace(/^output:\s*/i, "")
    .replace(/\b(DISTINCT INDIVIDUALS MODE|GROUPED \/ COUPLE MODE|MANDATORY|DETAIL LEVEL).*?\./gi, "")
    .replace(/\bWrite EXACTLY.*?\./gi, "")
    .replace(/\bOptional flavor only.*?\./gi, "")
    .replace(/\bPerson [AB] must read as:.*?\./gi, "")
    .trim();

  let sentences = splitSentences(text);

  if (sentences.length > maxSentences) {
    sentences = sentences.slice(0, maxSentences);
  }

  text = sentences.join(" ");

  if (input) {
    text = padPromptToMinimum(text, detail, input);
    sentences = splitSentences(text);
    if (sentences.length > maxSentences) {
      text = sentences.slice(0, maxSentences).join(" ");
    }
  }

  if (text.length > maxChars) {
    const trimmed = text.slice(0, maxChars);
    const lastBreak = Math.max(
      trimmed.lastIndexOf(". "),
      trimmed.lastIndexOf("! "),
      trimmed.lastIndexOf("? "),
    );
    text =
      lastBreak > maxChars * 0.45
        ? trimmed.slice(0, lastBreak + 1)
        : `${trimmed.trimEnd()}…`;
  }

  return text.trim();
}
