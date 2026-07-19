"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import SharedToolControls from "@/components/SharedToolControls";
import { useCachedSettings } from "@/hooks/useCachedSettings";
import { useRecentClothing } from "@/hooks/useRecentClothing";
import { useLocationBlocklist } from "@/hooks/useLocationBlocklist";
import { DEFAULT_TOPIC_TOOL_CACHE } from "@/lib/settings-cache";
import type { BatchFromTopicsItem } from "@/lib/batch-from-topics";
import type { TopicGenerateResult } from "@/lib/specialized/types";
import {
  TOPIC_VARIETY_LABEL,
  topicVarietyLabel,
} from "@/lib/tool-ui-labels";
import { resolveComfyUiRuntime } from "@/lib/comfyui-runtime";
import {
  registerComfyGalleryJob,
} from "@/lib/comfyui-gallery-client";
import { scheduleComfyGalleryPoll } from "@/lib/comfyui-gallery-poller";
import {
  ToolBadge,
  ToolBlockGroup,
  ToolContentPanel,
  ToolLayout,
  ToolMetaPanel,
  ToolSection,
  accentButtonClass,
  accentFocusClass,
  accentRingClass,
} from "@/components/ui/ToolPageShell";
import { FieldDivider, FieldError, FieldLabel, TextArea } from "@/components/ui/Field";
import { Button, PrimaryButton } from "@/components/ui/Button";

const ACCENT = "violet" as const;

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
        void scheduleComfyGalleryPoll(result.promptId, {
          comfyUrl: result.comfyUrl ?? data.comfyUrl ?? "http://127.0.0.1:8188",
        });
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
    <ToolLayout
      accent={ACCENT}
      badge={<ToolBadge accent={ACCENT}>Topic ideas</ToolBadge>}
      title="Topic Generator"
      description={
        <>
          Produces a list of image prompt topics—great for batch runs, mood boards,
          or finding a direction. Send any topic to Generate or Duo, or batch-build
          full prompts in one click.
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
        <FieldLabel>Starting theme (optional)</FieldLabel>
        <TextArea
          value={toolSettings.seedTopic ?? ""}
          onChange={(e) => updateToolSettings({ seedTopic: e.target.value })}
          placeholder="e.g. solarpunk, lonely robots, underwater cities — or leave blank"
          rows={2}
          className={accentFocusClass(ACCENT)}
        />

        <FieldDivider />

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
          className={`h-2 w-full ${accentRingClass(ACCENT)}`}
        />

        <FieldDivider />

        <FieldLabel>Topic variety</FieldLabel>
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>Focused</span>
          <span className="font-medium text-violet-300">
            {topicVarietyLabel(toolSettings.variety ?? 50)} (
            {toolSettings.variety ?? 50})
          </span>
          <span>Exploratory</span>
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
          className={`h-2 w-full ${accentRingClass(ACCENT)}`}
        />

        <PrimaryButton
          accentClassName={accentButtonClass(ACCENT)}
          onClick={() => void generate()}
          loading={loading}
          loadingLabel="Generating topics"
        >
          Generate topics
        </PrimaryButton>

        <FieldError>{error}</FieldError>
      </ToolSection>

      {topics.length > 0 && (
        <ToolSection title="Topics">
          <ToolMetaPanel>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              {provider ? (
                <p className="type-caption">
                  {topics.length} ideas via {provider === "llm" ? "LLM" : "template"}
                </p>
              ) : (
                <span />
              )}
              <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
                <select
                  value={batchTarget}
                  onChange={(event) =>
                    updateToolSettings({
                      batchTarget: event.target.value as "generate" | "duo",
                    })
                  }
                  className="ui-input min-h-11 w-full px-3 py-[var(--input-padding-y)] type-body sm:min-w-[15rem] sm:flex-1 lg:w-auto lg:flex-none"
                >
                  <option value="generate">Batch → Generate prompts</option>
                  <option value="duo">Batch → Duo prompts</option>
                </select>
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto"
                  loading={batchLoading}
                  loadingLabel="Building batch prompts"
                  onClick={() => void batchGenerate()}
                >
                  Batch build prompts
                </Button>
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => void copyTopics(topics.join("\n"), "all")}
                >
                  {copiedIndex === "all" ? "Copied!" : "Copy all topics"}
                </Button>
              </div>
            </div>

            {batchStatus && (
              <p className="type-caption text-[var(--tint-success-text)]">{batchStatus}</p>
            )}
            {comfyBatchStatus && (
              <p className="type-caption text-[var(--accent-text)]">{comfyBatchStatus}</p>
            )}
          </ToolMetaPanel>

          <ToolBlockGroup className="mt-[var(--block-gap)]">
            {topics.map((topic, index) => (
              <TopicCard
                key={`${index}-${topic}`}
                index={index}
                topic={topic}
                copied={copiedIndex === index}
                batchPrompt={batchResults[index]?.prompt}
                onCopy={() => void copyTopics(topic, index)}
              />
            ))}
          </ToolBlockGroup>

          {batchResults.length > 0 && (
            <div className="mt-[var(--group-gap)] flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() =>
                  void copyTopics(
                    batchResults.map((entry) => entry.prompt).join("\n\n---\n\n"),
                    "batch",
                  )
                }
              >
                {copiedIndex === "batch" ? "Copied prompts!" : "Copy all prompts"}
              </Button>
              <Button
                variant="accent-outline"
                className="w-full sm:w-auto"
                onClick={() => void queueBatchComfyUi()}
              >
                Queue batch to ComfyUI
              </Button>
            </div>
          )}
        </ToolSection>
      )}
    </ToolLayout>
  );
}

function TopicCard({
  index,
  topic,
  copied,
  batchPrompt,
  onCopy,
}: {
  index: number;
  topic: string;
  copied: boolean;
  batchPrompt?: string;
  onCopy: () => void;
}) {
  return (
    <ToolContentPanel className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="type-overline text-[var(--text-muted)]">
          Topic {String(index + 1).padStart(2, "0")}
        </p>
        <Button variant="ghost" className="!min-h-9 px-3 type-caption" onClick={onCopy}>
          {copied ? "Copied!" : "Copy topic"}
        </Button>
      </div>

      <p className="type-body-lg leading-relaxed text-[var(--text-primary)]">{topic}</p>

      <div className="flex flex-wrap gap-2 border-t border-[var(--border-subtle)] pt-4">
        <Link
          href={`/?input=${encodeURIComponent(topic)}`}
          className="ui-btn-ghost !min-h-9 px-4 type-caption"
        >
          Generate
        </Link>
        <Link
          href={`/duo?hints=${encodeURIComponent(topic)}`}
          className="ui-btn-ghost !min-h-9 px-4 type-caption"
        >
          Duo
        </Link>
        <Link
          href={`/character?hints=${encodeURIComponent(topic)}`}
          className="ui-btn-ghost !min-h-9 px-4 type-caption"
        >
          Character
        </Link>
      </div>

      {batchPrompt ? (
        <pre className="type-code max-h-48 overflow-auto whitespace-pre-wrap rounded-[var(--radius-md)] border border-[var(--tint-success-border)] bg-[var(--tint-success-bg)] p-4 !text-[var(--tint-success-text)]">
          {batchPrompt}
        </pre>
      ) : null}
    </ToolContentPanel>
  );
}
