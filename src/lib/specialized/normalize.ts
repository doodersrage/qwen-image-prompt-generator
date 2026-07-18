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

export function normalizeRecentLocations(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }

  const locations = raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 24);

  return locations.length > 0 ? locations : undefined;
}
