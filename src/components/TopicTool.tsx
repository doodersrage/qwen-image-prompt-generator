"use client";

import { useCallback, useState } from "react";
import { useCachedSettings } from "@/hooks/useCachedSettings";
import { DEFAULT_TOPIC_TOOL_CACHE } from "@/lib/settings-cache";
import type { TopicGenerateResult } from "@/lib/specialized/types";
import { variationStrengthLabel } from "@/lib/variation-settings";

export default function TopicTool() {
  const { mounted, toolSettings, updateToolSettings } = useCachedSettings(
    "topics",
    DEFAULT_TOPIC_TOOL_CACHE,
  );
  const [topics, setTopics] = useState<string[]>([]);
  const [provider, setProvider] = useState<TopicGenerateResult["provider"] | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | "all" | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCopiedIndex(null);

    try {
      const response = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seedTopic: toolSettings.seedTopic,
          count: toolSettings.count,
          variety: toolSettings.variety,
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
  }, [toolSettings]);

  const copyTopics = useCallback(async (value: string, index: number | "all") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedIndex(index);
      window.setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }, []);

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
          or finding a direction. Leave the seed empty for open-ended variety, or
          enter a theme to get related ideas.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl shadow-black/20">
        <div className="space-y-3">
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
          disabled={!mounted || loading}
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
            <button
              type="button"
              onClick={() => void copyTopics(topics.join("\n"), "all")}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-700 px-4 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
            >
              {copiedIndex === "all" ? "Copied!" : "Copy all"}
            </button>
          </div>

          <ol className="space-y-2">
            {topics.map((topic, index) => (
              <li key={`${index}-${topic}`}>
                <button
                  type="button"
                  onClick={() => void copyTopics(topic, index)}
                  className="group flex w-full items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-left transition hover:border-violet-500/40 hover:bg-zinc-900"
                >
                  <span className="mt-0.5 shrink-0 font-mono text-xs text-zinc-600 group-hover:text-violet-400">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm leading-relaxed text-zinc-200 group-hover:text-zinc-50">
                    {topic}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] text-zinc-600 opacity-0 transition group-hover:opacity-100">
                    {copiedIndex === index ? "Copied" : "Copy"}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
