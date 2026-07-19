"use client";

import {
  buildGalleryHandoff,
  galleryHandoffPath,
  galleryImprovePath,
  IMPROVE_INTENT_DEFAULT,
  saveGalleryHandoff,
  type GalleryHandoffPayload,
} from "./gallery-handoff";
import type { ComfyGalleryEntry } from "./comfyui-gallery";

export function startImproveFromResult(input: {
  prompt: string;
  previewUrl?: string | null;
  model?: string;
  tool?: string;
  negativePrompt?: string;
}): void {
  const payload: GalleryHandoffPayload = {
    source: "gallery",
    galleryEntryId: "result-panel",
    promptId: "result-panel",
    prompt: input.prompt,
    negativePrompt: input.negativePrompt,
    model: input.model,
    tool: input.tool,
    imageUrl: input.previewUrl ?? undefined,
    target: "refine",
    improveIntent: IMPROVE_INTENT_DEFAULT,
    savedAt: Date.now(),
  };
  saveGalleryHandoff(payload);
  window.location.href = galleryImprovePath();
}

export function startRefineFromResult(input: {
  prompt: string;
  previewUrl?: string | null;
  model?: string;
  tool?: string;
  negativePrompt?: string;
}): void {
  saveGalleryHandoff({
    source: "gallery",
    galleryEntryId: "result-panel",
    promptId: "result-panel",
    prompt: input.prompt,
    negativePrompt: input.negativePrompt,
    model: input.model,
    tool: input.tool,
    imageUrl: input.previewUrl ?? undefined,
    target: "refine",
    savedAt: Date.now(),
  });
  window.location.href = galleryHandoffPath("refine");
}
export function startImproveFromGalleryEntry(entry: ComfyGalleryEntry): void {
  saveGalleryHandoff({
    ...buildGalleryHandoff(entry, "refine"),
    improveIntent: IMPROVE_INTENT_DEFAULT,
  });
  window.location.href = galleryImprovePath();
}
