import type { ComfyOutputImage } from "./comfyui-outputs";
import { buildComfyViewPath } from "./comfyui-outputs";

export const COMFYUI_GALLERY_KEY = "comfyui-gallery-v1";
export const COMFYUI_GALLERY_UPDATED_EVENT = "comfyui-gallery-updated";

export type ComfyGalleryJobStatus = "pending" | "running" | "completed" | "error";

export type ComfyGalleryFilter = {
  status?: ComfyGalleryJobStatus | "all";
  favoritesOnly?: boolean;
  tool?: string;
  query?: string;
};

export type ComfyGallerySort =
  | "queued-desc"
  | "queued-asc"
  | "completed-desc"
  | "tool-asc"
  | "favorites-first";

export const GALLERY_PAGE_SIZE_OPTIONS = [12, 24, 48] as const;
export type GalleryPageSize = (typeof GALLERY_PAGE_SIZE_OPTIONS)[number];

export type ComfyGalleryViewPreferences = {
  sort: ComfyGallerySort;
  pageSize: GalleryPageSize;
};

export const DEFAULT_GALLERY_VIEW: ComfyGalleryViewPreferences = {
  sort: "queued-desc",
  pageSize: 12,
};

export const COMFYUI_GALLERY_VIEW_KEY = "comfyui-gallery-view-v1";

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
  const query = filter.query?.trim().toLowerCase();

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
    if (query) {
      const haystack = [
        entry.prompt,
        entry.negativePrompt,
        entry.tool,
        entry.model,
        entry.promptId,
        entry.statusMessage,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });
}

export function paginateGalleryEntries<T>(
  entries: T[],
  page: number,
  pageSize: number,
): { items: T[]; page: number; totalPages: number; totalItems: number } {
  const totalItems = entries.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: entries.slice(start, start + pageSize),
    page: safePage,
    totalPages,
    totalItems,
  };
}

export function sortGalleryEntries(
  entries: ComfyGalleryEntry[],
  sort: ComfyGallerySort = DEFAULT_GALLERY_VIEW.sort,
): ComfyGalleryEntry[] {
  const sorted = [...entries];

  switch (sort) {
    case "queued-asc":
      return sorted.sort((a, b) => a.queuedAt - b.queuedAt);
    case "completed-desc":
      return sorted.sort(
        (a, b) =>
          (b.completedAt ?? b.queuedAt) - (a.completedAt ?? a.queuedAt),
      );
    case "tool-asc":
      return sorted.sort(
        (a, b) =>
          (a.tool ?? "").localeCompare(b.tool ?? "") || b.queuedAt - a.queuedAt,
      );
    case "favorites-first":
      return sorted.sort(
        (a, b) =>
          Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) ||
          b.queuedAt - a.queuedAt,
      );
    case "queued-desc":
    default:
      return sorted.sort((a, b) => b.queuedAt - a.queuedAt);
  }
}

export function loadGalleryViewPreferences(): ComfyGalleryViewPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_GALLERY_VIEW;
  }

  try {
    const raw = window.localStorage.getItem(COMFYUI_GALLERY_VIEW_KEY);
    if (!raw) {
      return DEFAULT_GALLERY_VIEW;
    }

    const parsed = JSON.parse(raw) as Partial<ComfyGalleryViewPreferences>;
    const pageSize = GALLERY_PAGE_SIZE_OPTIONS.includes(
      parsed.pageSize as GalleryPageSize,
    )
      ? (parsed.pageSize as GalleryPageSize)
      : DEFAULT_GALLERY_VIEW.pageSize;

    const sortValues: ComfyGallerySort[] = [
      "queued-desc",
      "queued-asc",
      "completed-desc",
      "tool-asc",
      "favorites-first",
    ];
    const sort = sortValues.includes(parsed.sort as ComfyGallerySort)
      ? (parsed.sort as ComfyGallerySort)
      : DEFAULT_GALLERY_VIEW.sort;

    return { sort, pageSize };
  } catch {
    return DEFAULT_GALLERY_VIEW;
  }
}

export function saveGalleryViewPreferences(
  preferences: ComfyGalleryViewPreferences,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    COMFYUI_GALLERY_VIEW_KEY,
    JSON.stringify(preferences),
  );
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
