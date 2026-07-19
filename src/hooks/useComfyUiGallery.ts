"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearComfyGallery,
  COMFYUI_GALLERY_UPDATED_EVENT,
  filterComfyGalleryEntries,
  galleryEntryPrimaryViewUrl,
  loadComfyGallery,
  removeComfyGalleryEntries,
  removeComfyGalleryEntry,
  setComfyGalleryFavorites,
  setComfyGalleryProjectIds,
  setGalleryReviewRating,
  toggleComfyGalleryFavorite,
  type ComfyGalleryEntry,
  type ComfyGalleryFilter,
  uniqueGalleryTools,
} from "@/lib/comfyui-gallery";
import { scheduleComfyGalleryPoll } from "@/lib/comfyui-gallery-poller";

export function useComfyUiGallery(initialFilter?: ComfyGalleryFilter) {
  const [mounted, setMounted] = useState(false);
  const [entries, setEntries] = useState<ComfyGalleryEntry[]>([]);
  const [filter, setFilter] = useState<ComfyGalleryFilter>(
    initialFilter ?? { status: "all" },
  );

  const refresh = useCallback(() => {
    setEntries(loadComfyGallery());
  }, []);

  useEffect(() => {
    setMounted(true);
    refresh();

    const handler = () => refresh();
    window.addEventListener(COMFYUI_GALLERY_UPDATED_EVENT, handler);
    return () => window.removeEventListener(COMFYUI_GALLERY_UPDATED_EVENT, handler);
  }, [refresh]);

  const filteredEntries = useMemo(
    () => filterComfyGalleryEntries(entries, filter),
    [entries, filter],
  );

  const tools = useMemo(() => uniqueGalleryTools(entries), [entries]);

  const removeEntry = useCallback(
    (id: string) => {
      removeComfyGalleryEntry(id);
      refresh();
    },
    [refresh],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      toggleComfyGalleryFavorite(id);
      refresh();
    },
    [refresh],
  );

  const removeEntries = useCallback(
    (ids: string[]) => {
      removeComfyGalleryEntries(ids);
      refresh();
    },
    [refresh],
  );

  const setFavorites = useCallback(
    (ids: string[], favorite: boolean) => {
      setComfyGalleryFavorites(ids, favorite);
      refresh();
    },
    [refresh],
  );

  const clearAll = useCallback(() => {
    clearComfyGallery();
    refresh();
  }, [refresh]);

  const refreshPending = useCallback(async () => {
    const pending = loadComfyGallery().filter(
      (entry) => entry.status === "pending" || entry.status === "running",
    );

    await Promise.all(
      pending.map((entry) =>
        scheduleComfyGalleryPoll(entry.promptId, { comfyUrl: entry.comfyUrl }),
      ),
    );

    refresh();
  }, [refresh]);

  const setReviewRating = useCallback(
    (id: string, rating: ComfyGalleryEntry["reviewRating"]) => {
      setGalleryReviewRating(id, rating);
      refresh();
    },
    [refresh],
  );

  const setProjectIds = useCallback(
    (ids: string[], projectId: string | undefined) => {
      setComfyGalleryProjectIds(ids, projectId);
      refresh();
    },
    [refresh],
  );

  return {
    mounted,
    entries,
    filteredEntries,
    filter,
    setFilter,
    tools,
    refresh,
    removeEntry,
    removeEntries,
    toggleFavorite,
    setFavorites,
    setProjectIds,
    clearAll,
    refreshPending,
    primaryViewUrl: galleryEntryPrimaryViewUrl,
    setReviewRating,
  };
}
