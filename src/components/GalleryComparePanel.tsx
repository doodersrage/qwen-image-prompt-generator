"use client";

import type { ComfyGalleryEntry } from "@/lib/comfyui-gallery";
import { galleryEntryViewUrls } from "@/lib/comfyui-gallery";

type GalleryComparePanelProps = {
  entries: ComfyGalleryEntry[];
  onClose: () => void;
};

export default function GalleryComparePanel({
  entries,
  onClose,
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
              </p>
              <pre className="max-h-24 overflow-auto whitespace-pre-wrap text-xs text-zinc-300">
                {entry.prompt}
              </pre>
            </article>
          );
        })}
      </div>
    </div>
  );
}
