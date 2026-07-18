"use client";

import { useCallback, useState } from "react";
import PromptResultPanel from "@/components/PromptResultPanel";
import SharedToolControls from "@/components/SharedToolControls";
import { useCachedSettings } from "@/hooks/useCachedSettings";
import { getComfyModelDefinition } from "@/lib/comfy-models";
import {
  DEFAULT_RANDOM_SCENE_TOOL_CACHE,
} from "@/lib/settings-cache";
import type { ToolGenerateResult } from "@/lib/specialized/types";
import { variationStrengthLabel } from "@/lib/variation-settings";

export default function RandomSceneTool() {
  const { mounted, shared, toolSettings, updateShared, updateToolSettings } =
    useCachedSettings("randomScene", DEFAULT_RANDOM_SCENE_TOOL_CACHE);
  const [output, setOutput] = useState("");
  const [provider, setProvider] = useState<ToolGenerateResult["provider"] | null>(
    null,
  );
  const [seed, setSeed] = useState<string | null>(null);
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
      const response = await fetch("/api/random-scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: shared.model,
          detail: shared.detail,
          genre: toolSettings.genre,
          includePeople: toolSettings.includePeople,
          wildness: toolSettings.wildness,
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
      setSeed(data.seed ?? null);
      setMeta({ comfyNode: data.comfyNode, limits: data.limits });
    } catch (err) {
      setOutput("");
      setProvider(null);
      setSeed(null);
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
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-amber-300">
          Random scene · {selectedModel.comfyNode}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Random Scene Generator
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
          Rolls random ingredients into a cohesive scene prompt—great for
          inspiration, batch ideation, or breaking out of repetitive keywords.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl shadow-black/20">
        <SharedToolControls
          shared={shared}
          onModelChange={(model) => updateShared({ model })}
          onDetailChange={(detail) => updateShared({ detail })}
        />

        <div className="space-y-3 border-t border-zinc-800 pt-4">
          <label className="text-sm font-medium text-zinc-200">
            Optional genre / theme
          </label>
          <input
            value={toolSettings.genre ?? ""}
            onChange={(e) => updateToolSettings({ genre: e.target.value })}
            placeholder="e.g. solarpunk, noir, cozy horror"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
          <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={toolSettings.includePeople !== false}
              onChange={(e) =>
                updateToolSettings({ includePeople: e.target.checked })
              }
              className="h-4 w-4 rounded border-zinc-600"
            />
            Include people in random ingredients
          </label>
        </div>

        <div className="space-y-3 border-t border-zinc-800 pt-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Safe</span>
            <span className="font-medium text-amber-300">
              {variationStrengthLabel(toolSettings.wildness ?? 65)} (
              {toolSettings.wildness ?? 65})
            </span>
            <span>Wild</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={toolSettings.wildness ?? 65}
            onChange={(e) =>
              updateToolSettings({ wildness: Number(e.target.value) })
            }
            className="h-2 w-full accent-amber-500"
          />
        </div>

        <button
          type="button"
          onClick={() => void generate()}
          disabled={!mounted || loading}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-amber-600 px-6 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
        >
          {loading ? "Rolling scene…" : "Generate random scene"}
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
        extraMeta={seed ? `seed: ${seed}` : undefined}
      />
    </div>
  );
}
