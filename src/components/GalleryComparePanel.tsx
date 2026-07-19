"use client";

import type { ComfyGalleryEntry } from "@/lib/comfyui-gallery";
import { galleryEntryViewUrls } from "@/lib/comfyui-gallery";
import { Button } from "@/components/ui/Button";

type GalleryComparePanelProps = {
  entries: ComfyGalleryEntry[];
  onClose: () => void;
  onPickWinner?: (entry: ComfyGalleryEntry) => void;
  onRate?: (entryId: string, rating: ComfyGalleryEntry["reviewRating"]) => void;
  onFavorite?: (entryId: string) => void;
  onMutate?: (entry: ComfyGalleryEntry) => void;
  onImprove?: (entry: ComfyGalleryEntry) => void;
  status?: string | null;
};

export default function GalleryComparePanel({
  entries,
  onClose,
  onPickWinner,
  onRate,
  onFavorite,
  onMutate,
  onImprove,
  status,
}: GalleryComparePanelProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-xl border border-violet-700/40 bg-violet-950/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-violet-100">
          Compare {entries.length} selected outputs
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-zinc-400 hover:text-zinc-200"
        >
          Close
        </button>
      </div>
      {status ? <p className="text-xs text-violet-300/90">{status}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {entries.map((entry) => {
          const url = galleryEntryViewUrls(entry)[0] ?? null;
          return (
            <article key={entry.id} className="space-y-2 rounded-lg border border-zinc-800 p-2">
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="aspect-square w-full rounded object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded bg-zinc-900 text-xs text-zinc-500">
                  No image
                </div>
              )}
              <p className="text-[11px] text-zinc-500">
                {entry.model} · seed {entry.queueParams?.seed ?? "?"}
                {entry.reviewRating ? ` · ${entry.reviewRating}★` : ""}
              </p>
              <pre className="max-h-24 overflow-auto whitespace-pre-wrap text-xs text-zinc-300">
                {entry.prompt}
              </pre>
              <div className="flex flex-wrap gap-1">
                {onPickWinner ? (
                  <Button
                    variant="secondary"
                    className="!min-h-7 px-2 text-[11px]"
                    onClick={() => onPickWinner(entry)}
                  >
                    Pick winner
                  </Button>
                ) : null}
                {[5, 4, 3, 2, 1].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    disabled={!onRate}
                    onClick={() => onRate?.(entry.id, rating as ComfyGalleryEntry["reviewRating"])}
                    className={`rounded px-1.5 py-0.5 text-[10px] ${
                      entry.reviewRating === rating
                        ? "bg-violet-700 text-white"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {rating}★
                  </button>
                ))}
                {onFavorite ? (
                  <button
                    type="button"
                    onClick={() => onFavorite(entry.id)}
                    className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-zinc-700"
                  >
                    {entry.favorite ? "★ Fav" : "☆ Fav"}
                  </button>
                ) : null}
                {onMutate ? (
                  <button
                    type="button"
                    onClick={() => onMutate(entry)}
                    className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-emerald-300 hover:bg-zinc-700"
                  >
                    Mutate
                  </button>
                ) : null}
                {onImprove ? (
                  <button
                    type="button"
                    onClick={() => onImprove(entry)}
                    className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-sky-300 hover:bg-zinc-700"
                  >
                    Improve
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
