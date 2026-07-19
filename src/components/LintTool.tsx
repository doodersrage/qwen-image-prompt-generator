"use client";

import { useCallback, useState } from "react";
import EnhancedPromptResult from "@/components/EnhancedPromptResult";
import { promptResultPreviewProps } from "@/lib/prompt-result-preview-props";
import PromptDiagnosticsPanel from "@/components/PromptDiagnosticsPanel";
import SharedToolControls from "@/components/SharedToolControls";
import SidecarImportButton from "@/components/SidecarImportButton";
import { useCachedSettings } from "@/hooks/useCachedSettings";
import { usePromptResultActions } from "@/hooks/usePromptResultActions";
import { getComfyModelDefinition } from "@/lib/comfy-models";
import { getDetailLimits } from "@/lib/detail-level";
import { getReformatTargetLabel, getReformatTargetModel } from "@/lib/reformat-target";
import { DEFAULT_FORMAT_TOOL_CACHE } from "@/lib/settings-cache";

export default function LintTool() {
  const { mounted, shared, updateShared } = useCachedSettings(
    "format",
    DEFAULT_FORMAT_TOOL_CACHE,
  );
  const [hints, setHints] = useState("");
  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const reformatTarget = getReformatTargetModel(shared.model);
  const actions = usePromptResultActions({
    tool: "lint",
    model: shared.model,
    detail: shared.detail,
    hints,
    autoFixRules: true,
    reformatTarget,
  });

  const selectedModel = getComfyModelDefinition(shared.model);
  const activeLimits = getDetailLimits(shared.detail, shared.model);

  const runLint = useCallback(async () => {
    await actions.lintPrompt(prompt, hints);
  }, [actions, prompt, hints]);

  const copyOutput = useCallback(async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [prompt]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-amber-300">
          Lint playground · {selectedModel.comfyNode}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Prompt Lint & Fix
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
          Paste hints and a finished prompt to run sport/duo/helmet diagnostics,
          apply rule fixes, compact to model limits, or copy a prompt pair — without
          generating a new scene.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl shadow-black/20">
        <SharedToolControls
          shared={shared}
          onModelChange={(model) => updateShared({ model })}
          onDetailChange={(detail) => updateShared({ detail })}
        />

        <div className="space-y-3 border-t border-zinc-800 pt-4">
          <label className="text-sm font-medium text-zinc-200">Hints</label>
          <textarea
            value={hints}
            onChange={(event) => setHints(event.target.value)}
            placeholder="two female gravel cyclists in fierce competition"
            rows={2}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100"
          />
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium text-zinc-200">Prompt</label>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Paste generated or hand-written prompt to lint…"
            rows={8}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-mono text-sm text-emerald-300"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void runLint()}
            disabled={!mounted || !prompt.trim()}
            className="rounded-xl bg-amber-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Run lint
          </button>
          <button
            type="button"
            onClick={() => void actions.fixPrompt(prompt, setPrompt, hints)}
            disabled={!prompt.trim()}
            className="rounded-xl border border-amber-700/60 px-5 py-2 text-sm font-medium text-amber-200 disabled:opacity-50"
          >
            Fix prompt (rules)
          </button>
          <SidecarImportButton
            onImport={(sidecar) => {
              setPrompt(sidecar.positive);
              if (sidecar.hints) {
                setHints(sidecar.hints);
              }
              setImportStatus(
                `Imported sidecar · ${sidecar.tool ?? "unknown tool"} · ${sidecar.model}`,
              );
            }}
            onError={setImportStatus}
          />
        </div>
        {importStatus && <p className="text-xs text-zinc-500">{importStatus}</p>}
      </section>

      <PromptDiagnosticsPanel diagnostics={actions.diagnostics} />

      <EnhancedPromptResult
        output={prompt}
        provider={actions.diagnostics ? "rules" : null}
        comfyNode={selectedModel.comfyNode}
        limits={activeLimits}
        copied={copied}
        onCopy={() => void copyOutput()}
        onFixPrompt={() => void actions.fixPrompt(prompt, setPrompt, hints)}
        onCopyPair={() => void actions.copyPromptPair(prompt, actions.diagnostics?.inferred.sport ?? null)}
        onCompact={() => void actions.compactPrompt(prompt, setPrompt)}
        onReformat={() => void actions.reformatForModel(prompt, setPrompt)}
        reformatTargetLabel={getReformatTargetLabel(shared.model)}
        onRunPipeline={() =>
          void actions.runExportPipeline(prompt, setPrompt, { queueComfyUi: true })
        }
        onExportSidecar={() =>
          void actions.exportSidecar(prompt, { comfyNode: selectedModel.comfyNode })
        }
        onSendComfyUi={() => void actions.sendComfyUi(prompt, actions.diagnostics?.inferred.sport ?? null)}
        {...promptResultPreviewProps(
          actions,
          prompt,
          actions.diagnostics?.inferred.sport ?? null,
        )}
        fixStatus={actions.fixStatus}
        compactStatus={actions.compactStatus}
        reformatStatus={actions.reformatStatus}
        pipelineStatus={actions.pipelineStatus}
        comfyUiStatus={actions.comfyUiStatus}
        comfyUiPreviewUrl={actions.comfyUiPreviewUrl}
        pairCopied={actions.pairCopied}
      />
    </div>
  );
}
