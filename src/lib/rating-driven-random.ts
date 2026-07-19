import { loadComfyGallery } from "./comfyui-gallery";

const HISTORY_KEY = "comfy-prompt-tool-history-v1";

type HistoryEntry = {
  rating?: number;
  favorite?: boolean;
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

/** Returns -12..+12 adjustment for wildness based on recent feedback signals. */
export function computeRatingDrivenWildnessBias(): number {
  const history = loadHistoryEntries();
  const gallery = loadComfyGallery();

  const rated = history.filter((entry) => typeof entry.rating === "number");
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

  return Math.max(-12, Math.min(12, ratingBias + favoriteBias));
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
