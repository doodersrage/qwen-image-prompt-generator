import {
  pickCharacterSubject,
  type SubjectGender,
} from "./variation-seed";

const WOMAN_WORDS =
  /\b(woman|women|girl|girls|female|lady|ladies|mother|daughter|sister|wife|girlfriend|feminine)\b/i;
const MAN_WORDS =
  /\b(man|men|boy|boys|male|guy|guys|father|son|brother|husband|boyfriend|masculine)\b/i;
const MINIMAL_HAIR_WORDS =
  /\b(bald|balding|shaved head|shaved scalp|clean-shaven scalp|buzz cut|buzzed hair|buzzed|monk|tonsure|hairless head)\b/i;
const HAIR_WORDS =
  /\b(hair|bun|braids|locs|dreads|ponytail|bangs|curls|curly|straight hair|wavy hair|afro|undercut|pigtails|bob cut|fringe)\b/i;
const AGE_WORDS =
  /\b(\d{1,2}\s*(?:years?\s*old|yo|y\.o\.)|in her (?:teens|twenties|thirties|forties|fifties|sixties|seventies)|in his (?:teens|twenties|thirties|forties|fifties|sixties|seventies)|teenage|teen|elderly|middle-aged|young|old|aged|youthful|senior|child|kid|toddler|infant|twenties|thirties|forties|fifties|sixties)\b/i;

export type ParsedCharacterHints = {
  raw: string;
  gender: SubjectGender;
  explicitGender: boolean;
  wantsMinimalHair: boolean;
  mentionsHair: boolean;
  mentionsAge: boolean;
  hasIdentityConstraints: boolean;
};

export function parseCharacterHints(hints?: string): ParsedCharacterHints {
  const raw = hints?.trim() ?? "";
  if (!raw) {
    return {
      raw,
      gender: "any",
      explicitGender: false,
      wantsMinimalHair: false,
      mentionsHair: false,
      mentionsAge: false,
      hasIdentityConstraints: false,
    };
  }

  const woman = WOMAN_WORDS.test(raw);
  const man = MAN_WORDS.test(raw);
  let gender: SubjectGender = "any";
  if (woman && !man) {
    gender = "women";
  } else if (man && !woman) {
    gender = "men";
  }

  const wantsMinimalHair = MINIMAL_HAIR_WORDS.test(raw);
  const mentionsHair = HAIR_WORDS.test(raw) || wantsMinimalHair;
  const mentionsAge = AGE_WORDS.test(raw);
  const explicitGender = woman || man;
  const hasIdentityConstraints =
    explicitGender || mentionsAge || mentionsHair || raw.length >= 16;

  return {
    raw,
    gender,
    explicitGender,
    wantsMinimalHair,
    mentionsHair,
    mentionsAge,
    hasIdentityConstraints,
  };
}

export function buildCharacterMandatoryBlock(parsed: ParsedCharacterHints): string {
  if (!parsed.raw) {
    return "";
  }

  const lines = [
    `MANDATORY CHARACTER (must match exactly): ${parsed.raw}`,
    "Treat the mandatory character block as authoritative. Do not replace it with a different person.",
  ];

  if (parsed.explicitGender) {
    lines.push(
      "Keep the subject's sex/gender exactly as specified. Do not swap woman/man or change implied gender.",
    );
  }

  if (parsed.mentionsAge) {
    lines.push(
      "Keep the stated age or age read exactly. Do not default to a generic adult or change the life stage.",
    );
  }

  if (!parsed.wantsMinimalHair) {
    lines.push(
      "Describe specific visible hair (color, length, texture, style). Do not make the subject bald, shaved, or buzz-cut unless the mandatory block explicitly requests it.",
    );
  }

  return lines.join("\n");
}

export function pickCharacterIdentitySeed(
  parsed: ParsedCharacterHints,
): string | null {
  if (parsed.hasIdentityConstraints) {
    return null;
  }

  return pickCharacterSubject(parsed.gender, parsed.wantsMinimalHair);
}
