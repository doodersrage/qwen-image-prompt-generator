"use client";

import PromptResultPanel from "@/components/PromptResultPanel";
import PromptDiagnosticsPanel from "@/components/PromptDiagnosticsPanel";
import WorkflowPreviewPanel from "@/components/WorkflowPreviewPanel";
import type { GenerationDiagnostics } from "@/lib/generation-diagnostics";

type EnhancedPromptResultProps = {
  output: string;
  provider: "llm" | "template" | "rules" | null;
  comfyNode?: string;
  limits?: {
    minChars?: number;
    maxChars: number;
  };
  copied: boolean;
  onCopy: () => void;
  extraMeta?: string;
  diagnostics?: GenerationDiagnostics | null;
  onSaveHistory?: () => void;
  onSendComfyUi?: () => void;
  onFixPrompt?: () => void;
  onCopyPair?: () => void;
  onExportBatch?: () => void;
  onQueueBatchComfyUi?: () => void;
  onCompact?: () => void;
  onReformat?: () => void;
  reformatTargetLabel?: string;
  onRunPipeline?: () => void;
  onExportSidecar?: () => void;
  onPreviewWorkflow?: () => void;
  workflowPreview?: {
    workflowSource?: string;
    replacements?: {
      positive: number;
      negative: number;
    custom?: Record<string, number>;
  };
    resolvedParams?: {
      seed: string;
      width: string;
      height: string;
      cfg: string;
      steps: string;
    };
    snippets?: Array<{ path: string; value: string }>;
    workflowJson?: string;
    truncated?: boolean;
  } | null;
  previewStatus?: string | null;
  variationSeed?: string | null;
  onLockSeed?: () => void;
  seedLocked?: boolean;
  fixStatus?: string | null;
  compactStatus?: string | null;
  reformatStatus?: string | null;
  pipelineStatus?: string | null;
  preDiagnostics?: GenerationDiagnostics | null;
  comfyUiStatus?: string | null;
  comfyUiPreviewUrl?: string | null;
  historySaved?: boolean;
  pairCopied?: boolean;
  batchOutputs?: string[];
};

export default function EnhancedPromptResult({
  diagnostics,
  onSaveHistory,
  onSendComfyUi,
  onFixPrompt,
  onCopyPair,
  onExportBatch,
  onQueueBatchComfyUi,
  onCompact,
  onReformat,
  reformatTargetLabel,
  onRunPipeline,
  onExportSidecar,
  onPreviewWorkflow,
  workflowPreview,
  previewStatus,
  variationSeed,
  onLockSeed,
  seedLocked,
  fixStatus,
  compactStatus,
  reformatStatus,
  pipelineStatus,
  preDiagnostics,
  comfyUiStatus,
  comfyUiPreviewUrl,
  historySaved,
  pairCopied,
  batchOutputs,
  ...panelProps
}: EnhancedPromptResultProps) {
  if (!panelProps.output && (!batchOutputs || batchOutputs.length === 0)) {
    return null;
  }

  return (
    <div className="space-y-4">
      {preDiagnostics && (
        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Pre-generation lint
          </p>
          <PromptDiagnosticsPanel diagnostics={preDiagnostics} />
        </section>
      )}

      {batchOutputs && batchOutputs.length > 0 ? (
        <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl shadow-black/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-zinc-200">
              Batch results ({batchOutputs.length})
            </h2>
            {onExportBatch && (
              <button
                type="button"
                onClick={onExportBatch}
                className="inline-flex h-9 items-center rounded-lg border border-zinc-700 px-4 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
              >
                Export batch
              </button>
            )}
            {onQueueBatchComfyUi && (
              <button
                type="button"
                onClick={onQueueBatchComfyUi}
                className="inline-flex h-9 items-center rounded-lg border border-violet-700/60 px-4 text-sm font-medium text-violet-200 transition hover:border-violet-500 hover:bg-violet-500/10"
              >
                Queue batch to ComfyUI
              </button>
            )}
          </div>
          <div className="space-y-3">
            {batchOutputs.map((prompt, index) => (
              <pre
                key={`batch-${index}`}
                className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm leading-relaxed text-emerald-300"
              >
                {prompt}
              </pre>
            ))}
          </div>
        </section>
      ) : (
        <PromptResultPanel {...panelProps} />
      )}

      <PromptDiagnosticsPanel diagnostics={diagnostics ?? null} />

      {(onSaveHistory ||
        onSendComfyUi ||
        onFixPrompt ||
        onCopyPair ||
        onLockSeed ||
        onCompact ||
        onReformat ||
        onRunPipeline ||
        onExportSidecar ||
        onPreviewWorkflow) &&
        panelProps.output && (
        <div className="flex flex-wrap gap-2">
          {onRunPipeline && (
            <button
              type="button"
              onClick={onRunPipeline}
              className="inline-flex h-9 items-center rounded-lg border border-cyan-700/60 px-4 text-sm font-semibold text-cyan-200 transition hover:border-cyan-500 hover:bg-cyan-500/10"
            >
              Prepare for ComfyUI
            </button>
          )}
          {onCompact && (
              <button
                type="button"
                onClick={onCompact}
                className="inline-flex h-9 items-center rounded-lg border border-rose-700/60 px-4 text-sm font-medium text-rose-200 transition hover:border-rose-500 hover:bg-rose-500/10"
              >
                {panelProps.limits &&
                panelProps.output.length > panelProps.limits.maxChars
                  ? "Compact to limit"
                  : "Compact prompt"}
              </button>
            )}
          {onReformat && reformatTargetLabel && (
            <button
              type="button"
              onClick={onReformat}
              className="inline-flex h-9 items-center rounded-lg border border-emerald-700/60 px-4 text-sm font-medium text-emerald-200 transition hover:border-emerald-500 hover:bg-emerald-500/10"
            >
              Reformat for {reformatTargetLabel}
            </button>
          )}
          {onLockSeed && variationSeed && (
            <button
              type="button"
              onClick={onLockSeed}
              className="inline-flex h-9 items-center rounded-lg border border-violet-700/60 px-4 text-sm font-medium text-violet-200 transition hover:border-violet-500 hover:bg-violet-500/10"
            >
              {seedLocked ? "Seed locked" : "Lock variation seed"}
            </button>
          )}
          {onCopyPair && (
            <button
              type="button"
              onClick={onCopyPair}
              className="inline-flex h-9 items-center rounded-lg border border-zinc-700 px-4 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
            >
              {pairCopied ? "Pair copied!" : "Copy prompt pair"}
            </button>
          )}
          {onFixPrompt && (
            <button
              type="button"
              onClick={onFixPrompt}
              className="inline-flex h-9 items-center rounded-lg border border-amber-700/60 px-4 text-sm font-medium text-amber-200 transition hover:border-amber-500 hover:bg-amber-500/10"
            >
              Fix prompt (rules)
            </button>
          )}
          {onSaveHistory && (
            <button
              type="button"
              onClick={onSaveHistory}
              className="inline-flex h-9 items-center rounded-lg border border-zinc-700 px-4 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
            >
              {historySaved ? "Saved to history" : "Save to history"}
            </button>
          )}
          {onPreviewWorkflow && (
            <button
              type="button"
              onClick={onPreviewWorkflow}
              className="inline-flex h-9 items-center rounded-lg border border-cyan-700/60 px-4 text-sm font-medium text-cyan-200 transition hover:border-cyan-500 hover:bg-cyan-500/10"
            >
              Preview workflow
            </button>
          )}
          {onSendComfyUi && (
            <button
              type="button"
              onClick={onSendComfyUi}
              className="inline-flex h-9 items-center rounded-lg border border-violet-700/60 px-4 text-sm font-medium text-violet-200 transition hover:border-violet-500 hover:bg-violet-500/10"
            >
              Send to ComfyUI
            </button>
          )}
          {onExportSidecar && (
            <button
              type="button"
              onClick={onExportSidecar}
              className="inline-flex h-9 items-center rounded-lg border border-zinc-700 px-4 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
            >
              Export sidecar JSON
            </button>
          )}
        </div>
      )}

      {(fixStatus ||
        comfyUiStatus ||
        compactStatus ||
        reformatStatus ||
        pipelineStatus ||
        previewStatus ||
        variationSeed) && (
        <p className="text-xs text-zinc-500">
          {pipelineStatus ||
            previewStatus ||
            fixStatus ||
            compactStatus ||
            reformatStatus ||
            comfyUiStatus}
          {!fixStatus && !comfyUiStatus && variationSeed
            ? `Variation seed: ${variationSeed.length > 120 ? `${variationSeed.slice(0, 120)}…` : variationSeed}`
            : null}
        </p>
      )}

      {workflowPreview && (
        <WorkflowPreviewPanel preview={workflowPreview} />
      )}

      {comfyUiPreviewUrl && (
        <div className="overflow-hidden rounded-xl border border-violet-900/40 bg-zinc-950/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={comfyUiPreviewUrl}
            alt="ComfyUI output preview"
            className="max-h-80 w-full object-contain bg-zinc-900"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
            <span className="text-emerald-400">ComfyUI output ready</span>
            <div className="flex gap-3">
              <a
                href={comfyUiPreviewUrl}
                target="_blank"
                rel="noreferrer"
                className="text-violet-300 hover:text-violet-200"
              >
                Open full size
              </a>
              <a href="/gallery" className="text-zinc-400 hover:text-zinc-200">
                Gallery
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
