"use client";

import { useCallback, useEffect, useState } from "react";
import type { GenerationDiagnostics } from "@/lib/generation-diagnostics";

export const PROMPT_HISTORY_KEY = "comfy-prompt-tool-history-v1";
export const LOCATION_BLOCKLIST_KEY = "comfy-prompt-location-blocklist-v1";

export type PromptHistoryEntry = {
  id: string;
  tool: string;
  prompt: string;
  hints?: string;
  model: string;
  timestamp: number;
  favorite?: boolean;
  rating?: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
  diagnostics?: GenerationDiagnostics;
  metadata?: Record<string, unknown>;
};

function loadHistory(): PromptHistoryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(PROMPT_HISTORY_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as PromptHistoryEntry[];
  } catch {
    return [];
  }
}

function saveHistory(entries: PromptHistoryEntry[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    PROMPT_HISTORY_KEY,
    JSON.stringify(entries.slice(0, 100)),
  );
}

export function loadLocationBlocklist(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(LOCATION_BLOCKLIST_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function saveLocationBlocklist(entries: string[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    LOCATION_BLOCKLIST_KEY,
    JSON.stringify(entries.slice(0, 200)),
  );
}

export function usePromptHistory() {
  const [entries, setEntries] = useState<PromptHistoryEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setEntries(loadHistory());
    setMounted(true);
  }, []);

  const persist = useCallback((next: PromptHistoryEntry[]) => {
    setEntries(next);
    saveHistory(next);
  }, []);

  const addEntry = useCallback(
    (entry: Omit<PromptHistoryEntry, "id" | "timestamp">) => {
      const next: PromptHistoryEntry = {
        ...entry,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
      };
      persist([next, ...loadHistory()].slice(0, 100));
      return next.id;
    },
    [persist],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      persist(
        loadHistory().map((entry) =>
          entry.id === id ? { ...entry, favorite: !entry.favorite } : entry,
        ),
      );
    },
    [persist],
  );

  const setRating = useCallback(
    (id: string, rating: PromptHistoryEntry["rating"]) => {
      persist(
        loadHistory().map((entry) =>
          entry.id === id ? { ...entry, rating } : entry,
        ),
      );
    },
    [persist],
  );

  const removeEntry = useCallback(
    (id: string) => {
      persist(loadHistory().filter((entry) => entry.id !== id));
    },
    [persist],
  );

  const clearHistory = useCallback(() => {
    persist([]);
  }, [persist]);

  const setTags = useCallback(
    (id: string, tags: string[]) => {
      const normalized = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(
        0,
        12,
      );
      persist(
        loadHistory().map((entry) =>
          entry.id === id ? { ...entry, tags: normalized } : entry,
        ),
      );
    },
    [persist],
  );

  const addTag = useCallback(
    (id: string, tag: string) => {
      const trimmed = tag.trim();
      if (!trimmed) {
        return;
      }
      persist(
        loadHistory().map((entry) => {
          if (entry.id !== id) {
            return entry;
          }
          const tags = [...new Set([...(entry.tags ?? []), trimmed])].slice(0, 12);
          return { ...entry, tags };
        }),
      );
    },
    [persist],
  );

  return {
    mounted,
    entries,
    addEntry,
    toggleFavorite,
    setRating,
    setTags,
    addTag,
    removeEntry,
    clearHistory,
  };
}
