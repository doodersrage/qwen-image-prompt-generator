"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DetailLevel } from "@/lib/detail-level";
import { getDetailLimits } from "@/lib/detail-level";
import { DEFAULT_GENERATION_SETTINGS } from "@/lib/generation-settings";
import {
  QWEN_MODELS,
  type QwenImageModel,
} from "@/lib/qwen-model";

type FormatMode = "positive" | "negative";

type FormatResponse = {
  prompt: string;
  mode: FormatMode;
  model: QwenImageModel;
  comfyNode: string;
  provider: "llm" | "rules";
  limits: {
    minChars?: number;
    maxChars: number;
    maxSentences: number;
    maxTokens: number;
  };
  inputChars: number;
  outputChars: number;
};

const EXAMPLE_DRAFTS = [
  "1girl, neon alley, rain, masterpiece, best quality, 8k",
  "keep her face, change background to gothic cathedral with candles and fog",
  "A woman in a red dress standing in a field at sunset",
];

export default function PromptFormatter() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<FormatMode>("positive");
  const [detail, setDetail] = useState<DetailLevel>("balanced");
  const [targetModel, setTargetModel] = useState<QwenImageModel>(
    DEFAULT_GENERATION_SETTINGS.model,
  );
  const [smartFormat, setSmartFormat] = useState(true);
  const [output, setOutput] = useState("");
  const [provider, setProvider] = useState<"llm" | "rules" | null>(null);
  const [resultMeta, setResultMeta] = useState<Omit<
    FormatResponse,
    "prompt" | "provider"
  > | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  const selectedModel = useMemo(
    () =>
      QWEN_MODELS.find((entry) => entry.id === targetModel) ?? QWEN_MODELS[0]!,
    [targetModel],
  );

  const activeLimits = useMemo(
    () => getDetailLimits(detail, targetModel),
    [detail, targetModel],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const submitDisabled = !mounted || loading || !input.trim();

  const runFormat = useCallback(async () => {
    if (!input.trim()) {
      setError("Paste a prompt draft first.");
      return;
    }

    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      const response = await fetch("/api/format", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          mode,
          detail,
          model: targetModel,
          smartFormat,
        }),
      });

      const data = (await response.json()) as FormatResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Formatting failed.");
      }

      setOutput(data.prompt);
      setProvider(data.provider);
      setResultMeta({
        mode: data.mode,
        model: data.model,
        comfyNode: data.comfyNode,
        limits: data.limits,
        inputChars: data.inputChars,
        outputChars: data.outputChars,
      });
    } catch (err) {
      setOutput("");
      setProvider(null);
      setResultMeta(null);
      setError(err instanceof Error ? err.message : "Formatting failed.");
    } finally {
      setLoading(false);
    }
  }, [input, mode, detail, targetModel, smartFormat]);

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
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-emerald-300">
          Prompt formatter
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Format for your model
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
          Paste an existing prompt—tag soup, a rough sentence, or a draft from
          another model. This tool restructures and trims it for{" "}
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-emerald-300">
            {selectedModel.comfyNode}
          </code>
          .
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl shadow-black/20 backdrop-blur">
        <div className="space-y-3">
          <p className="text-sm font-medium text-zinc-200">Target model</p>
          <div className="flex flex-col gap-2">
            {QWEN_MODELS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTargetModel(entry.id)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  targetModel === entry.id
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-zinc-700 hover:border-zinc-500"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`text-sm font-medium ${
                      targetModel === entry.id
                        ? "text-emerald-200"
                        : "text-zinc-200"
                    }`}
                  >
                    {entry.label}
                  </span>
                  <span className="font-mono text-[11px] text-zinc-500">
                    {entry.comfyNode}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                  {entry.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
          <label htmlFor="format-input" className="text-sm font-medium text-zinc-200">
            Prompt draft
          </label>
          <div className="flex rounded-lg border border-zinc-700 p-0.5">
            <button
              type="button"
              onClick={() => setMode("positive")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === "positive"
                  ? "bg-emerald-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Positive
            </button>
            <button
              type="button"
              onClick={() => setMode("negative")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === "negative"
                  ? "bg-rose-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Negative / Preserve
            </button>
          </div>
        </div>

        <textarea
          id="format-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void runFormat();
            }
          }}
          placeholder="Paste your prompt here—tags, rough prose, or a draft from another tool…"
          rows={6}
          className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-base text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
        />

        <div className="flex flex-wrap gap-2">
          {EXAMPLE_DRAFTS.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setInput(example)}
              className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
            >
              {example.length > 48 ? `${example.slice(0, 48)}…` : example}
            </button>
          ))}
        </div>

        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <div>
            <p className="text-sm font-medium text-zinc-200">Detail level</p>
            <p className="mt-1 text-xs text-zinc-500">
              Controls length limits for the formatted output.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { label: "Concise", value: "concise" },
                { label: "Balanced", value: "balanced" },
                { label: "Rich", value: "rich" },
              ] as const
            ).map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setDetail(preset.value)}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  detail === preset.value
                    ? "border-emerald-500 bg-emerald-500/15 text-emerald-200"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500">
            {activeLimits.minChars
              ? `${activeLimits.minSentences}–${activeLimits.maxSentences} sentences, ${activeLimits.minChars}–${activeLimits.maxChars} chars`
              : `Up to ${activeLimits.maxSentences} sentences, ~${activeLimits.maxChars} chars`}
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
          <input
            type="checkbox"
            checked={smartFormat}
            onChange={(e) => setSmartFormat(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-600 focus:ring-emerald-500/30"
          />
          <span>
            <span className="block text-sm font-medium text-zinc-200">
              Smart format (LLM)
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-zinc-500">
              Rewrites your draft for the target model while preserving content.
              Off uses instant rules-only cleanup (tag conversion, trimming, limits).
            </span>
          </span>
        </label>

        <button
          type="button"
          onClick={() => void runFormat()}
          disabled={submitDisabled}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Formatting…" : "Format prompt"}
        </button>

        {error && (
          <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </p>
        )}
      </section>

      {output && (
        <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl shadow-black/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-zinc-200">
                Formatted prompt
              </h2>
              {provider && resultMeta && (
                <p className="mt-1 text-xs text-zinc-500">
                  via {provider === "llm" ? "LLM rewrite" : "rules only"} ·{" "}
                  {resultMeta.inputChars} → {resultMeta.outputChars} chars
                  {resultMeta.limits.minChars
                    ? ` · limit ${resultMeta.limits.minChars}–${resultMeta.limits.maxChars}`
                    : ` · limit ${resultMeta.limits.maxChars}`}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void copyOutput()}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-700 px-4 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
            >
              {copied ? "Copied!" : "Copy for ComfyUI"}
            </button>
          </div>

          <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm leading-relaxed text-emerald-300">
            {output}
          </pre>

          <p className="text-xs text-zinc-500">
            Paste into{" "}
            <code className="rounded bg-zinc-800 px-1 text-emerald-300">
              {resultMeta?.comfyNode ?? selectedModel.comfyNode}
            </code>
            . Press Ctrl+Enter to reformat.
          </p>
        </section>
      )}
    </div>
  );
}
