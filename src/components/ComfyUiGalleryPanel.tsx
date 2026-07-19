"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useComfyUiGallery } from "@/hooks/useComfyUiGallery";
import {
  downloadGalleryImage,
  downloadGallerySidecar,
  downloadGalleryImagesSequential,
  downloadGallerySidecarBundle,
} from "@/lib/comfyui-gallery-export";
import { requeueComfyJob, requeueComfyJobs } from "@/lib/comfyui-requeue";
import {
  galleryEntryViewUrls,
  type ComfyGalleryEntry,
  type ComfyGalleryJobStatus,
} from "@/lib/comfyui-gallery";

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

  const bulkEnabled = showFilters && !compact;

  const visibleEntries = useMemo(() => {
    const source = showFilters ? filteredEntries : entries;
    return limit ? source.slice(0, limit) : source;
  }, [entries, filteredEntries, limit, showFilters]);

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
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
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

          <p className="ml-auto text-xs text-zinc-600">
            {filteredEntries.length}/{entries.length} shown
          </p>
        </div>
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
            />
          ))}
        </div>
      )}
    </section>
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
}) {
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
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={entry.prompt.slice(0, 80)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-zinc-500">
            {entry.status === "pending" || entry.status === "running"
              ? `${entry.status}…`
              : entry.status === "error"
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
            {imageUrls.slice(1, 5).map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="h-10 w-10 rounded border border-zinc-800 object-cover"
                />
              </a>
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
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="text-violet-300 hover:text-violet-200"
            >
              Open full size
            </a>
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
