"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import SharedToolControls from "@/components/SharedToolControls";
import SportPresetChips from "@/components/SportPresetChips";
import { useCachedSettings } from "@/hooks/useCachedSettings";
import { useLocationBlocklist } from "@/hooks/useLocationBlocklist";
import { useRecentClothing } from "@/hooks/useRecentClothing";
import {
  pollComfyGalleryJob,
  registerComfyGalleryJob,
} from "@/lib/comfyui-gallery-client";
import { modelUsesNegativePrompt } from "@/lib/prompt-pair";
import {
  comfyUiSettingsToRuntime,
  loadComfyUiSettings,
} from "@/lib/comfyui-settings";
import { DEFAULT_VARIATIONS_TOOL_CACHE } from "@/lib/settings-cache";
import SidecarImportButton from "@/components/SidecarImportButton";
import { variationStrengthLabel } from "@/lib/variation-settings";
import type { PromptSidecar } from "@/lib/prompt-sidecar";

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
        const negativeResponse = await fetch("/api/negative", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: shared.model }),
        });
        const negativeData = (await negativeResponse.json()) as { prompt?: string };
        negativePrompt = negativeData.prompt;
      }

      const runtime = comfyUiSettingsToRuntime(loadComfyUiSettings());
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
        void pollComfyGalleryJob(result.promptId);
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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-violet-300">
          Variation grid
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Variation Grid
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
          Roll several prompt variations from the same hints, then batch-queue them to
          ComfyUI with unique seeds per job. Track outputs in the{" "}
          <Link href="/gallery" className="text-violet-300 hover:text-violet-200">
            gallery
          </Link>
          .
        </p>
      </header>

      <SharedToolControls
        shared={shared}
        onModelChange={(model) => updateShared({ model })}
        onDetailChange={(detail) => updateShared({ detail })}
        lockedWardrobeId={shared.lockedWardrobeId}
        lockedLocation={shared.lockedLocation}
        lockedVariationSeed={shared.lockedVariationSeed}
        onClearLockedWardrobe={() => updateShared({ lockedWardrobeId: undefined })}
        onClearLockedLocation={() => updateShared({ lockedLocation: undefined })}
        onClearLockedVariationSeed={() =>
          updateShared({ lockedVariationSeed: undefined })
        }
      />

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-zinc-300">
            Generator
            <select
              value={target}
              onChange={(event) =>
                updateToolSettings({
                  target: event.target.value as "generate" | "character" | "duo",
                })
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="generate">Generate (keywords)</option>
              <option value="character">Character</option>
              <option value="duo">Duo</option>
            </select>
          </label>

          <label className="space-y-1 text-sm text-zinc-300">
            Count ({count})
            <input
              type="range"
              min={2}
              max={12}
              value={count}
              onChange={(event) =>
                updateToolSettings({ count: Number(event.target.value) })
              }
              className="w-full accent-violet-500"
            />
          </label>
        </div>

        {(target === "character" || target === "duo") && (
          <label className="space-y-1 text-sm text-zinc-300">
            Portrait style
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
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="portrait">Portrait</option>
              <option value="full-body">Full body</option>
              <option value="action">Action</option>
            </select>
          </label>
        )}

        {target === "duo" && (
          <SportPresetChips
            selectedId={toolSettings.sportPresetId ?? ""}
            mode="duo"
            onSelect={(preset) => updateToolSettings({ sportPresetId: preset.id })}
          />
        )}

        <label className="space-y-1 text-sm text-zinc-300">
          Variation strength ({variationStrengthLabel(toolSettings.variationStrength ?? 65)})
          <input
            type="range"
            min={0}
            max={100}
            value={toolSettings.variationStrength ?? 65}
            onChange={(event) =>
              updateToolSettings({ variationStrength: Number(event.target.value) })
            }
            className="w-full accent-violet-500"
          />
        </label>

        <label className="space-y-1 text-sm text-zinc-300">
          Hints / base input
          <textarea
            value={toolSettings.hints ?? ""}
            onChange={(event) => updateToolSettings({ hints: event.target.value })}
            rows={4}
            placeholder="neon alley, rain, black cat"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void rollGrid()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {loading ? "Rolling…" : `Roll ${count} variations`}
          </button>
          <button
            type="button"
            disabled={queueLoading || results.every((entry) => !entry.prompt)}
            onClick={() => void queueGrid()}
            className="rounded-lg border border-violet-700/60 px-4 py-2 text-sm text-violet-200 hover:border-violet-500 disabled:opacity-50"
          >
            {queueLoading ? "Queueing…" : "Queue grid to ComfyUI"}
          </button>
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
        {error && <p className="text-sm text-rose-300">{error}</p>}
      </section>

      {results.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <h2 className="text-sm font-medium text-zinc-200">Rolled prompts</h2>
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
        </section>
      )}
    </div>
  );
}
