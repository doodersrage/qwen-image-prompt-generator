"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ImageLightbox, { type ImageLightboxState } from "@/components/ui/ImageLightbox";
import { ComfyUiGalleryJobPlaceholder } from "@/components/ui/ComfyUiJobStatusPanel";
import { Button } from "@/components/ui/Button";
import { useComfyUiGallery } from "@/hooks/useComfyUiGallery";
import {
  buildGalleryHandoff,
  galleryHandoffPath,
  saveGalleryHandoff,
} from "@/lib/gallery-handoff";
import {
  downloadGalleryImage,
  downloadGallerySidecar,
  downloadGalleryImagesSequential,
  downloadGallerySidecarBundle,
} from "@/lib/comfyui-gallery-export";
import { downloadGalleryZipBundle } from "@/lib/gallery-zip-export";
import { studioHistoryUrl } from "@/lib/prompt-lineage";
import { requeueComfyJob, requeueComfyJobs } from "@/lib/comfyui-requeue";
import {
  buildGalleryLightboxPlaylist,
  galleryEntryViewUrls,
  GALLERY_PAGE_SIZE_ALL,
  GALLERY_PAGE_SIZE_OPTIONS,
  GALLERY_SLIDESHOW_INTERVAL_OPTIONS,
  GALLERY_SLIDESHOW_TRANSITION_OPTIONS,
  loadGalleryViewPreferences,
  paginateGalleryEntries,
  resolveGalleryPageSize,
  resolveGalleryLightboxOpenIndex,
  saveGalleryViewPreferences,
  sortGalleryEntries,
  type ComfyGalleryEntry,
  type ComfyGalleryJobStatus,
  type ComfyGallerySort,
  type GalleryPageSize,
  type GallerySlideshowIntervalMs,
  type GallerySlideshowTransition,
} from "@/lib/comfyui-gallery";

const GALLERY_SORT_OPTIONS: { value: ComfyGallerySort; label: string }[] = [
  { value: "queued-desc", label: "Newest queued" },
  { value: "queued-asc", label: "Oldest queued" },
  { value: "completed-desc", label: "Recently completed" },
  { value: "tool-asc", label: "Tool (A–Z)" },
  { value: "favorites-first", label: "Favorites first" },
];

type ComfyUiGalleryPanelProps = {
  limit?: number;
  showHeader?: boolean;
  compact?: boolean;
  showFilters?: boolean;
};

export default function ComfyUiGalleryPanel({
  limit,
  showHeader = true,
  compact = false,
  showFilters = false,
}: ComfyUiGalleryPanelProps) {
  const {
    mounted,
    entries,
    filteredEntries,
    filter,
    setFilter,
    tools,
    removeEntry,
    removeEntries,
    toggleFavorite,
    setFavorites,
    clearAll,
    refreshPending,
    primaryViewUrl,
  } = useComfyUiGallery();

  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [requeueStatus, setRequeueStatus] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<ImageLightboxState | null>(null);
  const [slideshowPlaying, setSlideshowPlaying] = useState(false);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ComfyGallerySort>("queued-desc");
  const [pageSize, setPageSize] = useState<GalleryPageSize>(12);
  const [slideshowIntervalMs, setSlideshowIntervalMs] =
    useState<GallerySlideshowIntervalMs>(5000);
  const [slideshowTransition, setSlideshowTransition] =
    useState<GallerySlideshowTransition>("slide");
  const [viewPrefsLoaded, setViewPrefsLoaded] = useState(false);

  const bulkEnabled = showFilters && !compact;
  const paginationEnabled = showFilters && !compact && !limit;

  const filteredSource = showFilters ? filteredEntries : entries;
  const sortedSource = useMemo(
    () => (paginationEnabled ? sortGalleryEntries(filteredSource, sort) : filteredSource),
    [filteredSource, paginationEnabled, sort],
  );

  useEffect(() => {
    if (!mounted) {
      return;
    }
    const preferences = loadGalleryViewPreferences();
    setSort(preferences.sort);
    setPageSize(preferences.pageSize);
    setSlideshowIntervalMs(preferences.slideshowIntervalMs);
    setSlideshowTransition(preferences.slideshowTransition);
    setViewPrefsLoaded(true);
  }, [mounted]);

  useEffect(() => {
    if (!viewPrefsLoaded || !paginationEnabled) {
      return;
    }
    saveGalleryViewPreferences({
      sort,
      pageSize,
      slideshowIntervalMs,
      slideshowTransition,
    });
  }, [
    sort,
    pageSize,
    slideshowIntervalMs,
    slideshowTransition,
    viewPrefsLoaded,
    paginationEnabled,
  ]);

  useEffect(() => {
    setPage(1);
  }, [filter.status, filter.tool, filter.favoritesOnly, filter.query, sort, pageSize]);

  const pagination = useMemo(() => {
    if (!paginationEnabled) {
      const items = limit ? sortedSource.slice(0, limit) : sortedSource;
      return {
        items,
        page: 1,
        totalPages: 1,
        totalItems: sortedSource.length,
      };
    }

    const effectivePageSize = resolveGalleryPageSize(pageSize, sortedSource.length);
    return paginateGalleryEntries(sortedSource, page, effectivePageSize);
  }, [sortedSource, limit, page, pageSize, paginationEnabled]);

  const visibleEntries = pagination.items;
  const totalPages = pagination.totalPages;
  const currentPage = pagination.page;
  const totalFiltered = pagination.totalItems;
  const effectivePageSize = resolveGalleryPageSize(pageSize, totalFiltered);
  const showPagination = paginationEnabled && pageSize !== GALLERY_PAGE_SIZE_ALL && totalFiltered > effectivePageSize;

  const lightboxPlaylist = useMemo(
    () => buildGalleryLightboxPlaylist(visibleEntries),
    [visibleEntries],
  );

  const openEntryLightbox = (entry: ComfyGalleryEntry, imageIndex: number) => {
    if (lightboxPlaylist.images.length === 0) {
      return;
    }

    const index = resolveGalleryLightboxOpenIndex(
      visibleEntries,
      entry.id,
      imageIndex,
    );

    setLightbox({
      images: lightboxPlaylist.images,
      titles: lightboxPlaylist.titles,
      index,
      title: lightboxPlaylist.titles[index],
    });
    setSlideshowPlaying(false);
  };

  const startSlideshow = () => {
    if (lightboxPlaylist.images.length === 0) {
      return;
    }

    setLightbox({
      images: lightboxPlaylist.images,
      titles: lightboxPlaylist.titles,
      index: 0,
      title: lightboxPlaylist.titles[0],
    });
    setSlideshowPlaying(true);
  };

  const closeLightbox = () => {
    setLightbox(null);
    setSlideshowPlaying(false);
  };

  useEffect(() => {
    if (!paginationEnabled || page === currentPage) {
      return;
    }
    setPage(currentPage);
  }, [currentPage, page, paginationEnabled]);

  const selectedEntries = useMemo(
    () => visibleEntries.filter((entry) => selectedIds.includes(entry.id)),
    [selectedIds, visibleEntries],
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((previous) =>
      previous.includes(id)
        ? previous.filter((entryId) => entryId !== id)
        : [...previous, id],
    );
  };

  if (!mounted) {
    return null;
  }

  return (
    <section className="space-y-4">
      <ImageLightbox
        state={lightbox}
        onClose={closeLightbox}
        onIndexChange={(index) =>
          setLightbox((previous) =>
            previous
              ? {
                  ...previous,
                  index,
                  title: previous.titles?.[index] ?? previous.title,
                }
              : previous,
          )
        }
        slideshow={
          lightboxPlaylist.images.length > 1
            ? {
                playing: slideshowPlaying,
                intervalMs: slideshowIntervalMs,
                intervalOptions: GALLERY_SLIDESHOW_INTERVAL_OPTIONS,
                transition: slideshowTransition,
                transitionOptions: GALLERY_SLIDESHOW_TRANSITION_OPTIONS,
                onPlayingChange: setSlideshowPlaying,
                onIntervalChange: (intervalMs) =>
                  setSlideshowIntervalMs(intervalMs as GallerySlideshowIntervalMs),
                onTransitionChange: setSlideshowTransition,
              }
            : undefined
        }
      />
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-zinc-200">ComfyUI gallery</h2>
            <p className="text-xs text-zinc-500">
              Jobs queued from this app, with outputs when ComfyUI finishes.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => void refreshPending()}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-300 hover:border-zinc-500"
            >
              Refresh in-progress
            </button>
            {entries.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Clear all gallery entries?")) {
                    clearAll();
                  }
                }}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-400 hover:border-zinc-500"
              >
                Clear gallery
              </button>
            )}
            {!compact && limit && entries.length > limit && (
              <Link
                href="/gallery"
                className="rounded-lg border border-violet-700/60 px-3 py-1.5 text-violet-200 hover:border-violet-500"
              >
                View all
              </Link>
            )}
          </div>
        </div>
      )}

      {showFilters && (
        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
          <label className="block space-y-1 text-xs text-zinc-400">
            Search gallery
            <input
              type="search"
              value={filter.query ?? ""}
              onChange={(event) =>
                setFilter({
                  ...filter,
                  query: event.target.value.trim() ? event.target.value : undefined,
                })
              }
              placeholder="Prompt, tool, model, prompt id…"
              className="ui-input block w-full px-[var(--input-padding-x)] py-[var(--input-padding-y)] type-body"
            />
          </label>

          <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-xs text-zinc-400">
            Status
            <select
              value={filter.status ?? "all"}
              onChange={(event) =>
                setFilter({
                  ...filter,
                  status: event.target.value as ComfyGalleryJobStatus | "all",
                })
              }
              className="block rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="error">Error</option>
            </select>
          </label>

          {tools.length > 0 && (
            <label className="space-y-1 text-xs text-zinc-400">
              Tool
              <select
                value={filter.tool ?? ""}
                onChange={(event) =>
                  setFilter({
                    ...filter,
                    tool: event.target.value || undefined,
                  })
                }
                className="block rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
              >
                <option value="">All tools</option>
                {tools.map((tool) => (
                  <option key={tool} value={tool}>
                    {tool}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex items-center gap-2 pb-1.5 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={filter.favoritesOnly ?? false}
              onChange={(event) =>
                setFilter({ ...filter, favoritesOnly: event.target.checked })
              }
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-950 accent-violet-500"
            />
            Favorites only
          </label>

          {paginationEnabled && (
            <>
              <label className="space-y-1 text-xs text-zinc-400">
                Sort
                <select
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value as ComfyGallerySort)
                  }
                  className="ui-input block px-3 py-[var(--input-padding-y)] type-body"
                >
                  {GALLERY_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs text-zinc-400">
                Per page
                <select
                  value={pageSize}
                  onChange={(event) =>
                    setPageSize(event.target.value as GalleryPageSize)
                  }
                  className="ui-input block px-3 py-[var(--input-padding-y)] type-body"
                >
                  {GALLERY_PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                  <option value={GALLERY_PAGE_SIZE_ALL}>All</option>
                </select>
              </label>

              {lightboxPlaylist.images.length > 1 && (
                <button
                  type="button"
                  onClick={startSlideshow}
                  className="self-end rounded-lg border border-violet-700/60 px-3 py-[var(--input-padding-y)] text-violet-200 hover:border-violet-500"
                >
                  Slideshow
                </button>
              )}
            </>
          )}

          <p className="ml-auto text-xs text-zinc-600">
            {totalFiltered}/{entries.length} match
            {paginationEnabled && showPagination
              ? ` · page ${currentPage}/${totalPages}`
              : pageSize === GALLERY_PAGE_SIZE_ALL && totalFiltered > 0
                ? " · showing all"
                : ""}
          </p>
          </div>
        </div>
      )}

      {showPagination && (
        <GalleryPaginator
          page={currentPage}
          totalPages={totalPages}
          totalItems={totalFiltered}
          pageSize={effectivePageSize}
          onPageChange={setPage}
        />
      )}

      {bulkEnabled && visibleEntries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-xs">
          <label className="flex items-center gap-2 text-zinc-300">
            <input
              type="checkbox"
              checked={
                visibleEntries.length > 0 &&
                visibleEntries.every((entry) => selectedIds.includes(entry.id))
              }
              onChange={(event) => {
                if (event.target.checked) {
                  setSelectedIds(visibleEntries.map((entry) => entry.id));
                } else {
                  setSelectedIds([]);
                }
              }}
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-950 accent-violet-500"
            />
            Select visible ({selectedIds.length})
          </label>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => setFavorites(selectedIds, true)}
            className="rounded-lg border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500 disabled:opacity-40"
          >
            Favorite
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => setFavorites(selectedIds, false)}
            className="rounded-lg border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500 disabled:opacity-40"
          >
            Unfavorite
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => {
              if (!window.confirm(`Delete ${selectedIds.length} selected entries?`)) {
                return;
              }
              removeEntries(selectedIds);
              setSelectedIds([]);
            }}
            className="rounded-lg border border-rose-800/60 px-2 py-1 text-rose-200 hover:border-rose-500 disabled:opacity-40"
          >
            Delete
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => {
              downloadGallerySidecarBundle(selectedEntries);
              setRequeueStatus(`Exported ${selectedEntries.length} sidecar(s).`);
            }}
            className="rounded-lg border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500 disabled:opacity-40"
          >
            Export sidecars
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => {
              setRequeueStatus("Downloading selected images…");
              void downloadGalleryImagesSequential(selectedEntries).then((count) => {
                setRequeueStatus(`Downloaded ${count} image(s).`);
              });
            }}
            className="rounded-lg border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500 disabled:opacity-40"
          >
            Download images
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => {
              setRequeueStatus("Building ZIP export…");
              void downloadGalleryZipBundle(selectedEntries).then((count) => {
                setRequeueStatus(`ZIP export prepared for ${count} entries.`);
              });
            }}
            className="rounded-lg border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-zinc-500 disabled:opacity-40"
          >
            Export ZIP
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => {
              setRequeueStatus("Bulk re-queue started…");
              void requeueComfyJobs(
                selectedEntries.map((entry) => ({
                  prompt: entry.prompt,
                  negativePrompt: entry.negativePrompt,
                  tool: entry.tool,
                  model: entry.model,
                  newSeed: true,
                })),
                setRequeueStatus,
              ).then(() => setSelectedIds([]));
            }}
            className="rounded-lg border border-violet-700/60 px-2 py-1 text-violet-200 hover:border-violet-500 disabled:opacity-40"
          >
            Re-queue (new seeds)
          </button>
        </div>
      )}

      {downloadError && (
        <p className="text-xs text-rose-300">{downloadError}</p>
      )}
      {requeueStatus && (
        <p className="text-xs text-violet-300/90">{requeueStatus}</p>
      )}

      {visibleEntries.length === 0 ? (
        <p className="text-sm text-zinc-500">
          {entries.length === 0
            ? "Nothing queued yet. Use Send to ComfyUI or Prepare for ComfyUI on any result panel."
            : "No entries match the current filters."}
        </p>
      ) : (
        <div
          className={
            compact
              ? "grid grid-cols-2 gap-4 sm:grid-cols-3"
              : "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          }
        >
          {visibleEntries.map((entry) => (
            <GalleryCard
              key={entry.id}
              entry={entry}
              compact={compact}
              selectable={bulkEnabled}
              selected={selectedIds.includes(entry.id)}
              onToggleSelected={() => toggleSelected(entry.id)}
              previewUrl={primaryViewUrl(entry)}
              imageUrls={galleryEntryViewUrls(entry)}
              onRemove={() => removeEntry(entry.id)}
              onToggleFavorite={() => toggleFavorite(entry.id)}
              onDownloadError={setDownloadError}
              onRequeue={(newSeed) => {
                setRequeueStatus("Re-queueing…");
                void requeueComfyJob({
                  prompt: entry.prompt,
                  negativePrompt: entry.negativePrompt,
                  tool: entry.tool,
                  model: entry.model,
                  newSeed,
                  onStatus: setRequeueStatus,
                }).then((result) => {
                  if (!result.ok) {
                    setRequeueStatus(result.error ?? "Re-queue failed.");
                    return;
                  }
                  setRequeueStatus(
                    [
                      "queued",
                      result.promptId ? `prompt_id ${result.promptId}` : null,
                      result.comfyUrl,
                      newSeed ? "new seed" : "same params",
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  );
                });
              }}
              onOpenImage={(index) => openEntryLightbox(entry, index)}
            />
          ))}
        </div>
      )}

      {showPagination && visibleEntries.length > 0 && (
        <GalleryPaginator
          page={currentPage}
          totalPages={totalPages}
          totalItems={totalFiltered}
          pageSize={effectivePageSize}
          onPageChange={setPage}
        />
      )}
    </section>
  );
}

function GalleryPaginator({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const rangeStart = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
      <p className="type-caption text-zinc-500">
        Showing {rangeStart}–{rangeEnd} of {totalItems}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          className="!min-h-9 px-3 type-caption"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="type-caption px-1 text-zinc-400">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="secondary"
          className="!min-h-9 px-3 type-caption"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function GalleryCard({
  entry,
  compact,
  selectable,
  selected,
  onToggleSelected,
  previewUrl,
  imageUrls,
  onRemove,
  onToggleFavorite,
  onDownloadError,
  onRequeue,
  onOpenImage,
}: {
  entry: ComfyGalleryEntry;
  compact: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelected?: () => void;
  previewUrl: string | null;
  imageUrls: string[];
  onRemove: () => void;
  onToggleFavorite: () => void;
  onDownloadError: (message: string | null) => void;
  onRequeue: (newSeed: boolean) => void;
  onOpenImage: (index: number) => void;
}) {
  const router = useRouter();
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const statusColor =
    entry.status === "completed"
      ? "text-emerald-400"
      : entry.status === "error"
        ? "text-rose-400"
        : "text-amber-300";

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(entry.prompt);
      setPromptCopied(true);
      window.setTimeout(() => setPromptCopied(false), 2000);
    } catch {
      onDownloadError("Could not copy prompt.");
    }
  };

  return (
    <article
      className={`overflow-hidden rounded-xl border bg-zinc-950/60 ${
        selected ? "border-violet-600/70 ring-1 ring-violet-500/30" : "border-zinc-800"
      }`}
    >
      <div className="relative aspect-square bg-zinc-900/80">
        {previewUrl ? (
          <button
            type="button"
            onClick={() => onOpenImage(0)}
            className="block h-full w-full cursor-zoom-in"
            aria-label="Open image preview"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={entry.prompt.slice(0, 80)}
              className="h-full w-full object-cover"
            />
          </button>
        ) : entry.status === "pending" || entry.status === "running" ? (
          <ComfyUiGalleryJobPlaceholder entry={entry} />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-zinc-500">
            {entry.status === "error"
              ? entry.statusMessage ?? "Generation failed"
              : "No image output"}
          </div>
        )}
        {selectable && (
          <label className="absolute left-2 top-2 rounded-full border border-zinc-700/80 bg-zinc-950/80 px-2 py-1 backdrop-blur">
            <input
              type="checkbox"
              checked={selected ?? false}
              onChange={onToggleSelected}
              className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-950 accent-violet-500"
            />
          </label>
        )}
        <button
          type="button"
          onClick={onToggleFavorite}
          title={entry.favorite ? "Remove favorite" : "Add favorite"}
          className={`absolute right-2 top-2 rounded-full border px-2 py-1 text-xs backdrop-blur ${
            entry.favorite
              ? "border-amber-500/60 bg-amber-500/20 text-amber-200"
              : "border-zinc-700/80 bg-zinc-950/70 text-zinc-400 hover:text-amber-200"
          }`}
        >
          {entry.favorite ? "★" : "☆"}
        </button>
      </div>

      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`text-xs font-medium uppercase tracking-wide ${statusColor}`}>
              {entry.status}
            </p>
            {(entry.status === "pending" || entry.status === "running") &&
            entry.queuePosition != null &&
            entry.queuePosition > 0 ? (
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Queue position {entry.queuePosition}
              </p>
            ) : null}
            {promptExpanded ? (
              <div className="mt-2 space-y-3">
                <div>
                  <p className="type-overline mb-1 text-zinc-500">Positive prompt</p>
                  <pre className="type-code max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 !text-zinc-300">
                    {entry.prompt}
                  </pre>
                </div>
                {entry.negativePrompt?.trim() ? (
                  <div>
                    <p className="type-overline mb-1 text-zinc-500">Negative prompt</p>
                    <pre className="type-code max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 !text-zinc-400">
                      {entry.negativePrompt}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{entry.prompt}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 text-xs text-zinc-600 hover:text-rose-300"
          >
            Remove
          </button>
        </div>

        <p className="text-[11px] text-zinc-600">
          {[entry.tool, entry.model, new Date(entry.queuedAt).toLocaleString()]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {!compact && imageUrls.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {imageUrls.slice(1, 5).map((url, thumbIndex) => (
              <button
                key={url}
                type="button"
                onClick={() => onOpenImage(thumbIndex + 1)}
                className="cursor-zoom-in overflow-hidden rounded border border-zinc-800"
                aria-label={`Open image ${thumbIndex + 2} preview`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="h-10 w-10 object-cover"
                />
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => setPromptExpanded((previous) => !previous)}
            className="text-violet-300 hover:text-violet-200"
          >
            {promptExpanded ? "Show less" : "View full prompt"}
          </button>
          {promptExpanded && (
            <button
              type="button"
              onClick={() => void copyPrompt()}
              className="text-zinc-400 hover:text-zinc-200"
            >
              {promptCopied ? "Copied!" : "Copy prompt"}
            </button>
          )}
          {previewUrl && (
            <button
              type="button"
              onClick={() => onOpenImage(0)}
              className="text-violet-300 hover:text-violet-200"
            >
              View image
            </button>
          )}
          {entry.status === "completed" && previewUrl && (
            <button
              type="button"
              onClick={() => {
                onDownloadError(null);
                void downloadGalleryImage(entry).catch((error) => {
                  onDownloadError(
                    error instanceof Error ? error.message : "Download failed.",
                  );
                });
              }}
              className="text-zinc-400 hover:text-zinc-200"
            >
              Download image
            </button>
          )}
          <button
            type="button"
            onClick={() => downloadGallerySidecar(entry)}
            className="text-zinc-400 hover:text-zinc-200"
          >
            Sidecar JSON
          </button>
          {entry.historyId ? (
            <Link
              href={studioHistoryUrl(entry.historyId)}
              className="text-sky-300 hover:text-sky-200"
            >
              Studio history
            </Link>
          ) : null}
          {entry.status === "completed" && previewUrl ? (
            <>
              <button
                type="button"
                onClick={() => {
                  saveGalleryHandoff(buildGalleryHandoff(entry, "refine"));
                  router.push(galleryHandoffPath("refine"));
                }}
                className="text-fuchsia-300 hover:text-fuchsia-200"
              >
                Refine
              </button>
              <button
                type="button"
                onClick={() => {
                  saveGalleryHandoff(buildGalleryHandoff(entry, "imagePrompt"));
                  router.push(galleryHandoffPath("imagePrompt"));
                }}
                className="text-fuchsia-300/90 hover:text-fuchsia-200"
              >
                Image → Prompt
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => onRequeue(false)}
            className="text-violet-300 hover:text-violet-200"
          >
            Re-queue
          </button>
          <button
            type="button"
            onClick={() => onRequeue(true)}
            className="text-violet-300/80 hover:text-violet-200"
          >
            Re-queue (new seed)
          </button>
        </div>
      </div>
    </article>
  );
}
