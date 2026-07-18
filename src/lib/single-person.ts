const MULTI_PERSON_SENTENCE =
  /\b(?:two|three|four|five|both|another|other|second|third|several|multiple|many)\s+(?:people|persons|person|men|women|man|woman|boys|girls|figures|characters|individuals|bystanders|onlookers|patrons|customers|workers|students|friends|strangers|models|dancers|soldiers|couples)\b/i;

const MULTI_PERSON_PHRASES =
  /\b(?:couple|pair|duo|twins|twin sisters|twin brothers|crowd|crowds|group of|gathering|audience|passersby|passers-by|extras|background figures|people in the (?:background|distance|midground)|figures in the (?:background|distance)|surrounded by (?:people|men|women|bystanders)|accompanied by (?:a |another |two )?(?:man|woman|person|friend|people))\b/i;

const LEFT_RIGHT_PEOPLE = /\bon the left\b[\s\S]*?\bon the right\b/i;

const WITH_ANOTHER_PERSON =
  /\b(?:with|and|beside|next to|alongside|between|while|as)\s+(?:a|an|another|two|the other)\s+(?:man|woman|person|figure|boy|girl|couple|pair|mechanic|worker|chef|bystander|stranger|patron|customer|friend)\b/i;

export function buildSinglePersonSystemAddendum(): string {
  return `SOLO SUBJECT (mandatory):
- Exactly ONE person in the entire image. No second person, couple, pair, twins, crowd, group, bystanders, audience, staff, or background figures with faces.
- No "on the left... on the right" split between two people.
- No reflections, mirrors, photos, or silhouettes showing another face.
- Environment may be detailed, but it must read as unoccupied by other people.`;
}

export function buildSinglePersonUserDirective(): string {
  return "SOLO SUBJECT (mandatory): exactly one person in frame. No other people, faces, silhouettes, or crowd anywhere.";
}

function sentenceMentionsExtraPeople(sentence: string): boolean {
  return (
    MULTI_PERSON_SENTENCE.test(sentence) ||
    MULTI_PERSON_PHRASES.test(sentence) ||
    LEFT_RIGHT_PEOPLE.test(sentence) ||
    WITH_ANOTHER_PERSON.test(sentence)
  );
}

function stripInlineMultiPersonPhrases(sentence: string): string {
  return sentence
    .replace(
      /\b(?:while|as|with|and)\s+(?:a|an|another|two|other)\s+(?:man|woman|person|figure|people|bystanders|customers|patrons|workers|onlookers)\b[^.!?]*/gi,
      "",
    )
    .replace(/\b(?:people|figures|bystanders|onlookers|patrons|customers)\s+in the (?:background|distance|midground)\b[^.!?]*/gi, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSingleSubjectFromSplitFrame(sentence: string): string | null {
  if (!LEFT_RIGHT_PEOPLE.test(sentence)) {
    return null;
  }

  const leftMatch = sentence.match(/\bon the left,?\s*([^;]+)/i);
  if (!leftMatch?.[1]) {
    return null;
  }

  const prefix =
    sentence.split(/\bon the left\b/i)[0]?.trim().replace(/[,.;\s]+$/, "") ?? "";
  const subject = leftMatch[1].trim();
  const trailing = sentence.match(/(?:,\s*)((?:under|in|with|during)\s+[^.!?]+)[.!?]?$/i)?.[1]?.trim();

  const parts = [prefix, subject, trailing].filter(Boolean);
  const collapsed = parts.join(", ").replace(/\s+/g, " ").trim();
  return collapsed.length >= 20 ? collapsed : null;
}

export function ensureSinglePersonPrompt(prompt: string): string {
  const sentences = prompt
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const kept = sentences
    .filter((sentence) => !sentenceMentionsExtraPeople(sentence))
    .map((sentence) => stripInlineMultiPersonPhrases(sentence))
    .filter((sentence) => sentence.length >= 20 && !sentenceMentionsExtraPeople(sentence));

  let cleaned = kept.join(" ").trim();

  if (!cleaned && sentences.length > 0) {
    for (const sentence of sentences) {
      const collapsed = extractSingleSubjectFromSplitFrame(sentence);
      if (collapsed) {
        cleaned = collapsed;
        break;
      }

      const stripped = stripInlineMultiPersonPhrases(sentence);
      const firstClause = stripped.split(/\b(?:while|as|with|and)\b/i)[0]?.trim() ?? "";
      if (firstClause.length >= 20 && !sentenceMentionsExtraPeople(firstClause)) {
        cleaned = firstClause;
        break;
      }
    }
  }

  if (!cleaned) {
    return prompt.trim();
  }

  if (
    !/\b(?:no other people|solo subject|single person|only one person|alone in the frame|unoccupied by other)\b/i.test(
      cleaned,
    )
  ) {
    cleaned = `${cleaned.replace(/[.!?]\s*$/, "")}. No other people, faces, silhouettes, or crowd appear anywhere in the frame.`;
  }

  return cleaned.replace(/\s+/g, " ").trim();
}

export const SOLO_SUBJECT_EXPANSION_BEATS = [
  "The surrounding space stays empty of other figures, with layered depth and no distant people or silhouettes.",
  "Directional light sculpts one face, posture, and clothing texture while the background remains unoccupied.",
  "Surface textures read clearly on the sole subject, with no second face, reflection, or background figure anywhere.",
  "The environment recedes through soft atmospheric depth without introducing additional people or crowd energy.",
];
