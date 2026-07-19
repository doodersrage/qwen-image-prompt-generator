import type { GenerationDiagnostics } from "./generation-diagnostics";
import type { ComfyImageModel } from "./comfy-models";
import type { DetailLevel } from "./detail-level";

export type PromptSidecar = {
  version: 1;
  exportedAt: string;
  positive: string;
  negative?: string;
  model: string;
  detail?: DetailLevel;
  comfyNode?: string;
  hints?: string;
  tool?: string;
  variationSeed?: string;
  diagnostics?: GenerationDiagnostics;
  metadata?: Record<string, unknown>;
};

export function buildPromptSidecar(input: {
  positive: string;
  negative?: string;
  model: ComfyImageModel | string;
  detail?: DetailLevel;
  comfyNode?: string;
  hints?: string;
  tool?: string;
  variationSeed?: string;
  diagnostics?: GenerationDiagnostics | null;
  metadata?: Record<string, unknown>;
}): PromptSidecar {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    positive: input.positive.trim(),
    negative: input.negative?.trim() || undefined,
    model: input.model,
    detail: input.detail,
    comfyNode: input.comfyNode,
    hints: input.hints?.trim() || undefined,
    tool: input.tool,
    variationSeed: input.variationSeed?.trim() || undefined,
    diagnostics: input.diagnostics ?? undefined,
    metadata: input.metadata,
  };
}

export function downloadPromptSidecar(
  sidecar: PromptSidecar,
  filenamePrefix = "prompt-sidecar",
): void {
  const payload = JSON.stringify(sidecar, null, 2);
  const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filenamePrefix}-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function parsePromptSidecar(raw: string): PromptSidecar {
  const parsed = JSON.parse(raw) as Partial<PromptSidecar>;
  if (
    !parsed ||
    parsed.version !== 1 ||
    typeof parsed.positive !== "string" ||
    !parsed.positive.trim() ||
    typeof parsed.model !== "string"
  ) {
    throw new Error(
      "Invalid sidecar file. Expected version 1 with positive prompt and model.",
    );
  }

  return {
    version: 1,
    exportedAt: parsed.exportedAt ?? new Date().toISOString(),
    positive: parsed.positive.trim(),
    negative: parsed.negative?.trim() || undefined,
    model: parsed.model,
    detail: parsed.detail,
    comfyNode: parsed.comfyNode,
    hints: parsed.hints?.trim() || undefined,
    tool: parsed.tool,
    variationSeed: parsed.variationSeed?.trim() || undefined,
    diagnostics: parsed.diagnostics,
    metadata: parsed.metadata,
  };
}

export async function readPromptSidecarFile(file: File): Promise<PromptSidecar> {
  return parsePromptSidecar(await file.text());
}

export function sidecarNegativePrompt(sidecar: PromptSidecar): string | undefined {
  return sidecar.negative?.trim() || undefined;
}
