const STORAGE_KEY = "qwen-prompt-recent-clothing";
const MAX_RECENT = 32;

export function loadRecentClothingIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function pushRecentClothingIds(ids: Array<string | null | undefined>): string[] {
  if (typeof window === "undefined") {
    return loadRecentClothingIds();
  }

  const incoming = ids
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  if (incoming.length === 0) {
    return loadRecentClothingIds();
  }

  const next = [...incoming, ...loadRecentClothingIds().filter((id) => !incoming.includes(id))].slice(
    0,
    MAX_RECENT,
  );

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / privacy mode
  }

  return next;
}
