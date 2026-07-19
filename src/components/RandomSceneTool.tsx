"use client";

import { promptResultPreviewProps } from "@/lib/prompt-result-preview-props";
import { useCallback, useEffect, useState } from "react";
import EnhancedPromptResult from "@/components/EnhancedPromptResult";
import SharedToolControls from "@/components/SharedToolControls";
import { useCachedSettings } from "@/hooks/useCachedSettings";
import { usePromptResultActions } from "@/hooks/usePromptResultActions";
import { useRecentLocations } from "@/hooks/useRecentLocations";
import { useRecentClothing } from "@/hooks/useRecentClothing";
import { useLocationBlocklist } from "@/hooks/useLocationBlocklist";
import { getClothingLabel } from "@/lib/clothing-catalog";
import { readSceneLocationFromMetadata } from "@/lib/recent-locations";
import { readClothingIdsFromMetadata } from "@/lib/recent-clothing";
import { getComfyModelDefinition } from "@/lib/comfy-models";
import { getReformatTargetLabel, getReformatTargetModel } from "@/lib/reformat-target";
import { DEFAULT_RANDOM_SCENE_TOOL_CACHE } from "@/lib/settings-cache";
import type { EnrichedToolGenerateResult } from "@/lib/specialized/types";
import { readVariationSeedFromResult } from "@/lib/variation-seed-metadata";
import { variationStrengthLabel } from "@/lib/variation-settings";

export default function RandomSceneTool() {
  const { mounted, shared, toolSettings, updateShared, updateToolSettings } =
    useCachedSettings("randomScene", DEFAULT_RANDOM_SCENE_TOOL_CACHE);
  const { getRecent, record } = useRecentLocations();
  const { getRecent: getRecentClothing, record: recordClothing } = useRecentClothing();
  const { getBlocklist } = useLocationBlocklist();
  const [output, setOutput] = useState("");
  const [result, setResult] = useState<EnrichedToolGenerateResult | null>(null);
  const [seed, setSeed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const actions = usePromptResultActions({
    tool: "randomScene",
    model: shared.model,
    detail: shared.detail,
    hints: toolSettings.genre,
    autoFixRules: shared.autoFixRules !== false,
    reformatTarget: getReformatTargetModel(shared.model),
  });

  const selectedModel = getComfyModelDefinition(shared.model);
  const variationSeed = readVariationSeedFromResult({ seed: result?.seed ?? undefined, metadata: result?.metadata });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const seed = new URLSearchParams(window.location.search).get("seed");
    if (seed?.trim()) {
      updateShared({ lockedVariationSeed: seed.trim() });
    }
  }, [updateShared]);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    actions.resetStatuses();

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
          recentLocations: getRecent(),
          recentClothing: getRecentClothing(),
          blockedLocations: getBlocklist(),
          lockedWardrobeId: shared.lockedWardrobeId,
          lockedLocation: shared.lockedLocation,
          variationSeed: shared.lockedVariationSeed,
          alwaysIncludeClothing: shared.alwaysIncludeClothing !== false,
        }),
      });

      const data = (await response.json()) as EnrichedToolGenerateResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Generation failed.");
      }

      record(readSceneLocationFromMetadata(data.metadata));
      recordClothing(readClothingIdsFromMetadata(data.metadata));

      const prompt = await actions.finalizePrompt(data.prompt, toolSettings.genre);
      setOutput(prompt);
      setResult({ ...data, prompt });
      setSeed(data.seed ?? null);
    } catch (err) {
      setOutput("");
      setResult(null);
      setSeed(null);
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }, [shared, toolSettings, getRecent, record, getRecentClothing, recordClothing, getBlocklist, actions]);

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
          onWorkflowPresetChange={(id) => updateShared({ selectedWorkflowFileId: id })}
          showWardrobeOption={toolSettings.includePeople !== false}
          alwaysIncludeClothing={shared.alwaysIncludeClothing !== false}
          onAlwaysIncludeClothingChange={(value) =>
            updateShared({ alwaysIncludeClothing: value })
          }
          wardrobeHelp="When random ingredients include people, rolls catalog outfits and appends assigned clothing if the model omits it. Shared with Generate and Character."
          lockedWardrobeId={shared.lockedWardrobeId}
          lockedWardrobeLabel={
            shared.lockedWardrobeId
              ? getClothingLabel(shared.lockedWardrobeId) ?? shared.lockedWardrobeId
              : undefined
          }
          onClearLockedWardrobe={() => updateShared({ lockedWardrobeId: undefined })}
          lockedLocation={shared.lockedLocation}
          onClearLockedLocation={() => updateShared({ lockedLocation: undefined })}
          lockedVariationSeed={shared.lockedVariationSeed}
          onClearLockedVariationSeed={() =>
            updateShared({ lockedVariationSeed: undefined })
          }
          autoFixRules={shared.autoFixRules !== false}
          onAutoFixRulesChange={(value) => updateShared({ autoFixRules: value })}
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

      <EnhancedPromptResult
        output={output}
        provider={result?.provider ?? null}
        comfyNode={result?.comfyNode}
        limits={result?.limits}
        copied={copied}
        onCopy={() => void copyOutput()}
        extraMeta={seed ? `seed: ${seed}` : undefined}
        diagnostics={actions.diagnostics ?? result?.diagnostics ?? null}
        onSaveHistory={() =>
          actions.saveHistory({
            prompt: output,
            hints: toolSettings.genre,
            metadata: result?.metadata,
          })
        }
        onSendComfyUi={() => void actions.sendComfyUi(output)}
        {...promptResultPreviewProps(actions, output)}
        onFixPrompt={() =>
          void actions.fixPrompt(output, setOutput, toolSettings.genre)
        }
        onCopyPair={() => void actions.copyPromptPair(output)}
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
            variationSeed: variationSeed ?? shared.lockedVariationSeed,
            metadata: result?.metadata,
          })
        }
        onLockSeed={() => {
          if (variationSeed) {
            updateShared({ lockedVariationSeed: variationSeed });
          }
        }}
        variationSeed={variationSeed}
        seedLocked={
          Boolean(
            variationSeed &&
              shared.lockedVariationSeed?.trim() === variationSeed.trim(),
          )
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
