"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_GENERATION_SETTINGS } from "@/lib/generation-settings";
import type { DetailLevel } from "@/lib/detail-level";
import { getDetailLimits } from "@/lib/detail-level";
import {
  QWEN_MODELS,
  type QwenImageModel,
} from "@/lib/qwen-model";
import { variationStrengthLabel } from "@/lib/variation-settings";

type PromptMode = "positive" | "negative";

type GenerateResponse = {
  prompt: string;
  mode: PromptMode;
  provider: "llm" | "template";
  model: QwenImageModel;
  comfyNode: string;
  limits: {
    minChars?: number;
    maxChars: number;
    maxSentences: number;
    maxTokens: number;
  };
};

const EXAMPLE_INPUTS = [
  "neon alley, rain, black cat",
  "two women, rooftop bar, city lights",
  "gothic cathedral, candles, fog",
  "cyberpunk city at night",
];

export default function PromptGenerator() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<PromptMode>("positive");
  const [output, setOutput] = useState("");
  const [provider, setProvider] = useState<"llm" | "template" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [variationEnabled, setVariationEnabled] = useState(
    DEFAULT_GENERATION_SETTINGS.variation.enabled,
  );
  const [variationStrength, setVariationStrength] = useState(
    DEFAULT_GENERATION_SETTINGS.variation.strength,
  );
  const [distinctPeople, setDistinctPeople] = useState(
    DEFAULT_GENERATION_SETTINGS.distinctPeople,
  );
  const [detail, setDetail] = useState<DetailLevel>(
    DEFAULT_GENERATION_SETTINGS.detail,
  );
  const [qwenModel, setQwenModel] = useState<QwenImageModel>(
    DEFAULT_GENERATION_SETTINGS.model,
  );
  const [resultMeta, setResultMeta] = useState<Pick<
    GenerateResponse,
    "model" | "comfyNode" | "limits"
  > | null>(null);

  const selectedModel = useMemo(
    () => QWEN_MODELS.find((entry) => entry.id === qwenModel) ?? QWEN_MODELS[0]!,
    [qwenModel],
  );

  const activeLimits = useMemo(
    () => getDetailLimits(detail, qwenModel),
    [detail, qwenModel],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const submitDisabled = !mounted || loading || !input.trim();

  const generate = useCallback(async () => {
    if (!input.trim()) {
      setError("Enter a topic or keywords first.");
      return;
    }

    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input,
          mode,
          variation: {
            enabled: mode === "positive" && variationEnabled,
            strength: variationStrength,
          },
          distinctPeople: mode === "positive" && distinctPeople,
          detail: mode === "positive" ? detail : "balanced",
          model: qwenModel,
        }),
      });

      const data = (await response.json()) as GenerateResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Generation failed.");
      }

      setOutput(data.prompt);
      setProvider(data.provider);
      setResultMeta({
        model: data.model,
        comfyNode: data.comfyNode,
        limits: data.limits,
      });
    } catch (err) {
      setOutput("");
      setProvider(null);
      setResultMeta(null);
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }, [input, mode, variationEnabled, variationStrength, distinctPeople, detail, qwenModel]);

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
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-violet-300">
          ComfyUI · {selectedModel.comfyNode}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Qwen Image Prompt Generator
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
          Enter a topic or keywords. The generator formats natural-language
          prompts for your chosen Qwen model—
          <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-violet-300">
            {selectedModel.comfyNode}
          </code>
          , ready to paste and run.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl shadow-black/20 backdrop-blur">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-zinc-200">Target model</p>
            <p className="mt-1 text-xs text-zinc-500">
              Prompt style and size limits depend on the model and detail level
              you choose.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {QWEN_MODELS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setQwenModel(entry.id)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  qwenModel === entry.id
                    ? "border-violet-500 bg-violet-500/10"
                    : "border-zinc-700 hover:border-zinc-500"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`text-sm font-medium ${
                      qwenModel === entry.id ? "text-violet-200" : "text-zinc-200"
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label htmlFor="edit-input" className="text-sm font-medium text-zinc-200">
            Scene idea or keywords
          </label>
          <div className="flex rounded-lg border border-zinc-700 p-0.5">
            <button
              type="button"
              onClick={() => setMode("positive")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === "positive"
                  ? "bg-violet-600 text-white"
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
          id="edit-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void generate();
            }
          }}
          placeholder={
            mode === "positive"
              ? "e.g. neon alley, rain, black cat — any topic or words to paint into a scene"
              : "e.g. do not change face, skin tone, or pose"
          }
          rows={4}
          className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-base text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
        />

        <div className="flex flex-wrap gap-2">
          {EXAMPLE_INPUTS.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setInput(example)}
              className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
            >
              {example}
            </button>
          ))}
        </div>

        {mode === "positive" && (
          <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-zinc-200">
                  People in scene
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Choose how multiple people (e.g. two men, two women, a pair)
                  are written into the prompt.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDistinctPeople(true)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    distinctPeople
                      ? "border-violet-500 bg-violet-500/15 text-violet-200"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  Distinct individuals
                </button>
                <button
                  type="button"
                  onClick={() => setDistinctPeople(false)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    !distinctPeople
                      ? "border-violet-500 bg-violet-500/15 text-violet-200"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  Grouped / couple
                </button>
              </div>
              <p className="text-xs text-zinc-500">
                {distinctPeople
                  ? "Splits two men / two women into separate left-right descriptions. Gender from your input is enforced."
                  : "Writes pairs as one unified couple or ensemble—not split into separate people."}
              </p>
            </div>

            <div className="border-t border-zinc-800 pt-4">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-zinc-200">
                    Prompt detail
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    More detail adds texture and atmosphere to the same scene.
                    Rich can jumble if your keywords list too many unrelated
                    ideas.
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
                          ? "border-violet-500 bg-violet-500/15 text-violet-200"
                          : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-zinc-500">
                  {detail === "concise" &&
                    `Shortest output for ${selectedModel.label}—up to ${activeLimits.maxSentences} sentences, ~${activeLimits.maxChars} chars.`}
                  {detail === "balanced" &&
                    `Default for ${selectedModel.label}—${activeLimits.minSentences}–${activeLimits.maxSentences} sentences, ~${activeLimits.minChars ?? Math.round(activeLimits.maxChars * 0.65)}–${activeLimits.maxChars} chars.`}
                  {detail === "rich" &&
                    `Most descriptive for ${selectedModel.label}—${activeLimits.minSentences}–${activeLimits.maxSentences} sentences${activeLimits.minChars ? `, at least ${activeLimits.minChars} chars (max ${activeLimits.maxChars})` : `, ~${activeLimits.maxChars} chars`}.`}
                </p>
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-200">
                  Variation seed
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Randomize people, lighting, framing, and palette each run.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2">
                <span className="text-xs text-zinc-400">
                  {variationEnabled ? "On" : "Off"}
                </span>
                <input
                  type="checkbox"
                  checked={variationEnabled}
                  onChange={(e) => setVariationEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-violet-600 focus:ring-violet-500/30"
                />
              </label>
            </div>

            {variationEnabled && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 text-xs text-zinc-400">
                  <span>Subtle</span>
                  <span className="font-medium text-violet-300">
                    {variationStrengthLabel(variationStrength)} ({variationStrength})
                  </span>
                  <span>Wild</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={variationStrength}
                  onChange={(e) =>
                    setVariationStrength(Number(e.target.value))
                  }
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-violet-500"
                  aria-label="Variation seed strength"
                />
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Subtle", value: 20 },
                    { label: "Light", value: 40 },
                    { label: "Balanced", value: 65 },
                    { label: "Wild", value: 95 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setVariationStrength(preset.value)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        variationStrength === preset.value
                          ? "border-violet-500 bg-violet-500/15 text-violet-200"
                          : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => void generate()}
          disabled={submitDisabled}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-violet-600 px-6 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Painting scene…" : "Generate scene prompt"}
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
                Generated scene prompt
              </h2>
              {provider && (
                <p className="mt-1 text-xs text-zinc-500">
                  via {provider === "llm" ? "LLM" : "template fallback"}
                  {resultMeta && (
                    <>
                      {" "}
                      · {resultMeta.limits.minChars ? `${resultMeta.limits.minChars}–` : ""}
                      {resultMeta.limits.maxChars} char limit · {output.length} chars
                    </>
                  )}
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
            <code className="rounded bg-zinc-800 px-1 text-violet-300">
              {resultMeta?.comfyNode ?? selectedModel.comfyNode}
            </code>
            . Press Ctrl+Enter to regenerate.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 text-sm text-zinc-500">
        <h3 className="mb-2 font-medium text-zinc-300">How it works</h3>
        <ul className="list-inside list-disc space-y-1 leading-relaxed">
          <li>
            Pick your{" "}
            <strong className="font-medium text-zinc-400">target model</strong>
            —Edit, Edit-2511, or Image-2.0—each uses different prompt style and
            size limits.
          </li>
          <li>
            <strong className="font-medium text-zinc-400">Edit-2511</strong>{" "}
            favors explicit keep/change instructions and Figure 1 / Figure 2
            references for multi-image workflows.
          </li>
          <li>
            <strong className="font-medium text-zinc-400">FLUX.2 Klein</strong>{" "}
            wants subject-first photographic prose—materials, lighting, camera.
            Negative prompts are ignored; use positive phrasing instead.
          </li>
          <li>
            <strong className="font-medium text-zinc-400">Image-2.0</strong>{" "}
            Rich detail targets at least ~1100 characters (max ~1400).
          </li>
          <li>
            Use <strong className="font-medium text-zinc-400">Concise</strong>{" "}
            if Qwen output still looks jumbled; use{" "}
            <strong className="font-medium text-zinc-400">Rich</strong> when
            scenes feel too thin.
          </li>
          <li>
            Separate ideas with commas, but keep the output focused—Qwen renders
            cleaner with 2–3 short sentences, not dense prose.
          </li>
          <li>
            Use <strong className="font-medium text-zinc-400">Distinct
            individuals</strong> when your input has two or more people—it
            breaks them into separate, fully described characters.
          </li>
          <li>
            Use the variation seed toggle to control randomness—off for
            consistent output, higher strength for more diverse scenes.
          </li>
          <li>
            Add &quot;keep face/pose&quot; if you want the subject preserved while
            the surroundings are repainted in words.
          </li>
        </ul>
      </section>
    </div>
  );
}
