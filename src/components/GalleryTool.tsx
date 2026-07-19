"use client";

import ComfyUiGalleryPanel from "@/components/ComfyUiGalleryPanel";
import SidecarImportButton from "@/components/SidecarImportButton";
import { requeueComfyJob } from "@/lib/comfyui-requeue";
import {
  sidecarNegativePrompt,
  type PromptSidecar,
} from "@/lib/prompt-sidecar";
import { useState } from "react";
import {
  ToolBadge,
  ToolLayout,
  ToolSection,
} from "@/components/ui/ToolPageShell";

const ACCENT = "neutral" as const;

export default function GalleryTool() {
  const [importedSidecar, setImportedSidecar] = useState<PromptSidecar | null>(
    null,
  );
  const [importStatus, setImportStatus] = useState<string | null>(null);

  return (
    <ToolLayout
      accent={ACCENT}
      width="wide"
      badge={<ToolBadge accent={ACCENT}>Gallery</ToolBadge>}
      title="ComfyUI Gallery"
      description={
        <>
          Every prompt you queue to ComfyUI from this app is tracked here. Images
          appear when the job completes—click through for full size or remove entries
          you no longer need.
        </>
      }
    >
      <ToolSection
        title="Import sidecar"
        description="Load a sidecar JSON to re-queue a saved prompt without opening another tool."
      >
        <div className="flex flex-wrap items-center justify-end gap-3">
          <SidecarImportButton
            onImport={(sidecar) => {
              setImportedSidecar(sidecar);
              setImportStatus(`Loaded sidecar from ${sidecar.tool ?? "unknown tool"}.`);
            }}
            onError={setImportStatus}
          />
        </div>
        {importStatus && <p className="text-xs text-zinc-500">{importStatus}</p>}
        {importedSidecar && (
          <div className="space-y-3 rounded-xl border border-violet-900/40 bg-zinc-950/50 p-4">
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
      </ToolSection>
    </ToolLayout>
  );
}
