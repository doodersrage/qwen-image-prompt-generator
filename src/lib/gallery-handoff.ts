import type { ComfyGalleryEntry } from "./comfyui-gallery";
import { buildComfyViewPath } from "./comfyui-outputs";

export const GALLERY_HANDOFF_KEY = "gallery-handoff-v1";

export type GalleryHandoffPayload = {
  source: "gallery";
  galleryEntryId: string;
  promptId: string;
  prompt: string;
  negativePrompt?: string;
  model?: string;
  tool?: string;
  historyId?: string;
  imageUrl?: string;
  imageFilename?: string;
  target: "refine" | "imagePrompt";
  savedAt: number;
};

export function buildGalleryHandoff(
  entry: ComfyGalleryEntry,
  target: GalleryHandoffPayload["target"],
): GalleryHandoffPayload {
  const image = entry.images[0];
  return {
    source: "gallery",
    galleryEntryId: entry.id,
    promptId: entry.promptId,
    prompt: entry.prompt,
    negativePrompt: entry.negativePrompt,
    model: entry.model,
    tool: entry.tool,
    historyId: entry.historyId,
    imageUrl: image ? buildComfyViewPath(entry.comfyUrl, image) : undefined,
    imageFilename: image?.filename,
    target,
    savedAt: Date.now(),
  };
}

export function saveGalleryHandoff(payload: GalleryHandoffPayload): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(GALLERY_HANDOFF_KEY, JSON.stringify(payload));
}

export function loadGalleryHandoff(
  target?: GalleryHandoffPayload["target"],
): GalleryHandoffPayload | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(GALLERY_HANDOFF_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as GalleryHandoffPayload;
    if (parsed.source !== "gallery" || !parsed.prompt?.trim()) {
      return null;
    }
    if (target && parsed.target !== target) {
      return null;
    }
    if (Date.now() - parsed.savedAt > 30 * 60 * 1000) {
      window.sessionStorage.removeItem(GALLERY_HANDOFF_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearGalleryHandoff(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(GALLERY_HANDOFF_KEY);
}

export async function fetchHandoffImageFile(
  payload: GalleryHandoffPayload,
): Promise<File | null> {
  if (!payload.imageUrl) {
    return null;
  }

  const response = await fetch(payload.imageUrl);
  if (!response.ok) {
    throw new Error(`Could not load gallery image (HTTP ${response.status}).`);
  }

  const blob = await response.blob();
  const filename =
    payload.imageFilename?.trim() ||
    `gallery-${payload.promptId.slice(0, 8)}.png`;
  return new File([blob], filename, { type: blob.type || "image/png" });
}

export function galleryHandoffPath(target: GalleryHandoffPayload["target"]): string {
  return target === "refine" ? "/refine?from=gallery" : "/image-prompt?from=gallery";
}
