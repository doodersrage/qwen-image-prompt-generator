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
import { readVariationSeedFromMetadata, readVariationSeedFromResult } from "@/lib/variation-seed-metadata";
import { variationStrengthLabel } from "@/lib/variation-settings";
import {
  applyShareableSceneParams,
  parseScenePresetFromSearch,
} from "@/lib/scene-preset-url";
import {
  ToolBadge,
  ToolLayout,
  ToolSection,
  accentButtonClass,
  accentFocusClass,
  accentRingClass,
} from "@/components/ui/ToolPageShell";
import { FieldDivider, FieldError, FieldLabel, TextArea } from "@/components/ui/Field";
import { Button, PrimaryButton } from "@/components/ui/Button";

const ACCENT = "emerald" as const;

export default function DuoTool() {
  const { mounted, shared, toolSettings, updateShared, updateToolSettings } =
    useCachedSettings("duo", DEFAULT_DUO_TOOL_CACHE);
  const { getRecent, record: recordLocation } = useRecentLocations();
  const { getRecent: getRecentClothing, record: recordClothing } = useRecentClothing();
  const { getBlocklist } = useLocationBlocklist();
  const [output, setOutput] = useState("");
  const [batchResults, setBatchResults] = useState<EnrichedToolGenerateResult[]>([]);
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
      setBatchResults([]);

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
          setBatchResults(data.results);
          const firstPrompt = data.results[0]?.prompt ?? "";
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
          setBatchResults([]);
        }
      } catch (err) {
        setOutput("");
        setResult(null);
        setBatchResults([]);
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
    if (batchResults.length === 0) {
      return;
    }

    downloadTextFile(
      `duo-batch-${Date.now()}.txt`,
      batchResults
        .map((entry, index) => `# ${index + 1}\n${entry.prompt}`)
        .join("\n\n"),
    );
  }, [batchResults]);

  const batchPrompts = batchResults.map((entry) => entry.prompt);

  if (!mounted) {
    return null;
  }

  return (
    <ToolLayout
      accent={ACCENT}
      badge={
        <ToolBadge accent={ACCENT}>
          Duo · {selectedModel.comfyNode}
        </ToolBadge>
      }
      title="Duo & Sport Generator"
      description={
        <>
          Two-person action scenes with sport-aware wardrobe, competition kits,
          helmets, and distinct identities. Use presets for gravel, road, team
          sports, and more.
        </>
      }
      sidebar={
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
      }
    >
      <ToolSection>
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

        <FieldLabel htmlFor="duo-hints">Scene hints</FieldLabel>
        <TextArea
          id="duo-hints"
          rows={4}
          value={toolSettings.hints ?? ""}
          onChange={(event) =>
            updateToolSettings({ hints: event.target.value })
          }
          placeholder="two female gravel cyclists in a fierce competition on a muddy doubletrack"
          className={accentFocusClass(ACCENT)}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 p-3">
            <input
              type="checkbox"
              checked={toolSettings.teamKit === true}
              onChange={(event) =>
                updateToolSettings({ teamKit: event.target.checked })
              }
              className={`mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-950 ${accentRingClass(ACCENT)}`}
            />
            <span className="space-y-1">
              <span className="text-sm font-medium text-zinc-200">Team kit</span>
              <span className="block text-xs text-zinc-500">
                Identical kits for both athletes. Off = rival accent colors.
              </span>
            </span>
          </label>

          <div className="space-y-2">
            <FieldLabel htmlFor="batch-count">Batch count</FieldLabel>
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
              className="ui-input w-full px-4 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <FieldLabel htmlFor="duo-variation">Variation strength</FieldLabel>
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
            className={`w-full ${accentRingClass(ACCENT)}`}
          />
        </div>

        <CharacterPresetControls
          mounted={mounted}
          settings={toolSettings}
          onChange={updateToolSettings}
        />

        <div className="flex flex-wrap gap-3">
          <PrimaryButton
            accentClassName={accentButtonClass(ACCENT)}
            onClick={() => void generate(false)}
            loading={loading}
            loadingLabel="Generating duo prompt"
          >
            Generate duo
          </PrimaryButton>
          <Button
            variant="secondary"
            loading={loading}
            loadingLabel="Rolling duo batch"
            onClick={() => void generate(true)}
          >
            Roll {toolSettings.batchCount ?? 3}
          </Button>
        </div>

        <FieldError>{error}</FieldError>
      </ToolSection>

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
        onExportBatch={batchResults.length > 1 ? exportBatch : undefined}
        onQueueBatchComfyUi={
          batchResults.length > 1
            ? () => void actions.sendBatchComfyUi(batchPrompts, inferredSport)
            : undefined
        }
        batchItems={
          batchResults.length > 1
            ? batchResults.map((entry) => ({
                prompt: entry.prompt,
                metadata: entry.metadata,
              }))
            : undefined
        }
        batchCrossLinks={{
          hintsForDuo: toolSettings.hints,
          hintsForCharacter: toolSettings.hints,
        }}
        batchPromptActions={{
          onQueueComfyUi: (prompt) => void actions.sendComfyUi(prompt, inferredSport),
          onSaveHistory: ({ prompt, metadata }) =>
            actions.saveHistory({
              prompt,
              hints: toolSettings.hints,
              metadata,
            }),
          onCopyPair: (prompt) => void actions.copyPromptPair(prompt, inferredSport),
          onExportSidecar: (prompt, _index, metadata) =>
            void actions.exportSidecar(prompt, {
              comfyNode: result?.comfyNode ?? selectedModel.comfyNode,
              metadata,
              variationSeed:
                readVariationSeedFromMetadata(metadata) ?? shared.lockedVariationSeed,
            }),
        }}
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
        comfyUiJob={actions.comfyUiJob}
        comfyUiPreviewUrl={actions.comfyUiPreviewUrl}
        historySaved={actions.historySaved}
        pairCopied={actions.pairCopied}
        extraMeta={
          toolSettings.sportPresetId
            ? getSportPreset(toolSettings.sportPresetId)?.label
            : undefined
        }
      />
    </ToolLayout>
  );
}
