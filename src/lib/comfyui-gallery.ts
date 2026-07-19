import type { ComfyOutputImage } from "./comfyui-outputs";
import { buildComfyViewPath } from "./comfyui-outputs";

export const COMFYUI_GALLERY_KEY = "comfyui-gallery-v1";
export const COMFYUI_GALLERY_UPDATED_EVENT = "comfyui-gallery-updated";

export type ComfyGalleryJobStatus = "pending" | "running" | "completed" | "error";

export type ComfyGalleryFilter = {
  status?: ComfyGalleryJobStatus | "all";
  favoritesOnly?: boolean;
  tool?: string;
};

export type ComfyGalleryEntry = {
  id: string;
  promptId: string;
  prompt: string;
  negativePrompt?: string;
  tool?: string;
  model?: string;
  comfyUrl: string;
  status: ComfyGalleryJobStatus;
  statusMessage?: string;
  queuedAt: number;
  completedAt?: number;
  favorite?: boolean;
  images: ComfyOutputImage[];
};

const MAX_GALLERY_ENTRIES = 80;

export function loadComfyGallery(): ComfyGalleryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(COMFYUI_GALLERY_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as ComfyGalleryEntry[];
  } catch {
    return [];
  }
}

export function saveComfyGallery(entries: ComfyGalleryEntry[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    COMFYUI_GALLERY_KEY,
    JSON.stringify(entries.slice(0, MAX_GALLERY_ENTRIES)),
  );
  window.dispatchEvent(new CustomEvent(COMFYUI_GALLERY_UPDATED_EVENT));
}

export function clearComfyGallery(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(COMFYUI_GALLERY_KEY);
  window.dispatchEvent(new CustomEvent(COMFYUI_GALLERY_UPDATED_EVENT));
}

export function filterComfyGalleryEntries(
  entries: ComfyGalleryEntry[],
  filter: ComfyGalleryFilter,
): ComfyGalleryEntry[] {
  return entries.filter((entry) => {
    if (filter.favoritesOnly && !entry.favorite) {
      return false;
    }
    if (filter.status && filter.status !== "all" && entry.status !== filter.status) {
      return false;
    }
    if (filter.tool?.trim() && entry.tool !== filter.tool.trim()) {
      return false;
    }
    return true;
  });
}

export function uniqueGalleryTools(entries: ComfyGalleryEntry[]): string[] {
  return [...new Set(entries.map((entry) => entry.tool).filter(Boolean) as string[])].sort();
}

export function addComfyGalleryEntry(
  input: Omit<ComfyGalleryEntry, "id" | "queuedAt" | "images" | "status"> & {
    status?: ComfyGalleryJobStatus;
    images?: ComfyOutputImage[];
  },
): ComfyGalleryEntry {
  const entry: ComfyGalleryEntry = {
    id: crypto.randomUUID(),
    queuedAt: Date.now(),
    status: input.status ?? "pending",
    images: input.images ?? [],
    ...input,
  };

  saveComfyGallery([entry, ...loadComfyGallery()]);
  return entry;
}

export function updateComfyGalleryByPromptId(
  promptId: string,
  patch: Partial<
    Pick<
      ComfyGalleryEntry,
      "status" | "statusMessage" | "completedAt" | "images" | "comfyUrl" | "favorite"
    >
  >,
): ComfyGalleryEntry | null {
  let updated: ComfyGalleryEntry | null = null;
  const next = loadComfyGallery().map((entry) => {
    if (entry.promptId !== promptId) {
      return entry;
    }
    updated = { ...entry, ...patch };
    return updated;
  });

  if (!updated) {
    return null;
  }

  saveComfyGallery(next);
  return updated;
}

export function toggleComfyGalleryFavorite(id: string): void {
  saveComfyGallery(
    loadComfyGallery().map((entry) =>
      entry.id === id ? { ...entry, favorite: !entry.favorite } : entry,
    ),
  );
}

export function removeComfyGalleryEntry(id: string): void {
  saveComfyGallery(loadComfyGallery().filter((entry) => entry.id !== id));
}

export function removeComfyGalleryEntries(ids: string[]): void {
  if (ids.length === 0) {
    return;
  }
  const idSet = new Set(ids);
  saveComfyGallery(loadComfyGallery().filter((entry) => !idSet.has(entry.id)));
}

export function setComfyGalleryFavorites(ids: string[], favorite: boolean): void {
  if (ids.length === 0) {
    return;
  }
  const idSet = new Set(ids);
  saveComfyGallery(
    loadComfyGallery().map((entry) =>
      idSet.has(entry.id) ? { ...entry, favorite } : entry,
    ),
  );
}

export function galleryEntryViewUrls(entry: ComfyGalleryEntry): string[] {
  return entry.images.map((image) => buildComfyViewPath(entry.comfyUrl, image));
}

export function galleryEntryPrimaryViewUrl(entry: ComfyGalleryEntry): string | null {
  return galleryEntryViewUrls(entry)[0] ?? null;
}
