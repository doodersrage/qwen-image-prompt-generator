import { loadComfyGallery } from "./comfyui-gallery";

const HISTORY_KEY = "comfy-prompt-tool-history-v1";
const AVOIDED_TOKENS_KEY = "comfy-prompt-avoided-tokens-v1";

type HistoryEntry = {
  rating?: number;
  favorite?: boolean;
  prompt?: string;
};

function loadHistoryEntries(): HistoryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

function loadAvoidedTokens(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(AVOIDED_TOKENS_KEY);
    if (!raw) {
      return new Set();
    }
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function recordAvoidedTokensFromPrompt(prompt: string): void {
  if (typeof window === "undefined" || !prompt.trim()) {
    return;
  }
  const tokens = prompt
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3)
    .slice(0, 12);
  const existing = loadAvoidedTokens();
  for (const token of tokens) {
    existing.add(token);
  }
  window.localStorage.setItem(AVOIDED_TOKENS_KEY, JSON.stringify([...existing].slice(-80)));
}

/** Returns -12..+12 adjustment for wildness based on recent feedback signals. */
export function computeRatingDrivenWildnessBias(): number {
  const history = loadHistoryEntries();
  const gallery = loadComfyGallery();

  const rated = history.filter((entry) => typeof entry.rating === "number");
  const lowRated = history.filter((entry) => (entry.rating ?? 5) <= 2).length;
  const highRated = history.filter((entry) => (entry.rating ?? 0) >= 4).length;
  const downvotedGallery = gallery.filter((entry) => (entry.reviewRating ?? 5) <= 2).length;

  const avgRating =
    rated.length > 0
      ? rated.reduce((sum, entry) => sum + (entry.rating ?? 0), 0) / rated.length
      : 3;

  const favoriteHistory = history.filter((entry) => entry.favorite).length;
  const favoriteGallery = gallery.filter((entry) => entry.favorite).length;
  const favoriteRatio =
    (favoriteHistory + favoriteGallery) /
    Math.max(history.length + gallery.length, 1);

  const ratingBias = Math.round((avgRating - 3) * 4);
  const favoriteBias = Math.round((favoriteRatio - 0.15) * 20);
  const downvoteBias = Math.round(-(lowRated + downvotedGallery) * 1.5);
  const upvoteBias = Math.round(highRated * 0.5);

  return Math.max(-12, Math.min(12, ratingBias + favoriteBias + downvoteBias + upvoteBias));
}

export function applyRatingDrivenWildness(baseWildness: number): number {
  const adjusted = baseWildness + computeRatingDrivenWildnessBias();
  return Math.max(0, Math.min(100, adjusted));
}

export function ratingDrivenWildnessLabel(baseWildness: number): string {
  const bias = computeRatingDrivenWildnessBias();
  if (bias === 0) {
    return `Base wildness ${baseWildness}`;
  }
  const sign = bias > 0 ? "+" : "";
  return `Adjusted ${applyRatingDrivenWildness(baseWildness)} (${sign}${bias} from ratings)`;
}
