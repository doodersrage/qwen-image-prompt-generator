"use client";

import { useCallback, useEffect, useState } from "react";
import BackgroundPresetControls from "@/components/BackgroundPresetControls";
import CharacterPresetControls from "@/components/CharacterPresetControls";
import EnhancedPromptResult from "@/components/EnhancedPromptResult";
import { promptResultPreviewProps } from "@/lib/prompt-result-preview-props";
import SharedToolControls from "@/components/SharedToolControls";
import { useCachedSettings } from "@/hooks/useCachedSettings";
import { usePromptResultActions } from "@/hooks/usePromptResultActions";
import { useRecentLocations } from "@/hooks/useRecentLocations";
import { useRecentClothing } from "@/hooks/useRecentClothing";
import { useLocationBlocklist } from "@/hooks/useLocationBlocklist";
import { getClothingLabel } from "@/lib/clothing-catalog";
import { presetOptionsFromCache } from "@/lib/character-options";
import { presetOptionsFromBackgroundCache } from "@/lib/background-options";
import { getComfyModelDefinition } from "@/lib/comfy-models";
import { getReformatTargetLabel, getReformatTargetModel } from "@/lib/reformat-target";
import { readSceneLocationFromMetadata } from "@/lib/recent-locations";
import { readClothingIdsFromMetadata } from "@/lib/recent-clothing";
import { DEFAULT_COMPOSE_TOOL_CACHE } from "@/lib/settings-cache";
import type { EnrichedToolGenerateResult } from "@/lib/specialized/types";
import { readVariationSeedFromResult } from "@/lib/variation-seed-metadata";
import { variationStrengthLabel } from "@/lib/variation-settings";

export default function ComposeTool() {
  const { mounted, shared, toolSettings, updateShared, updateToolSettings } =
    useCachedSettings("compose", DEFAULT_COMPOSE_TOOL_CACHE);
  const { getRecent, record: recordLocation } = useRecentLocations();
  const { getRecent: getRecentClothing, record: recordClothing } = useRecentClothing();
  const { getBlocklist } = useLocationBlocklist();
  const [output, setOutput] = useState("");
  const [result, setResult] = useState<EnrichedToolGenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const actions = usePromptResultActions({
    tool: "compose",
    model: shared.model,
    detail: shared.detail,
    hints: toolSettings.hints,
    autoFixRules: shared.autoFixRules !== false,
    reformatTarget: getReformatTargetModel(shared.model),
  });

  const selectedModel = getComfyModelDefinition(shared.model);
  const inferredSport = result?.diagnostics?.inferred.sport ?? null;
  const variationSeed = readVariationSeedFromResult(result ?? {});

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const hints = params.get("hints");
    const seed = params.get("seed");
    if (hints?.trim()) {
      updateToolSettings({ hints: hints.trim() });
    }
    if (seed?.trim()) {
      updateShared({ lockedVariationSeed: seed.trim() });
    }
  }, [updateShared, updateToolSettings]);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    actions.resetStatuses();

    try {
      await actions.runPreLint(toolSettings.hints);

      const response = await fetch("/api/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: shared.model,
          detail: shared.detail,
          subjectMode: toolSettings.subjectMode ?? "duo",
          hints: toolSettings.hints,
          portraitStyle: toolSettings.portraitStyle ?? "action",
          variationStrength: toolSettings.variationStrength,
          presetOptions: presetOptionsFromCache(toolSettings),
          background: {
            settingType: toolSettings.settingType,
            timeOfDay: toolSettings.timeOfDay,
            mood: toolSettings.mood,
            presetOptions: presetOptionsFromBackgroundCache(toolSettings),
          },
          composeStyle: toolSettings.composeStyle ?? "layered",
          recentLocations: getRecent(),
          recentClothing: getRecentClothing(),
          blockedLocations: getBlocklist(),
          lockedWardrobeId: shared.lockedWardrobeId,
          lockedLocation: shared.lockedLocation,
          variationSeed: shared.lockedVariationSeed,
          alwaysIncludeClothing: shared.alwaysIncludeClothing !== false,
          teamKit: toolSettings.teamKit === true,
        }),
      });

      const data = (await response.json()) as EnrichedToolGenerateResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Composition failed.");
      }

      recordLocation(readSceneLocationFromMetadata(data.metadata));
      recordClothing(readClothingIdsFromMetadata(data.metadata));

      const prompt = await actions.finalizePrompt(data.prompt, toolSettings.hints);
      setOutput(prompt);
      setResult({ ...data, prompt });
    } catch (err) {
      setOutput("");
      setResult(null);
      setError(err instanceof Error ? err.message : "Composition failed.");
    } finally {
      setLoading(false);
    }
  }, [
    shared,
    toolSettings,
    getRecent,
    recordLocation,
    getRecentClothing,
    recordClothing,
    getBlocklist,
    actions,
  ]);

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
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-cyan-300">
          Compose · {selectedModel.comfyNode}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Scene Composer
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
          Generates a background and subject prompt, then merges them into one
          scene-ready block—subjects plus environment, lighting, and materials.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl shadow-black/20">
        <SharedToolControls
          shared={shared}
          onModelChange={(model) => updateShared({ model })}
          onDetailChange={(detail) => updateShared({ detail })}
          onWorkflowPresetChange={(id) => updateShared({ selectedWorkflowFileId: id })}
          showWardrobeOption
          alwaysIncludeClothing={shared.alwaysIncludeClothing !== false}
          onAlwaysIncludeClothingChange={(value) =>
            updateShared({ alwaysIncludeClothing: value })
          }
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
          <p className="text-sm font-medium text-zinc-200">Subject mode</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { label: "Solo character", value: "character" },
                { label: "Duo / sport", value: "duo" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateToolSettings({ subjectMode: option.value })}
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                  (toolSettings.subjectMode ?? "duo") === option.value
                    ? "border-cyan-500 bg-cyan-500/15 text-cyan-200"
                    : "border-zinc-700 text-zinc-400"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 border-t border-zinc-800 pt-4 sm:grid-cols-3">
          <input
            value={toolSettings.settingType ?? ""}
            onChange={(e) => updateToolSettings({ settingType: e.target.value })}
            placeholder="Background type (optional)"
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
          <input
            value={toolSettings.timeOfDay ?? ""}
            onChange={(e) => updateToolSettings({ timeOfDay: e.target.value })}
            placeholder="Time / lighting"
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
          <input
            value={toolSettings.mood ?? ""}
            onChange={(e) => updateToolSettings({ mood: e.target.value })}
            placeholder="Mood"
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </div>

        <div className="space-y-3 border-t border-zinc-800 pt-4">
          <label className="text-sm font-medium text-zinc-200">Subject hints</label>
          <textarea
            value={toolSettings.hints ?? ""}
            onChange={(e) => updateToolSettings({ hints: e.target.value })}
            placeholder="two female gravel cyclists in fierce competition"
            rows={3}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100"
          />
        </div>

        <BackgroundPresetControls
          mounted={mounted}
          settings={toolSettings}
          onChange={(patch) =>
            updateToolSettings(patch as Partial<typeof toolSettings>)
          }
        />

        <CharacterPresetControls
          mounted={mounted}
          settings={toolSettings}
          onChange={(patch) =>
            updateToolSettings(patch as Partial<typeof toolSettings>)
          }
        />

        <div className="space-y-3 border-t border-zinc-800 pt-4">
          <p className="text-sm font-medium text-zinc-200">Merge style</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { label: "Layered sections", value: "layered" },
                { label: "Inline prose", value: "inline" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateToolSettings({ composeStyle: option.value })}
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                  (toolSettings.composeStyle ?? "layered") === option.value
                    ? "border-cyan-500 bg-cyan-500/15 text-cyan-200"
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
            <span className="font-medium text-cyan-300">
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
            className="h-2 w-full accent-cyan-500"
          />
        </div>

        <button
          type="button"
          onClick={() => void generate()}
          disabled={!mounted || loading}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-cyan-600 px-6 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          {loading ? "Composing scene…" : "Compose scene prompt"}
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
        diagnostics={actions.diagnostics ?? result?.diagnostics ?? null}
        preDiagnostics={actions.preDiagnostics}
        onSaveHistory={() =>
          actions.saveHistory({
            prompt: output,
            hints: toolSettings.hints,
            metadata: result?.metadata,
          })
        }
        onSendComfyUi={() => void actions.sendComfyUi(output, inferredSport)}
        {...promptResultPreviewProps(actions, output, inferredSport)}
        onFixPrompt={() =>
          void actions.fixPrompt(output, setOutput, toolSettings.hints)
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
