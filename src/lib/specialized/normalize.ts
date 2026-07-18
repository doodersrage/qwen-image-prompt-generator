import { normalizeComfyModel } from "../comfy-models";
import { normalizeDetailLevel, type DetailLevel } from "../detail-level";
import type { SharedGenerationOptions } from "./types";

export function normalizeSharedGenerationOptions(
  body?: Partial<{ model?: string; detail?: string | DetailLevel }> | null,
): SharedGenerationOptions {
  return {
    model: normalizeComfyModel(body?.model),
    detail: normalizeDetailLevel(body?.detail),
  };
}
