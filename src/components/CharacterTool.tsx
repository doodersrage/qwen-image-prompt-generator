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
import { useLocationBlocklist } from "@/hooks/useLocationBlocklist";
import { getClothingLabel } from "@/lib/clothing-catalog";
import { readSceneLocationFromMetadata } from "@/lib/recent-locations";
import { readClothingIdsFromMetadata } from "@/lib/recent-clothing";
import { getComfyModelDefinition } from "@/lib/comfy-models";
import { getReformatTargetLabel, getReformatTargetModel } from "@/lib/reformat-target";
import { presetOptionsFromCache } from "@/lib/character-options";
import { DEFAULT_CHARACTER_TOOL_CACHE } from "@/lib/settings-cache";
import type { EnrichedToolGenerateResult } from "@/lib/specialized/types";
import { readVariationSeedFromMetadata, readVariationSeedFromResult } from "@/lib/variation-seed-metadata";
import { variationStrengthLabel } from "@/lib/variation-settings";
import { downloadTextFile } from "@/lib/prompt-pair";
import {
  applyShareableSceneParams,
  parseScenePresetFromSearch,
} from "@/lib/scene-preset-url";
import { getSportPreset } from "@/lib/sport-presets";
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

const ACCENT = "sky" as const;
const CHARACTER_BATCH_COUNT = 3;

export default function CharacterTool() {
  const { mounted, shared, toolSettings, updateShared, updateToolSettings } =
    useCachedSettings("character", DEFAULT_CHARACTER_TOOL_CACHE);
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
    tool: "character",
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
      const preset = getSportPreset(applied.sportPresetId);
      if (preset?.hints?.trim()) {
        updateToolSettings({ hints: preset.hints.trim() });
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

        const endpoint = batch ? "/api/batch" : "/api/character";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: shared.model,
            detail: shared.detail,
            hints: toolSettings.hints,
            portraitStyle: toolSettings.portraitStyle,
            variationStrength: toolSettings.variationStrength,
            presetOptions: presetOptionsFromCache(toolSettings),
            recentLocations: getRecent(),
            recentClothing: getRecentClothing(),
            blockedLocations: getBlocklist(),
            lockedWardrobeId: shared.lockedWardrobeId,
            lockedLocation: shared.lockedLocation,
            variationSeed: shared.lockedVariationSeed,
            alwaysIncludeClothing: shared.alwaysIncludeClothing !== false,
            count: batch ? CHARACTER_BATCH_COUNT : undefined,
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

  const exportBatch = useCallback(() => {
    if (batchResults.length === 0) {
      return;
    }

    downloadTextFile(
      `character-batch-${Date.now()}.txt`,
      batchResults
        .map((entry, index) => `# ${index + 1}\n${entry.prompt}`)
        .join("\n\n"),
    );
  }, [batchResults]);

  const batchPrompts = batchResults.map((entry) => entry.prompt);

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
    <ToolLayout
      accent={ACCENT}
      badge={
        <ToolBadge accent={ACCENT}>
          Character · {selectedModel.comfyNode}
        </ToolBadge>
      }
      title="Character Generator"
      description={
        <>
          Builds a detailed single-person prompt—face, hair, clothing, pose, and
          expression. Include sex/gender and age in hints; they are treated as
          mandatory. Add a place with{" "}
          <code className="text-sky-300">in/at/on …</code>, a trailing clause
          after a comma, or <code className="text-sky-300">location: …</code>.
          Expand optional presets below for composition, lighting, and pose
          anchors.
        </>
      }
      sidebar={
        <SharedToolControls
          shared={shared}
          onModelChange={(model) => updateShared({ model })}
          onDetailChange={(detail) => updateShared({ detail })}
          onWorkflowPresetChange={(id) => updateShared({ selectedWorkflowFileId: id })}
          detailHelp="Rich detail recommended for character sheets and portraits."
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
          mode="solo"
          onSelect={(preset) => {
            updateToolSettings({
              hints: preset.hints,
              portraitStyle: preset.portraitStyle ?? "portrait",
            });
          }}
        />

        <FieldDivider />

        <FieldLabel>Character hints (optional)</FieldLabel>
        <TextArea
          value={toolSettings.hints ?? ""}
          onChange={(e) => updateToolSettings({ hints: e.target.value })}
          placeholder="e.g. young woman in her twenties, long dark hair; on a Tokyo rooftop at night"
          rows={3}
          className={accentFocusClass(ACCENT)}
        />

        <CharacterPresetControls
          mounted={mounted}
          settings={toolSettings}
          onChange={updateToolSettings}
        />

        <FieldDivider />

        <FieldLabel>Framing</FieldLabel>
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

        <FieldDivider />

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
          className={`h-2 w-full ${accentRingClass(ACCENT)}`}
        />

        <div className="flex flex-wrap gap-3">
          <PrimaryButton
            accentClassName={accentButtonClass(ACCENT)}
            onClick={() => void generate(false)}
            disabled={!mounted}
            loading={loading}
            loadingLabel="Generating character prompt"
          >
            Generate character prompt
          </PrimaryButton>
          <Button
            variant="secondary"
            disabled={!mounted}
            loading={loading}
            loadingLabel="Rolling character variations"
            onClick={() => void generate(true)}
          >
            Roll {CHARACTER_BATCH_COUNT}
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
        comfyUiStatus={actions.comfyUiStatus}
        comfyUiPreviewUrl={actions.comfyUiPreviewUrl}
        historySaved={actions.historySaved}
        pairCopied={actions.pairCopied}
      />
    </ToolLayout>
  );
}
