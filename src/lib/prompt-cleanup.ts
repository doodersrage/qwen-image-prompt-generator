export function extractShortTopic(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "the scene";
  }

  const firstSegment = trimmed.split(/[,;|]+/)[0]?.trim() || trimmed;
  if (firstSegment.length <= 48) {
    return firstSegment.toLowerCase();
  }

  const words = firstSegment.split(/\s+/).slice(0, 5).join(" ");
  return words.toLowerCase();
}

export function stripPromptArtifacts(raw: string): string {
  let text = raw.trim();
  if (!text) {
    return text;
  }

  const jsonPrompt = text.match(
    /^\s*\{[\s\S]*?"prompt"\s*:\s*"((?:\\.|[^"\\])*)"/,
  );
  if (jsonPrompt?.[1]) {
    text = jsonPrompt[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, " ")
      .replace(/\\t/g, " ")
      .trim();
  }

  text = text.replace(/^```(?:[\w-]+)?\s*\n?([\s\S]*?)```$/m, "$1").trim();

  if (text.startsWith("{") && text.endsWith("}")) {
    try {
      const parsed = JSON.parse(text) as { prompt?: unknown; text?: unknown };
      const candidate =
        typeof parsed.prompt === "string"
          ? parsed.prompt
          : typeof parsed.text === "string"
            ? parsed.text
            : null;
      if (candidate) {
        text = candidate.trim();
      }
    } catch {
      // keep original text
    }
  }

  text = text
    .replace(/<\|im_start\|>[\s\S]*?(<\|im_end\|>|<\|redacted_im_end\|>)\s*/gi, "")
    .replace(/<\|im_start\|>[\s\S]*$/gi, "")
    .replace(/<\|(?:im_end|redacted_im_end|vision_start|vision_end|image_pad|redacted_start_header_id|redacted_end_header_id)\|>/gi, "")
    .replace(
      /^Describe the image by detailing the color, shape, size, texture, quantity, text, spatial relationships of the objects and background:\s*/i,
      "",
    )
    .replace(
      /^Describe the key features of the input image[^:]*:\s*/i,
      "",
    )
    .replace(/^(?:system|user|assistant)\s*/i, "")
    .replace(/^"{3}\s*|"{3}\s*$/g, "")
    .replace(/"{3}/g, "")
    .replace(/^'{3}\s*|'{3}\s*$/g, "")
    .trim();

  text = text
    .replace(
      /^(?:here(?:'s| is)|adapted prompt|formatted prompt|positive prompt|negative prompt|output|prompt|result)\s*:?\s*/i,
      "",
    )
    .replace(/^adapt this draft for[^:.\n]*:?\s*/i, "")
    .replace(/^draft to adapt:\s*-{2,}\s*/i, "")
    .replace(/\s*-{2,}\s*$/g, "")
    .trim();

  for (let i = 0; i < 3; i += 1) {
    const next = text.replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, "").trim();
    if (next === text) {
      break;
    }
    text = next;
  }

  text = text
    .replace(/\\n/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  text = stripThinkingArtifacts(text);

  return text;
}

function looksLikePromptProse(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 40) {
    return false;
  }

  if (/^(?:a\s+)?thinking process:/i.test(trimmed)) {
    return false;
  }

  if (/^\d+\.\s*\*\*/.test(trimmed)) {
    return false;
  }

  if (
    /\b(?:Analyze User Input|Character direction|Style seed|Scene seed|Need to merge|matching .* rules)\b/i.test(
      trimmed,
    )
  ) {
    return false;
  }

  if (/^\*\*[^*]+\*\*:?\s*[-*•]/.test(trimmed)) {
    return false;
  }

  return true;
}

function stripLeadingNumberedAnalysisSteps(text: string): string {
  let cleaned = text.trim();
  const stepPattern = /^\d+\.\s*\*\*[^*]+\*\*:?\s*/;

  while (stepPattern.test(cleaned)) {
    const nextStep = cleaned.search(/\n\s*\d+\.\s*\*\*/);
    if (nextStep > 0) {
      cleaned = cleaned.slice(nextStep).trim();
      continue;
    }

    if (
      /\b(?:Analyze User Input|Character direction|Style seed|Scene seed|Need to merge|matching .* rules)\b/i.test(
        cleaned,
      )
    ) {
      return "";
    }

    break;
  }

  return cleaned.trim();
}

function extractPromptProseAfterAnalysis(text: string): string {
  const parts = text.split(/(?<=[.!?])\s+/);
  for (let index = 0; index < parts.length; index += 1) {
    const candidate = parts.slice(index).join(" ").trim();
    if (looksLikePromptProse(candidate)) {
      return candidate;
    }
  }

  return "";
}

export function stripThinkingArtifacts(text: string): string {
  let cleaned = text.trim();
  if (!cleaned) {
    return cleaned;
  }

  cleaned = cleaned.replace(/^[\s\S]*?<\/think>\s*/i, "").trim();

  const finalMarkers = [
    /\*\*(?:Final(?:\s+Prompt)?|Output|Draft(?:\s+Prompt)?|Scene(?:\s+Description)?|Prompt)(?::\*\*|\*\*:?)\s*/gi,
    /(?:^|\n)(?:Final prompt|Output prompt|Scene description):\s*/gi,
  ];

  for (const marker of finalMarkers) {
    const matches = [...cleaned.matchAll(marker)];
    if (matches.length > 0) {
      const last = matches[matches.length - 1];
      const rest = cleaned.slice(last.index! + last[0].length).trim();
      if (rest.length >= 30) {
        cleaned = rest;
        break;
      }
    }
  }

  if (
    /^(?:a\s+)?thinking process:/i.test(cleaned) ||
    /^\d+\.\s*\*\*(?:Analyze|Plan|Merge|Draft)/i.test(cleaned)
  ) {
    const prose = extractPromptProseAfterAnalysis(cleaned);
    cleaned = prose || "";
  }

  cleaned = cleaned.replace(/^(?:a\s+)?thinking process:\s*/i, "");
  cleaned = stripLeadingNumberedAnalysisSteps(cleaned);
  cleaned = cleaned.replace(
    /^[-*•]\s*(?:Character direction|Style seed|Scene seed|Framing):[^.!?]*[.!?]?\s*/gi,
    "",
  );

  return cleaned.replace(/\s+/g, " ").trim();
}

export function isThinkingOnlyArtifact(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }

  if (/^(?:a\s+)?thinking process:/i.test(trimmed)) {
    return true;
  }

  if (/^\d+\.\s*\*\*(?:Analyze|Plan|Merge|Draft)/i.test(trimmed)) {
    return true;
  }

  if (/\*\*Analyze User Input:\*\*/i.test(trimmed)) {
    return true;
  }

  if (
    /\b(?:Character direction|Style seed|Scene seed):\s*"/i.test(trimmed) &&
    !looksLikePromptProse(trimmed)
  ) {
    return true;
  }

  return false;
}

const EXPANSION_PADDING_FRAGMENTS = [
  "Foreground and background elements read in clear spatial layers under the same light.",
  "Surface color and texture stay consistent across the frame with readable depth.",
  "The main subject remains centered in the midground with supporting details placed left and right.",
  "Lighting stays even enough to preserve shape, material, and any visible text in the scene.",
  "Fine surface textures read clearly in the directional light",
  "The lighting mixes a warm key from camera-left with cooler ambient fill",
  "In the midground, supporting elements settle into layered depth",
  "Material weight grounds the image",
  "The composition holds at a natural eye level with moderate depth of field",
  "Small environmental details in the distance",
];

export function stripExpansionPadding(text: string): string {
  let cleaned = text;
  for (const fragment of EXPANSION_PADDING_FRAGMENTS) {
    cleaned = cleaned.replace(
      new RegExp(`\\s*${escapeRegExp(fragment)}[^.!?]*[.!?,]?`, "gi"),
      "",
    );
  }

  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  const filtered = sentences.filter((sentence) => {
    const lower = sentence.toLowerCase();
    return !EXPANSION_PADDING_FRAGMENTS.some((fragment) =>
      lower.includes(fragment.toLowerCase().slice(0, 32)),
    );
  });

  return filtered.join(" ").replace(/\s+/g, " ").trim();
}

function polishImagePromptProse(text: string): string {
  return text
    .replace(/\.,\s*/g, ". ")
    .replace(/\.\s*,/g, ". ")
    .replace(/,\s*\./g, ".")
    .replace(/,\s*,+/g, ", ")
    .replace(/\s+,/g, ", ")
    .replace(/^,\s*/, "")
    .replace(/,\s+(?=[.!?]|$)/g, "")
    .replace(/(\.\s+)([a-z])/g, (_, prefix: string, letter: string) => {
      return `${prefix}${letter.toUpperCase()}`;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSectionEnding(text: string): string {
  const trimmed = text.trim().replace(/[,.;\s]+$/, "");
  if (!trimmed) {
    return "";
  }

  if (/[.!?]$/.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed}.`;
}

function clauseOverlapRatio(clause: string, subjectLower: string): number {
  const words = clause.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];
  if (words.length === 0) {
    return 0;
  }

  return words.filter((word) => subjectLower.includes(word)).length / words.length;
}

function stripRedundantDetailSentences(subject: string, details: string): string {
  const subjectLower = subject.toLowerCase();
  const clauses = details
    .split(/,\s+(?=[A-Za-z])|(?<=[.!?])\s+/)
    .map((clause) => clause.trim().replace(/^[.!?]+|[.!?]+$/g, ""))
    .filter(Boolean);

  const unique = clauses.filter((clause) => {
    const overlap = clauseOverlapRatio(clause, subjectLower);
    if (overlap < 0.55) {
      return true;
    }

    return /\b(necklace|pendant|earring|tattoo|bracelet|ring|looking|gazing|smiling|facing)\b/i.test(
      clause,
    );
  });

  return unique
    .map((clause) => (/[.!?]$/.test(clause) ? clause : `${clause}.`))
    .join(" ")
    .trim();
}

const MARKDOWN_SECTION_PATTERN =
  /\*\*(Subject|Setting|Details|Background|Composition|Lighting)(?::\*\*|\*\*:?)\s*/gi;
function flattenMarkdownSections(text: string): string {
  const matches = [...text.matchAll(MARKDOWN_SECTION_PATTERN)];

  if (matches.length === 0) {
    return text
      .replace(MARKDOWN_SECTION_PATTERN, "")
      .replace(/\*\*([^*]+)\*\*:?\s*/g, "$1, ")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/^\s*[-*•]\s+/gm, "")
      .replace(/\s*[-*•]\s+/g, ", ");
  }

  const sections: Array<{ label: string; body: string }> = [];
  let subjectBody = "";

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const label = match[1] ?? "";
    const start = match.index! + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    let body = text.slice(start, end).trim();

    body = body
      .replace(/^[-*•]\s*/gm, "")
      .replace(/\*\*(Woman|Man|Person)(?::\*\*|\*\*:?)\s*/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!body) {
      continue;
    }

    if (/^details$/i.test(label) && subjectBody) {
      body = stripRedundantDetailSentences(subjectBody, body);
      if (!body) {
        continue;
      }
    }

    if (/^subject$/i.test(label)) {
      subjectBody = body;
    }

    sections.push({ label, body });
  }

  return sections
    .map(({ body }) => normalizeSectionEnding(body))
    .filter(Boolean)
    .join(" ");
}

export function stripVisionAnalysisArtifacts(text: string): string {
  let cleaned = text.trim();
  if (!cleaned) {
    return cleaned;
  }

  cleaned = cleaned
    .replace(
      /^The user wants[^.!?]*(?:[.!?]|(?=\*\*))/i,
      "",
    )
    .replace(/^This (?:image|photo|picture)[^.!?]*[.!?]\s*/i, "")
    .replace(/^Here(?:'s| is) (?:a |the )?(?:detailed )?(?:description|prompt)[^.!?]*[.!?]\s*/i, "")
    .replace(/^For (?:Qwen|ComfyUI|the target model)[^.!?]*[.!?]\s*/i, "")
    .replace(/^Convert(?:ing)? this image[^.!?]*[.!?]\s*/i, "")
    .trim();

  cleaned = flattenMarkdownSections(cleaned);

  cleaned = cleaned
    .replace(/\b(Subject|Setting|Details|Background|Composition|Lighting):\s*/gi, "")
    .replace(/\b(Woman|Man|Person):\s*/gi, "")
    .replace(/\s[-*•]\s+\*\*[^*]+\*\*:?\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

  cleaned = stripExpansionPadding(cleaned);
  cleaned = stripMetaInstructions(cleaned);
  cleaned = polishImagePromptProse(cleaned);

  return cleaned;
}

export function stripMetaInstructions(text: string): string {
  return text
    .replace(
      /\b(DISTINCT INDIVIDUALS MODE|GROUPED \/ COUPLE MODE|MANDATORY|DETAIL LEVEL|Target model|PEOPLE \(mandatory\)).*?\./gi,
      "",
    )
    .replace(/\bWrite EXACTLY[^.!?]*[.!?]/gi, "")
    .replace(/\bWrite \d+[^.!?]*characters[^.!?]*[.!?]/gi, "")
    .replace(/\bOptional flavor only[^.!?]*[.!?]/gi, "")
    .replace(/\bPerson [AB] must read as:[^.!?]*[.!?]/gi, "")
    .replace(/\bprompt:\s*/gi, "")
    .replace(/\boutput:\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
