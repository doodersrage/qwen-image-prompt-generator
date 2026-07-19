"use client";

import { useCallback, useState } from "react";
import EnhancedPromptResult from "@/components/EnhancedPromptResult";
import { promptResultPreviewProps } from "@/lib/prompt-result-preview-props";
import SharedToolControls from "@/components/SharedToolControls";
import { useCachedSettings } from "@/hooks/useCachedSettings";
import { usePromptResultActions } from "@/hooks/usePromptResultActions";
import { getComfyModelDefinition } from "@/lib/comfy-models";
import { getReformatTargetLabel, getReformatTargetModel } from "@/lib/reformat-target";
import { DEFAULT_IMAGE_PROMPT_TOOL_CACHE } from "@/lib/settings-cache";
import type { EnrichedToolGenerateResult, ImagePromptFocus, ToolGenerateResult } from "@/lib/specialized/types";

export default function ImagePromptTool() {
  const { mounted, shared, toolSettings, updateShared, updateToolSettings } =
    useCachedSettings("imagePrompt", DEFAULT_IMAGE_PROMPT_TOOL_CACHE);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [output, setOutput] = useState("");
  const [result, setResult] = useState<
    (ToolGenerateResult & { diagnostics?: EnrichedToolGenerateResult["diagnostics"] }) | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [refineIntent, setRefineIntent] = useState("");

  const actions = usePromptResultActions({
    tool: "imagePrompt",
    model: shared.model,
    detail: shared.detail,
    hints: toolSettings.extraHints,
    autoFixRules: shared.autoFixRules !== false,
    reformatTarget: getReformatTargetModel(shared.model),
  });

  const selectedModel = getComfyModelDefinition(shared.model);
  const inferredSport = result?.diagnostics?.inferred.sport ?? null;

  const onFileChange = useCallback((nextFile: File | null) => {
    setFile(nextFile);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : null);
  }, [previewUrl]);

  const generate = useCallback(async () => {
    if (!file) {
      setError("Upload an image first.");
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
      formData.append("focus", toolSettings.focus ?? "full");
      if (toolSettings.extraHints?.trim()) {
        formData.append("extraHints", toolSettings.extraHints.trim());
      }

      const response = await fetch("/api/image-prompt", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as ToolGenerateResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Generation failed.");
      }

      const prompt = await actions.finalizePrompt(data.prompt, toolSettings.extraHints);
      setOutput(prompt);
      setResult({ ...data, prompt });
    } catch (err) {
      setOutput("");
      setResult(null);
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }, [file, shared, toolSettings, actions]);

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

  const refine = useCallback(async () => {
    if (!file || !refineIntent.trim()) {
      setError("Upload an image and describe what you wanted.");
      return;
    }

    setLoading(true);
    setError(null);
    actions.resetStatuses();

    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("model", shared.model);
      formData.append("detail", shared.detail);
      formData.append("currentPrompt", output);
      formData.append("intentHints", refineIntent.trim());

      const response = await fetch("/api/refine", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as EnrichedToolGenerateResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Refine failed.");
      }

      const prompt = await actions.finalizePrompt(data.prompt, refineIntent);
      setOutput(prompt);
      setResult({ ...data, prompt, diagnostics: data.diagnostics ?? actions.diagnostics ?? undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refine failed.");
    } finally {
      setLoading(false);
    }
  }, [file, refineIntent, output, shared, actions]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-fuchsia-300">
          Vision · {selectedModel.comfyNode}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Image → Prompt
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
          Upload a reference image and convert it into a model-ready prompt using
          a vision-capable LLM (`LLM_VISION_MODEL`).
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl shadow-black/20">
        <SharedToolControls
          shared={shared}
          onModelChange={(model) => updateShared({ model })}
          onDetailChange={(detail) => updateShared({ detail })}
          onWorkflowPresetChange={(id) => updateShared({ selectedWorkflowFileId: id })}
          autoFixRules={shared.autoFixRules !== false}
          onAutoFixRulesChange={(value) => updateShared({ autoFixRules: value })}
        />

        <div className="space-y-3 border-t border-zinc-800 pt-4">
          <label className="text-sm font-medium text-zinc-200">Upload image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-fuchsia-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
          />
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Upload preview"
              className="max-h-64 rounded-xl border border-zinc-800 object-contain"
            />
          )}
        </div>

        <div className="space-y-3 border-t border-zinc-800 pt-4">
          <p className="text-sm font-medium text-zinc-200">Describe focus</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { label: "Full image", value: "full" },
                { label: "Subject", value: "subject" },
                { label: "Background", value: "background" },
                { label: "Style", value: "style" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  updateToolSettings({ focus: option.value as ImagePromptFocus })
                }
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                  (toolSettings.focus ?? "full") === option.value
                    ? "border-fuchsia-500 bg-fuchsia-500/15 text-fuchsia-200"
                    : "border-zinc-700 text-zinc-400"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 border-t border-zinc-800 pt-4">
          <label className="text-sm font-medium text-zinc-200">
            Extra notes (optional)
          </label>
          <textarea
            value={toolSettings.extraHints ?? ""}
            onChange={(e) => updateToolSettings({ extraHints: e.target.value })}
            placeholder="e.g. emphasize the lighting, ignore the watermark"
            rows={2}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-fuchsia-500"
          />
        </div>

        <button
          type="button"
          onClick={() => void generate()}
          disabled={!mounted || loading || !file}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-fuchsia-600 px-6 text-sm font-semibold text-white hover:bg-fuchsia-500 disabled:opacity-50"
        >
          {loading ? "Analyzing image…" : "Generate prompt from image"}
        </button>

        {error && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </p>
        )}
      </section>

      {output && (
        <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <h2 className="text-sm font-medium text-zinc-200">Refine against intent</h2>
          <textarea
            rows={2}
            value={refineIntent}
            onChange={(event) => setRefineIntent(event.target.value)}
            placeholder="What you wanted: two gravel cyclists with helmets, not street clothes…"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100"
          />
          <button
            type="button"
            onClick={() => void refine()}
            disabled={loading || !file}
            className="rounded-xl border border-fuchsia-700/60 px-4 py-2 text-sm font-medium text-fuchsia-200 hover:bg-fuchsia-500/10 disabled:opacity-50"
          >
            {loading ? "Refining…" : "Refine prompt from image"}
          </button>
        </section>
      )}

      <EnhancedPromptResult
        output={output}
        provider={result?.provider ?? null}
        comfyNode={result?.comfyNode}
        limits={result?.limits}
        copied={copied}
        onCopy={() => void copyOutput()}
        extraMeta={
          typeof result?.metadata?.qualityWarning === "string"
            ? `shorter than ideal: ${result.metadata.qualityWarning}`
            : undefined
        }
        diagnostics={actions.diagnostics ?? result?.diagnostics ?? null}
        onSaveHistory={() =>
          actions.saveHistory({
            prompt: output,
            hints: toolSettings.extraHints,
            metadata: result?.metadata,
          })
        }
        onSendComfyUi={() => void actions.sendComfyUi(output, inferredSport)}
        {...promptResultPreviewProps(actions, output, inferredSport)}
        onFixPrompt={() =>
          void actions.fixPrompt(output, setOutput, toolSettings.extraHints)
        }
        onCopyPair={() => void actions.copyPromptPair(output, inferredSport)}
        onCompact={() => void actions.compactPrompt(output, setOutput)}
        onReformat={() => void actions.reformatForModel(output, setOutput)}
        reformatTargetLabel={getReformatTargetLabel(shared.model)}
        onRunPipeline={() =>
          void actions.runExportPipeline(output, setOutput, {
            maxChars: result?.limits?.maxChars,
            queueComfyUi: true,
          })
        }
        onExportSidecar={() =>
          void actions.exportSidecar(output, {
            comfyNode: result?.comfyNode ?? selectedModel.comfyNode,
            metadata: result?.metadata,
          })
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
