import type { PromptHistoryEntry } from "@/hooks/usePromptHistory";

export function buildRegenerateUrl(entry: PromptHistoryEntry): string {
  const path =
    entry.tool === "compose"
      ? "/compose"
      : entry.tool === "duo" || entry.diagnostics?.inferred.duoMode
        ? "/duo"
        : entry.tool === "character"
          ? "/character"
          : "/";

  const params = new URLSearchParams();
  if (entry.hints?.trim()) {
    params.set("hints", entry.hints.trim());
  } else if (entry.tool === "generate") {
    params.set("hints", entry.prompt.slice(0, 500));
  }
  if (entry.model && entry.model !== "n/a") {
    params.set("model", entry.model);
  }
  const seed =
    typeof entry.metadata?.seed === "string" ? entry.metadata.seed.trim() : "";
  if (seed) {
    params.set("seed", seed);
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
