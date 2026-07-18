"use client";

import { useCallback, useState } from "react";
import BackgroundPresetControls from "@/components/BackgroundPresetControls";
import PromptResultPanel from "@/components/PromptResultPanel";
import SharedToolControls from "@/components/SharedToolControls";
import { useCachedSettings } from "@/hooks/useCachedSettings";
import { presetOptionsFromBackgroundCache } from "@/lib/background-options";
import { getComfyModelDefinition } from "@/lib/comfy-models";
import { DEFAULT_BACKGROUND_TOOL_CACHE } from "@/lib/settings-cache";
import type { ToolGenerateResult } from "@/lib/specialized/types";

export default function BackgroundTool() {
  const { mounted, shared, toolSettings, updateShared, updateToolSettings } =
    useCachedSettings("background", DEFAULT_BACKGROUND_TOOL_CACHE);
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
      const response = await fetch("/api/background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: shared.model,
          detail: shared.detail,
          settingType: toolSettings.settingType,
          timeOfDay: toolSettings.timeOfDay,
          mood: toolSettings.mood,
          presetOptions: presetOptionsFromBackgroundCache(toolSettings),
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
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-teal-300">
          Background · {selectedModel.comfyNode}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Background Generator
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
          Generates a detailed environment-only prompt—architecture, landscape,
          weather, materials, and light—with no people or figures. Expand
          optional presets for perspective, depth, lighting, and surface
          textures.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl shadow-black/20">
        <SharedToolControls
          shared={shared}
          onModelChange={(model) => updateShared({ model })}
          onDetailChange={(detail) => updateShared({ detail })}
        />

        <div className="grid gap-3 border-t border-zinc-800 pt-4 sm:grid-cols-3">
          <input
            value={toolSettings.settingType ?? ""}
            onChange={(e) => updateToolSettings({ settingType: e.target.value })}
            placeholder="Setting type (optional)"
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-teal-500"
          />
          <input
            value={toolSettings.timeOfDay ?? ""}
            onChange={(e) => updateToolSettings({ timeOfDay: e.target.value })}
            placeholder="Time / lighting (optional)"
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-teal-500"
          />
          <input
            value={toolSettings.mood ?? ""}
            onChange={(e) => updateToolSettings({ mood: e.target.value })}
            placeholder="Mood (optional)"
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-teal-500"
          />
        </div>

        <BackgroundPresetControls
          mounted={mounted}
          settings={toolSettings}
          onChange={updateToolSettings}
        />

        <button
          type="button"
          onClick={() => void generate()}
          disabled={!mounted || loading}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-teal-600 px-6 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
        >
          {loading ? "Building environment…" : "Generate background prompt"}
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
