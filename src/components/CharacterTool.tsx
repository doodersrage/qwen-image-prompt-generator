"use client";

import { useCallback, useState } from "react";
import PromptResultPanel from "@/components/PromptResultPanel";
import SharedToolControls from "@/components/SharedToolControls";
import { useCachedSettings } from "@/hooks/useCachedSettings";
import { getComfyModelDefinition } from "@/lib/comfy-models";
import { DEFAULT_CHARACTER_TOOL_CACHE } from "@/lib/settings-cache";
import type { ToolGenerateResult } from "@/lib/specialized/types";
import { variationStrengthLabel } from "@/lib/variation-settings";

export default function CharacterTool() {
  const { mounted, shared, toolSettings, updateShared, updateToolSettings } =
    useCachedSettings("character", DEFAULT_CHARACTER_TOOL_CACHE);
  const [output, setOutput] = useState("");
  const [provider, setProvider] = useState<ToolGenerateResult["provider"] | null>(
    null,
  );
  const [meta, setMeta] = useState<Pick<ToolGenerateResult, "comfyNode" | "limits"> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedModel = getComfyModelDefinition(shared.model);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      const response = await fetch("/api/character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: shared.model,
          detail: shared.detail,
          hints: toolSettings.hints,
          portraitStyle: toolSettings.portraitStyle,
          variationStrength: toolSettings.variationStrength,
        }),
      });

      const data = (await response.json()) as ToolGenerateResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Generation failed.");
      }

      setOutput(data.prompt);
      setProvider(data.provider);
      setMeta({ comfyNode: data.comfyNode, limits: data.limits });
    } catch (err) {
      setOutput("");
      setProvider(null);
      setMeta(null);
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }, [shared, toolSettings]);

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
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-sky-300">
          Character · {selectedModel.comfyNode}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Character Generator
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
          Builds a highly detailed single-person prompt—face, hair, clothing,
          pose, and expression—with no extra people in frame. Include sex/gender
          and age in hints; they are treated as mandatory. Add a place with{" "}
          <code className="text-sky-300">in/at/on …</code>, a trailing clause
          after a comma, or <code className="text-sky-300">location: …</code>.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl shadow-black/20">
        <SharedToolControls
          shared={shared}
          onModelChange={(model) => updateShared({ model })}
          onDetailChange={(detail) => updateShared({ detail })}
          detailHelp="Rich detail recommended for character sheets and portraits."
        />

        <div className="space-y-3 border-t border-zinc-800 pt-4">
          <label className="text-sm font-medium text-zinc-200">
            Character hints (optional)
          </label>
          <textarea
            value={toolSettings.hints ?? ""}
            onChange={(e) => updateToolSettings({ hints: e.target.value })}
            placeholder="e.g. young woman in her twenties, long dark hair; on a Tokyo rooftop at night"
            rows={3}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-sky-500"
          />
        </div>

        <div className="space-y-3 border-t border-zinc-800 pt-4">
          <p className="text-sm font-medium text-zinc-200">Framing</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { label: "Portrait", value: "portrait" },
                { label: "Full body", value: "full-body" },
                { label: "Action", value: "action" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  updateToolSettings({ portraitStyle: option.value })
                }
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                  toolSettings.portraitStyle === option.value
                    ? "border-sky-500 bg-sky-500/15 text-sky-200"
                    : "border-zinc-700 text-zinc-400"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 border-t border-zinc-800 pt-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Stable</span>
            <span className="font-medium text-sky-300">
              {variationStrengthLabel(toolSettings.variationStrength ?? 50)} (
              {toolSettings.variationStrength ?? 50})
            </span>
            <span>Varied</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={toolSettings.variationStrength ?? 50}
            onChange={(e) =>
              updateToolSettings({ variationStrength: Number(e.target.value) })
            }
            className="h-2 w-full accent-sky-500"
          />
        </div>

        <button
          type="button"
          onClick={() => void generate()}
          disabled={!mounted || loading}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-sky-600 px-6 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {loading ? "Building character…" : "Generate character prompt"}
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
      />
    </div>
  );
}
