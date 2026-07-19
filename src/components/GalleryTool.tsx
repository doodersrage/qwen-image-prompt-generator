"use client";

import ComfyUiGalleryPanel from "@/components/ComfyUiGalleryPanel";
import PngMetadataImportButton from "@/components/PngMetadataImportButton";
import SidecarImportButton from "@/components/SidecarImportButton";
import {
  fetchComfyHistoryImports,
  importComfyGalleryFromHistory,
} from "@/lib/comfyui-gallery-client";
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
import { Button } from "@/components/ui/Button";

const ACCENT = "neutral" as const;

export default function GalleryTool() {
  const [importedSidecar, setImportedSidecar] = useState<PromptSidecar | null>(
    null,
  );
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  return (
    <ToolLayout
      accent={ACCENT}
      width="wide"
      badge={<ToolBadge accent={ACCENT}>Gallery</ToolBadge>}
      title="ComfyUI Gallery"
      description={
        <>
          Every prompt you queue to ComfyUI from this app is tracked here. Import
          completed jobs from ComfyUI history or PNG metadata when outputs were
          generated outside this app.
        </>
      }
    >
      <ToolSection
        title="Import"
        description="Load sidecar JSON, PNG metadata, or backfill from ComfyUI server history."
      >
        <div className="flex flex-wrap items-center gap-3">
          <SidecarImportButton
            onImport={(sidecar) => {
              setImportedSidecar(sidecar);
              setImportStatus(`Loaded sidecar from ${sidecar.tool ?? "unknown tool"}.`);
            }}
            onError={setImportStatus}
          />
          <PngMetadataImportButton
            onImport={(sidecar) => {
              setImportedSidecar(sidecar);
              setImportStatus(`Loaded PNG metadata (${sidecar.tool ?? "png-import"}).`);
            }}
            onError={setImportStatus}
          />
          <Button
            variant="secondary"
            loading={historyLoading}
            loadingLabel="Importing ComfyUI history"
            onClick={() => {
              setHistoryLoading(true);
              void fetchComfyHistoryImports(40)
                .then((payload) => {
                  const result = importComfyGalleryFromHistory(payload.items ?? []);
                  setImportStatus(
                    `Imported ${result.imported} job(s) from ComfyUI history (${result.skipped} duplicate(s) skipped).`,
                  );
                })
                .catch((error) => {
                  setImportStatus(
                    error instanceof Error
                      ? error.message
                      : "ComfyUI history import failed.",
                  );
                })
                .finally(() => setHistoryLoading(false));
            }}
          >
            Import ComfyUI history
          </Button>
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
