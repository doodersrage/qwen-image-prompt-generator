import type { PromptSidecar } from "./prompt-sidecar";
import { buildPromptSidecar } from "./prompt-sidecar";

export type PngMetadataResult = {
  positive?: string;
  negative?: string;
  seed?: string;
  workflowJson?: string;
  rawParameters?: string;
  source: "comfyui" | "a1111" | "unknown";
};

function readAscii(view: DataView, offset: number, length: number): string {
  let text = "";
  for (let index = 0; index < length; index += 1) {
    text += String.fromCharCode(view.getUint8(offset + index));
  }
  return text;
}

function parseTextChunks(buffer: ArrayBuffer): Record<string, string> {
  const view = new DataView(buffer);
  const chunks: Record<string, string> = {};

  if (view.getUint32(0) !== 0x89504e47) {
    return chunks;
  }

  let offset = 8;
  while (offset + 8 <= buffer.byteLength) {
    const length = view.getUint32(offset);
    const type = readAscii(view, offset + 4, 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (dataEnd + 4 > buffer.byteLength) {
      break;
    }

    if (type === "tEXt") {
      const raw = readAscii(view, dataStart, length);
      const separator = raw.indexOf("\0");
      if (separator >= 0) {
        const key = raw.slice(0, separator);
        chunks[key] = raw.slice(separator + 1);
      }
    } else if (type === "iTXt") {
      const rawBytes = new Uint8Array(buffer, dataStart, length);
      let cursor = 0;
      while (cursor < rawBytes.length && rawBytes[cursor] !== 0) {
        cursor += 1;
      }
      const key = new TextDecoder().decode(rawBytes.slice(0, cursor));
      cursor += 1;
      const compression = rawBytes[cursor];
      cursor += 1;
      while (cursor < rawBytes.length && rawBytes[cursor] !== 0) {
        cursor += 1;
      }
      cursor += 1;
      while (cursor < rawBytes.length && rawBytes[cursor] !== 0) {
        cursor += 1;
      }
      cursor += 1;
      const valueBytes = rawBytes.slice(cursor);
      const value =
        compression === 0
          ? new TextDecoder().decode(valueBytes)
          : new TextDecoder().decode(valueBytes);
      if (key) {
        chunks[key] = value;
      }
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  return chunks;
}

function parseA1111Parameters(raw: string): Pick<PngMetadataResult, "positive" | "negative" | "seed"> {
  const parts = raw.split("\nNegative prompt:");
  const positiveBlock = parts[0]?.trim() ?? "";
  const negativeBlock = parts[1]?.split("\nSteps:")[0]?.trim();

  const positive = positiveBlock.replace(/^Parameters:\s*/i, "").trim() || undefined;
  const negative = negativeBlock?.trim() || undefined;

  const seedMatch = raw.match(/\bSeed:\s*(\d+)/i);
  return {
    positive,
    negative,
    seed: seedMatch?.[1],
  };
}

export function parsePngMetadata(buffer: ArrayBuffer): PngMetadataResult | null {
  const chunks = parseTextChunks(buffer);
  const parameters =
    chunks.parameters ??
    chunks.Parameters ??
    chunks.prompt ??
    chunks.Prompt ??
    chunks.description;

  const workflowJson =
    chunks.workflow ??
    chunks.Workflow ??
    chunks.prompt_json ??
    chunks["comfyui-workflow"];

  if (!parameters && !workflowJson) {
    return null;
  }

  const parsed = parameters ? parseA1111Parameters(parameters) : {};
  const source = workflowJson ? "comfyui" : parameters?.includes("Negative prompt:") ? "a1111" : "unknown";

  return {
    positive: parsed.positive,
    negative: parsed.negative,
    seed: parsed.seed,
    workflowJson,
    rawParameters: parameters,
    source,
  };
}

export async function readPngMetadataFile(file: File): Promise<PngMetadataResult> {
  const buffer = await file.arrayBuffer();
  const parsed = parsePngMetadata(buffer);
  if (!parsed) {
    throw new Error("No ComfyUI or A1111 metadata found in this PNG.");
  }
  return parsed;
}

export function pngMetadataToSidecar(
  metadata: PngMetadataResult,
  model?: string,
): PromptSidecar {
  const positive =
    metadata.positive?.trim() ||
    (metadata.source === "comfyui" ? "Imported ComfyUI output" : "Imported PNG prompt");

  return buildPromptSidecar({
    positive,
    negative: metadata.negative,
    model: model ?? "n/a",
    tool: metadata.source === "comfyui" ? "comfyui-import" : "png-import",
    hints: metadata.rawParameters?.slice(0, 500),
    variationSeed: metadata.seed,
    metadata: metadata.workflowJson
      ? { workflowJson: metadata.workflowJson }
      : undefined,
  });
}
