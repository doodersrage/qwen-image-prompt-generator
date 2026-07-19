"use client";

import { useCallback, useEffect, useState } from "react";
import CharacterPresetControls from "@/components/CharacterPresetControls";
import EnhancedPromptResult from "@/components/EnhancedPromptResult";
import { promptResultPreviewProps } from "@/lib/prompt-result-preview-props";
import SharedToolControls from "@/components/SharedToolControls";
import SportPresetChips from "@/components/SportPresetChips";
import { useCachedSettings } from "@/hooks/useCachedSettings";
import { usePromptResultActions } from "@/hooks/usePromptResultActions";
import { useRecentLocations } from "@/hooks/useRecentLocations";
import { useRecentClothing } from "@/hooks/useRecentClothing";
import { readSceneLocationFromMetadata } from "@/lib/recent-locations";
import { readClothingIdsFromMetadata } from "@/lib/recent-clothing";
import { getComfyModelDefinition } from "@/lib/comfy-models";
import { getReformatTargetLabel, getReformatTargetModel } from "@/lib/reformat-target";
import { presetOptionsFromCache } from "@/lib/character-options";
import { DEFAULT_DUO_TOOL_CACHE } from "@/lib/settings-cache";
import type { EnrichedToolGenerateResult } from "@/lib/specialized/types";
import { useLocationBlocklist } from "@/hooks/useLocationBlocklist";
import { getClothingLabel } from "@/lib/clothing-catalog";
import { getSportPreset } from "@/lib/sport-presets";
import { downloadTextFile } from "@/lib/prompt-pair";
import { readVariationSeedFromResult } from "@/lib/variation-seed-metadata";
import { variationStrengthLabel } from "@/lib/variation-settings";
import {
  applyShareableSceneParams,
  parseScenePresetFromSearch,
} from "@/lib/scene-preset-url";

const labelClassName = "text-sm font-medium text-zinc-200";

export default function DuoTool() {
  const { mounted, shared, toolSettings, updateShared, updateToolSettings } =
    useCachedSettings("duo", DEFAULT_DUO_TOOL_CACHE);
  const { getRecent, record: recordLocation } = useRecentLocations();
  const { getRecent: getRecentClothing, record: recordClothing } = useRecentClothing();
  const { getBlocklist } = useLocationBlocklist();
  const [output, setOutput] = useState("");
  const [batchOutputs, setBatchOutputs] = useState<string[]>([]);
  const [result, setResult] = useState<EnrichedToolGenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const actions = usePromptResultActions({
    tool: "duo",
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

    const scene = parseScenePresetFromSearch(window.location.search);
    if (!scene) {
      return;
    }

    const applied = applyShareableSceneParams(scene);
    if (applied.hints?.trim()) {
      updateToolSettings({ hints: applied.hints.trim() });
    }
    updateShared({
      lockedWardrobeId: applied.lockedWardrobeId,
      lockedLocation: applied.lockedLocation,
      lockedVariationSeed: applied.lockedVariationSeed,
    });
    if (applied.sportPresetId) {
      updateToolSettings({ sportPresetId: applied.sportPresetId });
      const preset = getSportPreset(applied.sportPresetId);
      if (preset) {
        updateToolSettings({
          sportPresetId: applied.sportPresetId,
          hints: preset.hints,
        });
      }
    }
  }, [updateShared, updateToolSettings]);

  const generate = useCallback(
    async (batch = false) => {
      setLoading(true);
      setError(null);
      setCopied(false);
      actions.resetStatuses();
      setBatchOutputs([]);

      try {
        await actions.runPreLint(toolSettings.hints);

        const endpoint = batch ? "/api/batch" : "/api/duo";
        const presetOptions = {
          ...presetOptionsFromCache(toolSettings),
          headcount: "duo" as const,
        };

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: shared.model,
            detail: shared.detail,
            hints: toolSettings.hints,
            portraitStyle: toolSettings.portraitStyle ?? "action",
            variationStrength: toolSettings.variationStrength,
            presetOptions,
            recentLocations: getRecent(),
            recentClothing: getRecentClothing(),
            blockedLocations: getBlocklist(),
            lockedWardrobeId: shared.lockedWardrobeId,
            lockedLocation: shared.lockedLocation,
            variationSeed: shared.lockedVariationSeed,
            alwaysIncludeClothing: shared.alwaysIncludeClothing !== false,
            teamKit: toolSettings.teamKit === true,
            sportPresetId: toolSettings.sportPresetId || undefined,
            count: batch ? (toolSettings.batchCount ?? 3) : undefined,
          }),
        });

        const data = (await response.json()) as EnrichedToolGenerateResult & {
          error?: string;
          results?: EnrichedToolGenerateResult[];
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Generation failed.");
        }

        if (batch && data.results) {
          for (const entry of data.results) {
            recordLocation(readSceneLocationFromMetadata(entry.metadata));
            recordClothing(readClothingIdsFromMetadata(entry.metadata));
          }
          const prompts = data.results.map((entry) => entry.prompt);
          setBatchOutputs(prompts);
          const firstPrompt = prompts[0] ?? "";
          const finalized = firstPrompt
            ? await actions.finalizePrompt(firstPrompt, toolSettings.hints)
            : "";
          setOutput(finalized || firstPrompt);
          setResult(data.results[0] ?? null);
        } else {
          recordLocation(readSceneLocationFromMetadata(data.metadata));
          recordClothing(readClothingIdsFromMetadata(data.metadata));
          const prompt = await actions.finalizePrompt(data.prompt, toolSettings.hints);
          setOutput(prompt);
          setResult({ ...data, prompt });
        }
      } catch (err) {
        setOutput("");
        setResult(null);
        setBatchOutputs([]);
        setError(err instanceof Error ? err.message : "Generation failed.");
      } finally {
        setLoading(false);
      }
    },
    [shared, toolSettings, getRecent, recordLocation, getRecentClothing, recordClothing, getBlocklist, actions],
  );

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

  const exportBatch = useCallback(() => {
    if (batchOutputs.length === 0) {
      return;
    }

    downloadTextFile(
      `duo-batch-${Date.now()}.txt`,
      batchOutputs.map((prompt, index) => `# ${index + 1}\n${prompt}`).join("\n\n"),
    );
  }, [batchOutputs]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-emerald-300">
          Duo · {selectedModel.comfyNode}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Duo & Sport Generator
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
          Two-person action scenes with sport-aware wardrobe, competition kits,
          helmets, and distinct identities. Use presets for gravel, road, team
          sports, and more.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl shadow-black/20">
        <SharedToolControls
          shared={shared}
          onModelChange={(model) => updateShared({ model })}
          onDetailChange={(detail) => updateShared({ detail })}
          onWorkflowPresetChange={(id) => updateShared({ selectedWorkflowFileId: id })}
          detailHelp="Action mode works best with Rich detail for sport scenes."
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

        <SportPresetChips
          mode="duo"
          selectedId={toolSettings.sportPresetId}
          onSelect={(preset) => {
            updateToolSettings({
              sportPresetId: preset.id,
              hints: preset.hints,
              portraitStyle: preset.portraitStyle ?? "action",
              teamKit: preset.teamKit ?? false,
            });
          }}
        />

        <div className="space-y-2">
          <label className={labelClassName} htmlFor="duo-hints">
            Scene hints
          </label>
          <textarea
            id="duo-hints"
            rows={4}
            value={toolSettings.hints ?? ""}
            onChange={(event) =>
              updateToolSettings({ hints: event.target.value })
            }
            placeholder="two female gravel cyclists in a fierce competition on a muddy doubletrack"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 p-3">
            <input
              type="checkbox"
              checked={toolSettings.teamKit === true}
              onChange={(event) =>
                updateToolSettings({ teamKit: event.target.checked })
              }
              className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-950 accent-emerald-500"
            />
            <span className="space-y-1">
              <span className="text-sm font-medium text-zinc-200">Team kit</span>
              <span className="block text-xs text-zinc-500">
                Identical kits for both athletes. Off = rival accent colors.
              </span>
            </span>
          </label>

          <div className="space-y-2">
            <label className={labelClassName} htmlFor="batch-count">
              Batch count
            </label>
            <input
              id="batch-count"
              type="number"
              min={1}
              max={12}
              value={toolSettings.batchCount ?? 3}
              onChange={(event) =>
                updateToolSettings({
                  batchCount: Math.min(
                    12,
                    Math.max(1, Number(event.target.value) || 3),
                  ),
                })
              }
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-zinc-100"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label className={labelClassName} htmlFor="duo-variation">
              Variation strength
            </label>
            <span className="text-xs text-zinc-500">
              {variationStrengthLabel(toolSettings.variationStrength ?? 50)}
            </span>
          </div>
          <input
            id="duo-variation"
            type="range"
            min={0}
            max={100}
            value={toolSettings.variationStrength ?? 50}
            onChange={(event) =>
              updateToolSettings({
                variationStrength: Number(event.target.value),
              })
            }
            className="w-full accent-emerald-500"
          />
        </div>

        <CharacterPresetControls
          mounted={mounted}
          settings={toolSettings}
          onChange={updateToolSettings}
        />

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => void generate(false)}
            disabled={loading}
            className="inline-flex h-11 items-center rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate duo"}
          </button>
          <button
            type="button"
            onClick={() => void generate(true)}
            disabled={loading}
            className="inline-flex h-11 items-center rounded-xl border border-zinc-700 px-5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
          >
            Roll {toolSettings.batchCount ?? 3}
          </button>
        </div>

        {error && (
          <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
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
        onExportBatch={batchOutputs.length > 1 ? exportBatch : undefined}
        onQueueBatchComfyUi={
          batchOutputs.length > 1
            ? () => void actions.sendBatchComfyUi(batchOutputs, inferredSport)
            : undefined
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
        preDiagnostics={actions.preDiagnostics}
        comfyUiStatus={actions.comfyUiStatus}
        comfyUiPreviewUrl={actions.comfyUiPreviewUrl}
        historySaved={actions.historySaved}
        pairCopied={actions.pairCopied}
        batchOutputs={batchOutputs.length > 1 ? batchOutputs : undefined}
        extraMeta={
          toolSettings.sportPresetId
            ? getSportPreset(toolSettings.sportPresetId)?.label
            : undefined
        }
      />
    </div>
  );
}
