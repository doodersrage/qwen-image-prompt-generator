"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import SharedToolControls from "@/components/SharedToolControls";
import EnhancedPromptResult from "@/components/EnhancedPromptResult";
import { useCachedSettings } from "@/hooks/useCachedSettings";
import { useRecentClothing } from "@/hooks/useRecentClothing";
import { useLocationBlocklist } from "@/hooks/useLocationBlocklist";
import { DEFAULT_TOPIC_TOOL_CACHE } from "@/lib/settings-cache";
import type { BatchFromTopicsItem } from "@/lib/batch-from-topics";
import type { TopicGenerateResult } from "@/lib/specialized/types";
import { variationStrengthLabel } from "@/lib/variation-settings";
import { resolveComfyUiRuntime } from "@/lib/comfyui-runtime";
import {
  pollComfyGalleryJob,
  registerComfyGalleryJob,
} from "@/lib/comfyui-gallery-client";

export default function TopicTool() {
  const { mounted, shared, toolSettings, updateShared, updateToolSettings } =
    useCachedSettings("topics", DEFAULT_TOPIC_TOOL_CACHE);
  const { getRecent: getRecentClothing } = useRecentClothing();
  const { getBlocklist } = useLocationBlocklist();
  const [topics, setTopics] = useState<string[]>([]);
  const [batchResults, setBatchResults] = useState<BatchFromTopicsItem[]>([]);
  const [provider, setProvider] = useState<TopicGenerateResult["provider"] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<string | null>(null);
  const [comfyBatchStatus, setComfyBatchStatus] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | "all" | "batch" | null>(
    null,
  );

  const batchTarget = toolSettings.batchTarget ?? "generate";

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCopiedIndex(null);
    setBatchResults([]);

    try {
      const response = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seedTopic: toolSettings.seedTopic,
          count: toolSettings.count,
          variety: toolSettings.variety,
          recentLocations: [],
          blockedLocations: getBlocklist(),
        }),
      });

      const data = (await response.json()) as TopicGenerateResult & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Generation failed.");
      }

      setTopics(data.topics);
      setProvider(data.provider);
    } catch (err) {
      setTopics([]);
      setProvider(null);
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }, [toolSettings, getBlocklist]);

  const batchGenerate = useCallback(async () => {
    if (topics.length === 0) {
      return;
    }

    setBatchLoading(true);
    setBatchStatus(null);
    setError(null);

    try {
      const response = await fetch("/api/topics/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics,
          target: batchTarget,
          model: shared.model,
          detail: shared.detail,
          recentClothing: getRecentClothing(),
          alwaysIncludeClothing: shared.alwaysIncludeClothing !== false,
          distinctPeople: true,
          teamKit: batchTarget === "duo",
          lockedWardrobeId: shared.lockedWardrobeId,
          lockedLocation: shared.lockedLocation,
          variationSeed: shared.lockedVariationSeed,
          blockedLocations: getBlocklist(),
        }),
      });

      const data = (await response.json()) as {
        results?: BatchFromTopicsItem[];
        count?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Batch generation failed.");
      }

      setBatchResults(data.results ?? []);
      setBatchStatus(
        `Generated ${data.count ?? data.results?.length ?? 0} prompts via ${batchTarget}.`,
      );
    } catch (err) {
      setBatchResults([]);
      setError(err instanceof Error ? err.message : "Batch generation failed.");
    } finally {
      setBatchLoading(false);
    }
  }, [topics, batchTarget, shared, getRecentClothing, getBlocklist]);

  const queueBatchComfyUi = useCallback(async () => {
    const prompts = batchResults.map((entry) => entry.prompt.trim()).filter(Boolean);
    if (prompts.length === 0) {
      return;
    }

    setComfyBatchStatus("Queueing batch to ComfyUI…");
    try {
      const runtime = resolveComfyUiRuntime();
      const response = await fetch("/api/comfyui", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompts,
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
          tool: "topics",
          model: shared.model,
          comfyUrl: result.comfyUrl ?? data.comfyUrl ?? "http://127.0.0.1:8188",
        });
        void pollComfyGalleryJob(result.promptId);
      }

      setComfyBatchStatus(
        `Queued ${data.queued ?? prompts.length}/${prompts.length} · ${data.comfyUrl ?? ""}`.trim(),
      );
    } catch (err) {
      setComfyBatchStatus(err instanceof Error ? err.message : "ComfyUI batch failed.");
    }
  }, [batchResults, shared.model]);

  const copyTopics = useCallback(async (value: string, index: number | "all" | "batch") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-violet-300">
          Topic ideas
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Topic Generator
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
          Produces a list of image prompt topics—great for batch runs, mood boards,
          or finding a direction. Send any topic to Generate or Duo, or batch-build
          full prompts in one click.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl shadow-black/20">
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

        <div className="space-y-3 border-t border-zinc-800 pt-4">
          <label className="text-sm font-medium text-zinc-200">
            Seed topic (optional)
          </label>
          <textarea
            value={toolSettings.seedTopic ?? ""}
            onChange={(e) => updateToolSettings({ seedTopic: e.target.value })}
            placeholder="e.g. solarpunk, lonely robots, underwater cities — or leave blank"
            rows={2}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-violet-500"
          />
        </div>

        <div className="space-y-3 border-t border-zinc-800 pt-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Fewer topics</span>
            <span className="font-medium text-violet-300">
              {toolSettings.count ?? 10} topics
            </span>
            <span>More</span>
          </div>
          <input
            type="range"
            min={3}
            max={24}
            step={1}
            value={toolSettings.count ?? 10}
            onChange={(e) =>
              updateToolSettings({ count: Number(e.target.value) })
            }
            className="h-2 w-full accent-violet-500"
          />
        </div>

        <div className="space-y-3 border-t border-zinc-800 pt-4">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Focused</span>
            <span className="font-medium text-violet-300">
              {variationStrengthLabel(toolSettings.variety ?? 50)} (
              {toolSettings.variety ?? 50})
            </span>
            <span>Wild</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={toolSettings.variety ?? 50}
            onChange={(e) =>
              updateToolSettings({ variety: Number(e.target.value) })
            }
            className="h-2 w-full accent-violet-500"
          />
        </div>

        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-violet-600 px-6 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {loading ? "Generating topics…" : "Generate topics"}
        </button>

        {error && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </p>
        )}
      </section>

      {topics.length > 0 && (
        <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl shadow-black/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-zinc-200">Topics</h2>
              {provider && (
                <p className="mt-1 text-xs text-zinc-500">
                  {topics.length} ideas via{" "}
                  {provider === "llm" ? "LLM" : "template"}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={batchTarget}
                onChange={(event) =>
                  updateToolSettings({
                    batchTarget: event.target.value as "generate" | "duo",
                  })
                }
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200"
              >
                <option value="generate">Batch → Generate prompts</option>
                <option value="duo">Batch → Duo prompts</option>
              </select>
              <button
                type="button"
                onClick={() => void batchGenerate()}
                disabled={batchLoading}
                className="inline-flex h-9 items-center rounded-lg border border-emerald-700/60 px-4 text-sm font-medium text-emerald-200 hover:border-emerald-500 disabled:opacity-50"
              >
                {batchLoading ? "Building…" : "Batch build prompts"}
              </button>
              <button
                type="button"
                onClick={() => void copyTopics(topics.join("\n"), "all")}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-700 px-4 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
              >
                {copiedIndex === "all" ? "Copied!" : "Copy all topics"}
              </button>
            </div>
          </div>

          {batchStatus && (
            <p className="text-xs text-emerald-400">{batchStatus}</p>
          )}
          {comfyBatchStatus && (
            <p className="text-xs text-violet-400">{comfyBatchStatus}</p>
          )}

          <ol className="space-y-2">
            {topics.map((topic, index) => (
              <li key={`${index}-${topic}`}>
                <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 sm:flex-row sm:items-start">
                  <button
                    type="button"
                    onClick={() => void copyTopics(topic, index)}
                    className="group flex flex-1 items-start gap-3 text-left transition hover:text-zinc-50"
                  >
                    <span className="mt-0.5 shrink-0 font-mono text-xs text-zinc-600 group-hover:text-violet-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm leading-relaxed text-zinc-200">
                      {topic}
                    </span>
                  </button>
                  <div className="flex shrink-0 flex-wrap gap-2 text-[11px]">
                    <Link
                      href={`/?input=${encodeURIComponent(topic)}`}
                      className="rounded border border-zinc-700 px-2 py-1 text-zinc-400 hover:border-violet-500/50 hover:text-violet-300"
                    >
                      Generate
                    </Link>
                    <Link
                      href={`/duo?hints=${encodeURIComponent(topic)}`}
                      className="rounded border border-zinc-700 px-2 py-1 text-zinc-400 hover:border-emerald-500/50 hover:text-emerald-300"
                    >
                      Duo
                    </Link>
                    <Link
                      href={`/character?hints=${encodeURIComponent(topic)}`}
                      className="rounded border border-zinc-700 px-2 py-1 text-zinc-400 hover:border-sky-500/50 hover:text-sky-300"
                    >
                      Character
                    </Link>
                  </div>
                </div>
                {batchResults[index] && (
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 font-mono text-xs text-emerald-300">
                    {batchResults[index]?.prompt}
                  </pre>
                )}
              </li>
            ))}
          </ol>

          {batchResults.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  void copyTopics(
                    batchResults.map((entry) => entry.prompt).join("\n\n---\n\n"),
                    "batch",
                  )
                }
                className="inline-flex h-9 items-center rounded-lg border border-zinc-700 px-4 text-sm font-medium text-zinc-200 hover:border-zinc-500"
              >
                {copiedIndex === "batch" ? "Copied prompts!" : "Copy all prompts"}
              </button>
              <button
                type="button"
                onClick={() => void queueBatchComfyUi()}
                className="inline-flex h-9 items-center rounded-lg border border-violet-700/60 px-4 text-sm font-medium text-violet-200 hover:border-violet-500"
              >
                Queue batch to ComfyUI
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
