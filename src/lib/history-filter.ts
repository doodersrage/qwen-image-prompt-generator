import type { PromptHistoryEntry } from "@/hooks/usePromptHistory";

export type HistoryFilter = {
  tool?: string;
  model?: string;
  favoritesOnly?: boolean;
  minRating?: number;
  query?: string;
  tag?: string;
};

export function filterHistoryEntries(
  entries: PromptHistoryEntry[],
  filter: HistoryFilter,
): PromptHistoryEntry[] {
  return entries.filter((entry) => {
    if (filter.favoritesOnly && !entry.favorite) {
      return false;
    }
    if (filter.tool && filter.tool !== "all" && entry.tool !== filter.tool) {
      return false;
    }
    if (filter.model && filter.model !== "all" && entry.model !== filter.model) {
      return false;
    }
    if (filter.minRating && (entry.rating ?? 0) < filter.minRating) {
      return false;
    }
    if (filter.query?.trim()) {
      const needle = filter.query.trim().toLowerCase();
      const haystack = [
        entry.prompt,
        entry.hints,
        entry.tool,
        entry.model,
        entry.tags?.join(" "),
      ]
        .filter(Boolean)
        .join("\n")
        .toLowerCase();
      if (!haystack.includes(needle)) {
        return false;
      }
    }
    if (filter.tag?.trim()) {
      const needle = filter.tag.trim().toLowerCase();
      if (!(entry.tags ?? []).some((tag) => tag.toLowerCase() === needle)) {
        return false;
      }
    }
    return true;
  });
}

export function uniqueHistoryTools(entries: PromptHistoryEntry[]): string[] {
  return [...new Set(entries.map((entry) => entry.tool))].sort();
}

export function uniqueHistoryTags(entries: PromptHistoryEntry[]): string[] {
  return [...new Set(entries.flatMap((entry) => entry.tags ?? []))].sort();
}

export function uniqueHistoryModels(entries: PromptHistoryEntry[]): string[] {
  return [...new Set(entries.map((entry) => entry.model))].sort();
}
