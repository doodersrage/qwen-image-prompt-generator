"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import SharedToolControls from "@/components/SharedToolControls";
import SportPresetChips from "@/components/SportPresetChips";
import { useCachedSettings } from "@/hooks/useCachedSettings";
import { useLocationBlocklist } from "@/hooks/useLocationBlocklist";
import { useRecentClothing } from "@/hooks/useRecentClothing";
import {
  registerComfyGalleryJob,
} from "@/lib/comfyui-gallery-client";
import { scheduleComfyGalleryPoll } from "@/lib/comfyui-gallery-poller";
import { modelUsesNegativePrompt } from "@/lib/prompt-pair";
import { resolveComfyUiRuntime } from "@/lib/comfyui-runtime";
import { DEFAULT_VARIATIONS_TOOL_CACHE } from "@/lib/settings-cache";
import SidecarImportButton from "@/components/SidecarImportButton";
import {
  SHOT_SCALE_LABEL,
  rollVariationLabel,
} from "@/lib/tool-ui-labels";
import type { PromptSidecar } from "@/lib/prompt-sidecar";
import {
  ToolBadge,
  ToolLayout,
  ToolSection,
  accentButtonClass,
  accentFocusClass,
  accentRingClass,
} from "@/components/ui/ToolPageShell";
import { FieldError, FieldLabel, TextArea } from "@/components/ui/Field";
import { Button, PrimaryButton } from "@/components/ui/Button";

const ACCENT = "violet" as const;

type VariationResult = {
  prompt: string;
  seed?: string;
  error?: string;
};

export default function VariationGridTool() {
  const { mounted, shared, toolSettings, updateShared, updateToolSettings } =
    useCachedSettings("variations", DEFAULT_VARIATIONS_TOOL_CACHE);
  const { getRecent: getRecentClothing } = useRecentClothing();
  const { getBlocklist } = useLocationBlocklist();
  const [results, setResults] = useState<VariationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [comfyStatus, setComfyStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const target = toolSettings.target ?? "generate";
  const count = Math.min(12, Math.max(2, toolSettings.count ?? 4));

  const rollGrid = useCallback(async () => {
    const hints = toolSettings.hints?.trim();
    if (!hints) {
      setError("Enter hints or a base prompt first.");
      return;
    }

    setLoading(true);
    setError(null);
    setStatus(null);
    setComfyStatus(null);

    try {
      const next: VariationResult[] = [];

      for (let index = 0; index < count; index += 1) {
        const endpoint =
          target === "character"
            ? "/api/character"
            : target === "duo"
              ? "/api/duo"
              : "/api/generate";

        const body =
          target === "generate"
            ? {
                input: hints,
                mode: "positive" as const,
                model: shared.model,
                detail: shared.detail,
                variation: {
                  enabled: true,
                  strength: toolSettings.variationStrength ?? 65,
                },
                alwaysIncludeClothing: shared.alwaysIncludeClothing !== false,
                recentClothing: getRecentClothing(),
                lockedWardrobeId: shared.lockedWardrobeId,
                lockedLocation: shared.lockedLocation,
              }
            : target === "character"
              ? {
                  hints,
                  model: shared.model,
                  detail: shared.detail,
                  portraitStyle: toolSettings.portraitStyle ?? "action",
                  variationStrength: toolSettings.variationStrength ?? 65,
                  alwaysIncludeClothing: shared.alwaysIncludeClothing !== false,
                  recentClothing: getRecentClothing(),
                  lockedWardrobeId: shared.lockedWardrobeId,
                  lockedLocation: shared.lockedLocation,
                  blockedLocations: getBlocklist(),
                }
              : {
                  hints,
                  model: shared.model,
                  detail: shared.detail,
                  portraitStyle: toolSettings.portraitStyle ?? "action",
                  variationStrength: toolSettings.variationStrength ?? 65,
                  sportPresetId: toolSettings.sportPresetId,
                  teamKit: false,
                  alwaysIncludeClothing: shared.alwaysIncludeClothing !== false,
                  recentClothing: getRecentClothing(),
                  lockedWardrobeId: shared.lockedWardrobeId,
                  lockedLocation: shared.lockedLocation,
                  blockedLocations: getBlocklist(),
                };

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = (await response.json()) as {
          prompt?: string;
          seed?: string;
          metadata?: { seed?: string };
          error?: string;
        };

        if (!response.ok || !data.prompt?.trim()) {
          next.push({
            prompt: "",
            error: data.error ?? `Roll ${index + 1} failed.`,
          });
          continue;
        }

        next.push({
          prompt: data.prompt.trim(),
          seed: data.seed ?? data.metadata?.seed,
        });
      }

      setResults(next);
      const ok = next.filter((entry) => entry.prompt).length;
      setStatus(`Rolled ${ok}/${count} variation prompts via ${target}.`);
    } catch (err) {
      setResults([]);
      setError(err instanceof Error ? err.message : "Variation grid failed.");
    } finally {
      setLoading(false);
    }
  }, [count, getBlocklist, getRecentClothing, shared, target, toolSettings]);

  const queueGrid = useCallback(async () => {
    const prompts = results.map((entry) => entry.prompt.trim()).filter(Boolean);
    if (prompts.length === 0) {
      return;
    }

    setQueueLoading(true);
    setComfyStatus("Queueing variation grid…");

    try {
      let negativePrompt: string | undefined;
      if (modelUsesNegativePrompt(shared.model)) {
        const hints = toolSettings.hints?.trim() ?? "";
        const negativeResponse = await fetch("/api/negative", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: shared.model,
            hints,
            soloSubject: !/\b(?:two|duo|couple|pair|both)\b/i.test(hints),
          }),
        });
        const negativeData = (await negativeResponse.json()) as { prompt?: string };
        negativePrompt = negativeData.prompt;
      }

      const runtime = resolveComfyUiRuntime();
      const response = await fetch("/api/comfyui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompts,
          negativePrompt,
          paramsPerPrompt: prompts.map((_, index) => ({
            seed: String(Math.floor(Math.random() * 2 ** 32) + index),
          })),
          ...(runtime ? { comfy: runtime } : {}),
        }),
      });

      const data = (await response.json()) as {
        queued?: number;
        error?: string;
        comfyUrl?: string;
        results?: Array<{ promptId?: string; comfyUrl?: string }>;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "ComfyUI batch queue failed.");
      }

      for (const [index, result] of (data.results ?? []).entries()) {
        if (!result.promptId) {
          continue;
        }
        registerComfyGalleryJob({
          promptId: result.promptId,
          prompt: prompts[index] ?? "",
          negativePrompt,
          tool: "variations",
          model: shared.model,
          comfyUrl: result.comfyUrl ?? data.comfyUrl ?? "http://127.0.0.1:8188",
        });
        void scheduleComfyGalleryPoll(result.promptId, {
          comfyUrl: result.comfyUrl ?? data.comfyUrl ?? "http://127.0.0.1:8188",
        });
      }

      setComfyStatus(
        `Queued ${data.queued ?? prompts.length}/${prompts.length} · ${data.comfyUrl ?? ""}`.trim(),
      );
    } catch (err) {
      setComfyStatus(err instanceof Error ? err.message : "ComfyUI queue failed.");
    } finally {
      setQueueLoading(false);
    }
  }, [results, shared.model]);

  if (!mounted) {
    return null;
  }

  return (
    <ToolLayout
      accent={ACCENT}
      width="wide"
      badge={<ToolBadge accent={ACCENT}>Variation grid</ToolBadge>}
      title="Variation Grid"
      description={
        <>
          Roll several prompt variations from the same hints, then batch-queue them to
          ComfyUI with unique seeds per job. Track outputs in the{" "}
          <Link href="/gallery" className="text-violet-300 hover:text-violet-200">
            gallery
          </Link>
          .
        </>
      }
      sidebar={
        <SharedToolControls
          shared={shared}
          onModelChange={(model) => updateShared({ model })}
          onDetailChange={(detail) => updateShared({ detail })}
          onWorkflowPresetChange={(id) => updateShared({ selectedWorkflowFileId: id })}
          lockedWardrobeId={shared.lockedWardrobeId}
          lockedLocation={shared.lockedLocation}
          lockedVariationSeed={shared.lockedVariationSeed}
          onClearLockedWardrobe={() => updateShared({ lockedWardrobeId: undefined })}
          onClearLockedLocation={() => updateShared({ lockedLocation: undefined })}
          onClearLockedVariationSeed={() =>
            updateShared({ lockedVariationSeed: undefined })
          }
        />
      }
    >
      <ToolSection>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <FieldLabel>Generator</FieldLabel>
            <select
              value={target}
              onChange={(event) =>
                updateToolSettings({
                  target: event.target.value as "generate" | "character" | "duo",
                })
              }
              className="ui-input w-full px-3 py-2 text-sm"
            >
              <option value="generate">Generate (keywords)</option>
              <option value="character">Character</option>
              <option value="duo">Duo</option>
            </select>
          </div>

          <div className="space-y-1">
            <FieldLabel>Count ({count})</FieldLabel>
            <input
              type="range"
              min={2}
              max={12}
              value={count}
              onChange={(event) =>
                updateToolSettings({ count: Number(event.target.value) })
              }
              className={`w-full ${accentRingClass(ACCENT)}`}
            />
          </div>
        </div>

        {(target === "character" || target === "duo") && (
          <div className="space-y-1">
            <FieldLabel>{SHOT_SCALE_LABEL}</FieldLabel>
            <select
              value={toolSettings.portraitStyle ?? "action"}
              onChange={(event) =>
                updateToolSettings({
                  portraitStyle: event.target.value as
                    | "portrait"
                    | "full-body"
                    | "action",
                })
              }
              className="ui-input w-full px-3 py-2 text-sm"
            >
              <option value="portrait">Portrait</option>
              <option value="full-body">Full body</option>
              <option value="action">Action</option>
            </select>
          </div>
        )}

        {target === "duo" && (
          <SportPresetChips
            selectedId={toolSettings.sportPresetId ?? ""}
            mode="duo"
            onSelect={(preset) => updateToolSettings({ sportPresetId: preset.id })}
          />
        )}

        <div className="space-y-1">
          <FieldLabel>
            Variation strength ({rollVariationLabel(toolSettings.variationStrength ?? 65)})
          </FieldLabel>
          <input
            type="range"
            min={0}
            max={100}
            value={toolSettings.variationStrength ?? 65}
            onChange={(event) =>
              updateToolSettings({ variationStrength: Number(event.target.value) })
            }
            className={`w-full ${accentRingClass(ACCENT)}`}
          />
        </div>

        <FieldLabel>Hints / base input</FieldLabel>
        <TextArea
          value={toolSettings.hints ?? ""}
          onChange={(event) => updateToolSettings({ hints: event.target.value })}
          rows={4}
          placeholder="neon alley, rain, black cat"
          className={accentFocusClass(ACCENT)}
        />

        <div className="flex flex-wrap gap-2">
          <PrimaryButton
            accentClassName={accentButtonClass(ACCENT)}
            loading={loading}
            loadingLabel="Rolling variations"
            onClick={() => void rollGrid()}
          >
            {`Roll ${count} variations`}
          </PrimaryButton>
          <Button
            variant="accent-outline"
            loading={queueLoading}
            loadingLabel="Queueing variations"
            disabled={results.every((entry) => !entry.prompt)}
            onClick={() => void queueGrid()}
          >
            Queue grid to ComfyUI
          </Button>
          <SidecarImportButton
            label="Import sidecar hints"
            className="cursor-pointer rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500"
            onImport={(sidecar: PromptSidecar) => {
              updateToolSettings({
                hints: sidecar.hints?.trim() || sidecar.positive.slice(0, 400),
              });
              if (sidecar.variationSeed) {
                updateShared({ lockedVariationSeed: sidecar.variationSeed });
              }
              setImportStatus(
                `Loaded sidecar · ${sidecar.tool ?? "unknown"} · ${sidecar.model}`,
              );
            }}
            onError={setImportStatus}
          />
        </div>

        {importStatus && <p className="text-sm text-zinc-500">{importStatus}</p>}
        {status && <p className="text-sm text-zinc-500">{status}</p>}
        {comfyStatus && <p className="text-sm text-violet-300/90">{comfyStatus}</p>}
        <FieldError>{error}</FieldError>
      </ToolSection>

      {results.length > 0 && (
        <ToolSection title="Rolled prompts">
          <ol className="space-y-3">
            {results.map((entry, index) => (
              <li
                key={`${index}-${entry.prompt.slice(0, 24)}`}
                className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Variation {index + 1}
                  {entry.seed ? ` · seed ${entry.seed.slice(0, 48)}` : ""}
                </p>
                {entry.error ? (
                  <p className="mt-2 text-sm text-rose-300">{entry.error}</p>
                ) : (
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    {entry.prompt}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </ToolSection>
      )}
    </ToolLayout>
  );
}
