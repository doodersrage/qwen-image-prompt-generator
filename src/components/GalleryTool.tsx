"use client";

import ComfyUiGalleryPanel from "@/components/ComfyUiGalleryPanel";
import SidecarImportButton from "@/components/SidecarImportButton";
import { requeueComfyJob } from "@/lib/comfyui-requeue";
import {
  sidecarNegativePrompt,
  type PromptSidecar,
} from "@/lib/prompt-sidecar";
import { useState } from "react";

export default function GalleryTool() {
  const [importedSidecar, setImportedSidecar] = useState<PromptSidecar | null>(
    null,
  );
  const [importStatus, setImportStatus] = useState<string | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-violet-300">
          Gallery
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          ComfyUI Gallery
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
          Every prompt you queue to ComfyUI from this app is tracked here. Images
          appear when the job completes—click through for full size or remove entries
          you no longer need.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-zinc-200">Import sidecar</h2>
            <p className="text-xs text-zinc-500">
              Load a sidecar JSON to re-queue a saved prompt without opening another tool.
            </p>
          </div>
          <SidecarImportButton
            onImport={(sidecar) => {
              setImportedSidecar(sidecar);
              setImportStatus(`Loaded sidecar from ${sidecar.tool ?? "unknown tool"}.`);
            }}
            onError={setImportStatus}
          />
        </div>
        {importStatus && <p className="mb-3 text-xs text-zinc-500">{importStatus}</p>}
        {importedSidecar && (
          <div className="mb-4 space-y-3 rounded-xl border border-violet-900/40 bg-zinc-950/50 p-4">
            <p className="line-clamp-3 text-sm text-zinc-300">
              {importedSidecar.positive}
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setImportStatus("Re-queueing imported sidecar…");
                  void requeueComfyJob({
                    prompt: importedSidecar.positive,
                    negativePrompt: sidecarNegativePrompt(importedSidecar),
                    tool: importedSidecar.tool,
                    model: importedSidecar.model,
                    hints: importedSidecar.hints,
                    newSeed: false,
                    onStatus: setImportStatus,
                  });
                }}
                className="rounded-lg border border-violet-700/60 px-3 py-1.5 text-violet-200 hover:border-violet-500"
              >
                Re-queue
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportStatus("Re-queueing with new seed…");
                  void requeueComfyJob({
                    prompt: importedSidecar.positive,
                    negativePrompt: sidecarNegativePrompt(importedSidecar),
                    tool: importedSidecar.tool,
                    model: importedSidecar.model,
                    hints: importedSidecar.hints,
                    newSeed: true,
                    onStatus: setImportStatus,
                  });
                }}
                className="rounded-lg border border-violet-700/60 px-3 py-1.5 text-violet-200/90 hover:border-violet-500"
              >
                Re-queue (new seed)
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportedSidecar(null);
                  setImportStatus(null);
                }}
                className="text-zinc-500 hover:text-zinc-300"
              >
                Clear
              </button>
            </div>
          </div>
        )}
        <ComfyUiGalleryPanel showHeader showFilters />
      </section>
    </div>
  );
}
