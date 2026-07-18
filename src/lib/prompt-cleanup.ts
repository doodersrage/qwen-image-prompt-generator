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

  return text;
}

export function stripMetaInstructions(text: string): string {
  return text
    .replace(
      /\b(DISTINCT INDIVIDUALS MODE|GROUPED \/ COUPLE MODE|MANDATORY|DETAIL LEVEL|Target model).*?\./gi,
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
