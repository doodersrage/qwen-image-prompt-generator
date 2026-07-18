"use client";

import { useCallback, useState } from "react";
import PromptResultPanel from "@/components/PromptResultPanel";
import SharedToolControls from "@/components/SharedToolControls";
import { useCachedSettings } from "@/hooks/useCachedSettings";
import { getComfyModelDefinition } from "@/lib/comfy-models";
import { DEFAULT_IMAGE_PROMPT_TOOL_CACHE } from "@/lib/settings-cache";
import type { ImagePromptFocus, ToolGenerateResult } from "@/lib/specialized/types";

export default function ImagePromptTool() {
  const { mounted, shared, toolSettings, updateShared, updateToolSettings } =
    useCachedSettings("imagePrompt", DEFAULT_IMAGE_PROMPT_TOOL_CACHE);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [output, setOutput] = useState("");
  const [provider, setProvider] = useState<ToolGenerateResult["provider"] | null>(
    null,
  );
  const [meta, setMeta] = useState<
    Pick<ToolGenerateResult, "comfyNode" | "limits"> & { qualityWarning?: string | null }
  | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedModel = getComfyModelDefinition(shared.model);

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

      setOutput(data.prompt);
      setProvider(data.provider);
      setMeta({
        comfyNode: data.comfyNode,
        limits: data.limits,
        qualityWarning:
          typeof data.metadata?.qualityWarning === "string"
            ? data.metadata.qualityWarning
            : null,
      });
    } catch (err) {
      setOutput("");
      setProvider(null);
      setMeta(null);
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }, [file, shared, toolSettings]);

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

      <PromptResultPanel
        output={output}
        provider={provider}
        comfyNode={meta?.comfyNode}
        limits={meta?.limits}
        copied={copied}
        onCopy={() => void copyOutput()}
        extraMeta={
          meta?.qualityWarning
            ? `shorter than ideal: ${meta.qualityWarning}`
            : undefined
        }
      />
    </div>
  );
}
