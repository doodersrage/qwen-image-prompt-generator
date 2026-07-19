"use client";

type WorkflowPreviewPanelProps = {
  loading?: boolean;
  error?: string | null;
  preview?: {
    workflowSource?: string;
    replacements?: {
      positive: number;
      negative: number;
      params?: Record<string, number>;
      custom?: Record<string, number>;
    };
    resolvedParams?: {
      seed: string;
      width: string;
      height: string;
      cfg: string;
      steps: string;
    };
    snippets?: Array<{ path: string; value: string }>;
    workflowJson?: string;
    truncated?: boolean;
  } | null;
};

export default function WorkflowPreviewPanel({
  loading,
  error,
  preview,
}: WorkflowPreviewPanelProps) {
  if (loading) {
    return <p className="text-xs text-zinc-500">Building workflow preview…</p>;
  }

  if (error) {
    return <p className="text-xs text-rose-300">{error}</p>;
  }

  if (!preview) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-xl border border-cyan-900/40 bg-zinc-950/50 p-4">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span>
          Source:{" "}
          <span className="text-zinc-300">{preview.workflowSource ?? "unknown"}</span>
        </span>
        {preview.replacements && (
          <span>
            Replacements:{" "}
            <span className="text-zinc-300">
              {preview.replacements.positive} positive
              {preview.replacements.negative > 0
                ? ` · ${preview.replacements.negative} negative`
                : ""}
                {preview.replacements.params &&
                Object.keys(preview.replacements.params).length > 0
                  ? ` · params ${Object.entries(preview.replacements.params)
                      .map(([key, count]) => `${key}:${count}`)
                      .join(", ")}`
                  : ""}
              {preview.replacements.custom &&
              Object.keys(preview.replacements.custom).length > 0
                ? ` · custom ${Object.entries(preview.replacements.custom)
                    .map(([token, count]) => `${token}:${count}`)
                    .join(", ")}`
                : ""}
            </span>
          </span>
        )}
        {preview.resolvedParams && (
          <span>
            Params:{" "}
            <span className="font-mono text-cyan-200/90">
              seed={preview.resolvedParams.seed} · {preview.resolvedParams.width}×
              {preview.resolvedParams.height} · cfg {preview.resolvedParams.cfg} · steps{" "}
              {preview.resolvedParams.steps}
            </span>
          </span>
        )}
      </div>

      {preview.snippets && preview.snippets.length > 0 && (
        <ul className="space-y-1 text-xs">
          {preview.snippets.map((snippet) => (
            <li key={`${snippet.path}-${snippet.value.slice(0, 24)}`}>
              <span className="font-mono text-violet-300">{snippet.path}</span>
              <span className="text-zinc-600"> → </span>
              <span className="font-mono text-emerald-200/90">{snippet.value}</span>
            </li>
          ))}
        </ul>
      )}

      {preview.workflowJson && (
        <pre className="max-h-72 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
          {preview.workflowJson}
          {preview.truncated ? "\n… (truncated)" : ""}
        </pre>
      )}
    </div>
  );
}
