"use client";

import PromptResultPanel from "@/components/PromptResultPanel";
import PromptDiagnosticsPanel from "@/components/PromptDiagnosticsPanel";
import WorkflowPreviewPanel from "@/components/WorkflowPreviewPanel";
import ComfyWorkflowSelector from "@/components/ComfyWorkflowSelector";
import { useComfyWorkflowSelection } from "@/hooks/useComfyWorkflowSelection";
import {
  ActionButtonBar,
  ToolSection,
} from "@/components/ui/ToolPageShell";
import { Button } from "@/components/ui/Button";
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
  const workflowSelection = useComfyWorkflowSelection();
  const showComfyActions = Boolean(onSendComfyUi || onQueueBatchComfyUi || onPreviewWorkflow);

  if (!panelProps.output && (!batchOutputs || batchOutputs.length === 0)) {
    return null;
  }

  return (
    <div className="space-y-6">
      {preDiagnostics && (
        <section className="space-y-2">
          <p className="type-overline">
            Pre-generation lint
          </p>
          <PromptDiagnosticsPanel diagnostics={preDiagnostics} />
        </section>
      )}

      {batchOutputs && batchOutputs.length > 0 ? (
        <section className="ui-card space-y-4 p-[var(--card-padding)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="type-heading">
              Batch results ({batchOutputs.length})
            </h2>
            {onExportBatch && (
              <Button variant="secondary" onClick={onExportBatch}>
                Export batch
              </Button>
            )}
            {onQueueBatchComfyUi && (
              <Button variant="accent-outline" onClick={onQueueBatchComfyUi}>
                Queue batch to ComfyUI
              </Button>
            )}
          </div>
          {workflowSelection.mounted && (
            <ComfyWorkflowSelector
              compact
              selectedId={workflowSelection.selectedId}
              defaultLabel={workflowSelection.defaultLabel}
              localFiles={workflowSelection.localFiles}
              serverFiles={workflowSelection.serverFiles}
              onChange={workflowSelection.setSelectedId}
            />
          )}
          <div className="space-y-3">
            {batchOutputs.map((prompt, index) => (
              <pre
                key={`batch-${index}`}
                className="type-code overflow-x-auto whitespace-pre-wrap rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-muted)] p-4 !text-[var(--tint-success-text)]"
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
        <ToolSection className="space-y-5">
          {showComfyActions && workflowSelection.mounted && (
            <ComfyWorkflowSelector
              compact
              selectedId={workflowSelection.selectedId}
              defaultLabel={workflowSelection.defaultLabel}
              localFiles={workflowSelection.localFiles}
              serverFiles={workflowSelection.serverFiles}
              onChange={workflowSelection.setSelectedId}
              helpText="Workflow JSON used by Send to ComfyUI and Preview workflow below."
            />
          )}
        <ActionButtonBar>
          {onRunPipeline && (
            <Button variant="info" fullWidth onClick={onRunPipeline} className="font-semibold">
              Prepare for ComfyUI
            </Button>
          )}
          {onCompact && (
            <Button variant="danger" fullWidth onClick={onCompact}>
              {panelProps.limits &&
              panelProps.output.length > panelProps.limits.maxChars
                ? "Compact to limit"
                : "Compact prompt"}
            </Button>
          )}
          {onReformat && reformatTargetLabel && (
            <Button variant="secondary" fullWidth onClick={onReformat}>
              Reformat for {reformatTargetLabel}
            </Button>
          )}
          {onLockSeed && variationSeed && (
            <Button variant="accent-outline" fullWidth onClick={onLockSeed}>
              {seedLocked ? "Seed locked" : "Lock variation seed"}
            </Button>
          )}
          {onCopyPair && (
            <Button variant="secondary" fullWidth onClick={onCopyPair}>
              {pairCopied ? "Pair copied!" : "Copy prompt pair"}
            </Button>
          )}
          {onFixPrompt && (
            <Button variant="secondary" fullWidth onClick={onFixPrompt}>
              Fix prompt (rules)
            </Button>
          )}
          {onSaveHistory && (
            <Button variant="secondary" fullWidth onClick={onSaveHistory}>
              {historySaved ? "Saved to history" : "Save to history"}
            </Button>
          )}
          {onPreviewWorkflow && (
            <Button variant="info" fullWidth onClick={onPreviewWorkflow}>
              Preview workflow
            </Button>
          )}
          {onSendComfyUi && (
            <Button variant="accent-outline" fullWidth onClick={onSendComfyUi}>
              Send to ComfyUI
            </Button>
          )}
          {onExportSidecar && (
            <Button variant="secondary" fullWidth onClick={onExportSidecar}>
              Export sidecar JSON
            </Button>
          )}
        </ActionButtonBar>
        </ToolSection>
      )}

      {(fixStatus ||
        comfyUiStatus ||
        compactStatus ||
        reformatStatus ||
        pipelineStatus ||
        previewStatus ||
        variationSeed) && (
        <p className="type-caption">
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
        <div className="ui-card overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={comfyUiPreviewUrl}
            alt="ComfyUI output preview"
            className="max-h-80 w-full bg-[var(--bg-subtle)] object-contain"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] px-3 py-2">
            <span className="type-caption text-[var(--tint-success-text)]">
              ComfyUI output ready
            </span>
            <div className="flex gap-3">
              <a
                href={comfyUiPreviewUrl}
                target="_blank"
                rel="noreferrer"
                className="type-caption text-[var(--accent-text)] transition hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
              >
                Open full size
              </a>
              <a
                href="/gallery"
                className="type-caption transition hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
              >
                Gallery
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
