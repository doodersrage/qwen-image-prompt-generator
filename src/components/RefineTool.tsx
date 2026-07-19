"use client";

import { promptResultPreviewProps } from "@/lib/prompt-result-preview-props";
import { useCallback, useState } from "react";
import EnhancedPromptResult from "@/components/EnhancedPromptResult";
import SharedToolControls from "@/components/SharedToolControls";
import { useCachedSettings } from "@/hooks/useCachedSettings";
import { usePromptResultActions } from "@/hooks/usePromptResultActions";
import { getComfyModelDefinition } from "@/lib/comfy-models";
import { getReformatTargetLabel, getReformatTargetModel } from "@/lib/reformat-target";
import { DEFAULT_IMAGE_PROMPT_TOOL_CACHE } from "@/lib/settings-cache";

export default function RefineTool() {
  const { mounted, shared, toolSettings, updateShared, updateToolSettings } =
    useCachedSettings("imagePrompt", DEFAULT_IMAGE_PROMPT_TOOL_CACHE);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [intentHints, setIntentHints] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const actions = usePromptResultActions({
    tool: "refine",
    model: shared.model,
    detail: shared.detail,
    hints: intentHints,
    autoFixRules: shared.autoFixRules !== false,
    reformatTarget: getReformatTargetModel(shared.model),
  });

  const selectedModel = getComfyModelDefinition(shared.model);

  const onFileChange = useCallback(
    (nextFile: File | null) => {
      setFile(nextFile);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : null);
    },
    [previewUrl],
  );

  const refine = useCallback(async () => {
    if (!file) {
      setError("Upload a reference image first.");
      return;
    }
    if (!intentHints.trim() && !currentPrompt.trim()) {
      setError("Enter intent hints or a current prompt to refine against.");
      return;
    }

    setLoading(true);
    setError(null);
    setCopied(false);
    actions.resetStatuses();

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("model", shared.model);
      formData.append("detail", shared.detail);
      if (currentPrompt.trim()) {
        formData.append("currentPrompt", currentPrompt.trim());
      }
      if (intentHints.trim()) {
        formData.append("intentHints", intentHints.trim());
      }

      const response = await fetch("/api/refine", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as { prompt?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Refine failed.");
      }

      const prompt = await actions.finalizePrompt(
        data.prompt ?? "",
        intentHints.trim() || currentPrompt.trim(),
      );
      setOutput(prompt);
    } catch (err) {
      setOutput("");
      setError(err instanceof Error ? err.message : "Refine failed.");
    } finally {
      setLoading(false);
    }
  }, [file, currentPrompt, intentHints, shared, actions]);

  const copyOutput = useCallback(async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }, [output]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-fuchsia-300">
          Refine · {selectedModel.comfyNode}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Prompt Refine
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
          Upload a reference image and refine an existing prompt (or write one from
          scratch) against your intent — ideal for edit workflows and fixing vision
          captions.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl shadow-black/20">
        <SharedToolControls
          shared={shared}
          onModelChange={(model) => updateShared({ model })}
          onDetailChange={(detail) => updateShared({ detail })}
        />

        <div className="space-y-3 border-t border-zinc-800 pt-4">
          <label className="text-sm font-medium text-zinc-200">Reference image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-fuchsia-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-fuchsia-500"
          />
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Reference preview"
              className="max-h-64 rounded-xl border border-zinc-800 object-contain"
            />
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-200">
            Current prompt (optional)
          </label>
          <textarea
            rows={4}
            value={currentPrompt}
            onChange={(event) => setCurrentPrompt(event.target.value)}
            placeholder="Paste the prompt you want corrected…"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-mono text-sm text-zinc-100"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-200">Intent hints</label>
          <textarea
            rows={3}
            value={intentHints}
            onChange={(event) => setIntentHints(event.target.value)}
            placeholder="What you wanted: gravel cyclists with helmets, muddy doubletrack, no street clothes…"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100"
          />
        </div>

        <button
          type="button"
          onClick={() => void refine()}
          disabled={loading || !file}
          className="inline-flex h-11 items-center rounded-xl bg-fuchsia-600 px-5 text-sm font-semibold text-white hover:bg-fuchsia-500 disabled:opacity-50"
        >
          {loading ? "Refining…" : "Refine prompt"}
        </button>

        {error && (
          <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}
      </section>

      <EnhancedPromptResult
        output={output}
        provider={output ? "llm" : null}
        comfyNode={selectedModel.comfyNode}
        copied={copied}
        onCopy={() => void copyOutput()}
        diagnostics={actions.diagnostics}
        onSaveHistory={() =>
          actions.saveHistory({ prompt: output, hints: intentHints || currentPrompt })
        }
        onSendComfyUi={() => void actions.sendComfyUi(output)}
        {...promptResultPreviewProps(actions, output)}
        onFixPrompt={() => void actions.fixPrompt(output, setOutput, intentHints)}
        onCopyPair={() => void actions.copyPromptPair(output)}
        onCompact={() => void actions.compactPrompt(output, setOutput)}
        onReformat={() => void actions.reformatForModel(output, setOutput)}
        reformatTargetLabel={getReformatTargetLabel(shared.model)}
        onRunPipeline={() =>
          void actions.runExportPipeline(output, setOutput, { queueComfyUi: true })
        }
        onExportSidecar={() =>
          void actions.exportSidecar(output, { comfyNode: selectedModel.comfyNode })
        }
        fixStatus={actions.fixStatus}
        compactStatus={actions.compactStatus}
        reformatStatus={actions.reformatStatus}
        pipelineStatus={actions.pipelineStatus}
        comfyUiStatus={actions.comfyUiStatus}
        comfyUiPreviewUrl={actions.comfyUiPreviewUrl}
        historySaved={actions.historySaved}
        pairCopied={actions.pairCopied}
      />
    </div>
  );
}
