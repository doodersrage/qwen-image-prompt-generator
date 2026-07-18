import { ALL_CLOTHING_CATALOG_ENTRIES } from "./clothing-catalog-batches";
import {
  clothingMatchesGender,
  inferClothingContexts,
  inferClothingGender,
  normalizeClothingContextTags,
  scoreClothingContextMatch,
  type ClothingContextTag,
  type ClothingGenderTag,
  type ClothingPickFilters,
} from "./clothing-tags";

export type ClothingCategory =
  | "outfit"
  | "top"
  | "bottom"
  | "outerwear"
  | "footwear"
  | "accessory";

export type ClothingCatalogEntry = {
  id: string;
  label: string;
  category: ClothingCategory;
  script: string;
  gender?: ClothingGenderTag;
  contexts?: readonly ClothingContextTag[];
};

export type EnrichedClothingEntry = ClothingCatalogEntry & {
  gender: ClothingGenderTag;
  contexts: ClothingContextTag[];
};

const CATALOG: EnrichedClothingEntry[] = (
  ALL_CLOTHING_CATALOG_ENTRIES as ClothingCatalogEntry[]
).map(enrichEntry);

const BY_ID = new Map(CATALOG.map((entry) => [entry.id, entry]));

const BY_CATEGORY = CATALOG.reduce(
  (acc, entry) => {
    (acc[entry.category] ??= []).push(entry);
    return acc;
  },
  {} as Record<ClothingCategory, EnrichedClothingEntry[]>,
);

const WARDROBE_CATEGORIES: ClothingCategory[] = [
  "outfit",
  "top",
  "bottom",
  "outerwear",
];

function enrichEntry(raw: ClothingCatalogEntry): EnrichedClothingEntry {
  const text = `${raw.label} ${raw.script}`;

  return {
    ...raw,
    gender: raw.gender ?? inferClothingGender(text),
    contexts: raw.contexts?.length
      ? normalizeClothingContextTags([...raw.contexts])
      : inferClothingContexts(text),
  };
}

export function getClothingCatalogSize(): number {
  return CATALOG.length;
}

export function getClothingEntry(id: string | undefined): EnrichedClothingEntry | null {
  if (!id?.trim()) {
    return null;
  }

  return BY_ID.get(id.trim()) ?? null;
}

export function getClothingScript(id: string | undefined): string | null {
  return getClothingEntry(id)?.script ?? null;
}

export type ClothingSelectFilters = Pick<ClothingPickFilters, "gender">;

export function getClothingSelectOptions(
  categories: ClothingCategory[],
  filters?: ClothingSelectFilters,
): Array<{ value: string; label: string; group?: string }> {
  const options: Array<{ value: string; label: string; group?: string }> = [
    { value: "", label: "Default (random / LLM)" },
  ];

  for (const category of categories) {
    for (const entry of BY_CATEGORY[category] ?? []) {
      if (filters && !clothingMatchesGender(entry.gender, filters.gender)) {
        continue;
      }

      options.push({
        value: entry.id,
        label: entry.label,
        group: categoryLabel(category),
      });
    }
  }

  return options;
}

function categoryLabel(category: ClothingCategory): string {
  switch (category) {
    case "outfit":
      return "Full outfits";
    case "top":
      return "Tops";
    case "bottom":
      return "Bottoms";
    case "outerwear":
      return "Outerwear";
    case "footwear":
      return "Footwear";
    case "accessory":
      return "Accessories";
    default:
      return category;
  }
}

export function normalizeClothingCatalogId(
  raw: string | undefined,
  allowedCategories?: ClothingCategory[],
  filters?: ClothingSelectFilters,
): string {
  if (!raw?.trim()) {
    return "";
  }

  const entry = getClothingEntry(raw);
  if (!entry) {
    return "";
  }

  if (allowedCategories && !allowedCategories.includes(entry.category)) {
    return "";
  }

  if (filters && !clothingMatchesGender(entry.gender, filters.gender)) {
    return "";
  }

  return entry.id;
}

function randomInt(max: number): number {
  if (max <= 0) {
    return 0;
  }

  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0]! % max;
}

function pick<T>(items: readonly T[]): T {
  return items[randomInt(items.length)]!;
}

function isExcluded(id: string, exclude: readonly string[] | undefined): boolean {
  if (!exclude?.length) {
    return false;
  }

  return exclude.includes(id);
}

function filterPoolByGender(
  pool: readonly EnrichedClothingEntry[],
  gender: ClothingPickFilters["gender"],
): EnrichedClothingEntry[] {
  const strict = pool.filter((entry) => clothingMatchesGender(entry.gender, gender));
  if (strict.length > 0) {
    return strict;
  }

  const neutral = pool.filter((entry) => entry.gender === "neutral");
  if (neutral.length > 0) {
    return neutral;
  }

  return [...pool];
}

function pickScoredEntry(
  pool: readonly EnrichedClothingEntry[],
  contexts: readonly ClothingContextTag[],
  exclude: readonly string[] = [],
): EnrichedClothingEntry | null {
  if (pool.length === 0) {
    return null;
  }

  const scored = pool.map((entry) => ({
    entry,
    score: scoreClothingContextMatch(entry.contexts, contexts),
  }));
  scored.sort((a, b) => b.score - a.score);

  const topScore = scored[0]?.score ?? 0;
  const tier = scored.filter(
    (item) => item.score >= topScore || (topScore === 0 && item.score === 0),
  );

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const candidate = pick(tier).entry;
    if (!isExcluded(candidate.id, exclude)) {
      return candidate;
    }
  }

  const fallback = tier.find((item) => !isExcluded(item.entry.id, exclude));
  return fallback?.entry ?? pick(pool);
}

function pickFromCategory(
  category: ClothingCategory,
  filters: ClothingPickFilters,
): EnrichedClothingEntry | null {
  const basePool = BY_CATEGORY[category] ?? [];
  if (basePool.length === 0) {
    return null;
  }

  const genderPool = filterPoolByGender(basePool, filters.gender);
  let picked = pickScoredEntry(
    genderPool,
    filters.contexts,
    filters.excludeIds,
  );

  if (!picked && filters.contexts.length > 1) {
    picked = pickScoredEntry(genderPool, ["casual"], filters.excludeIds);
  }

  if (!picked) {
    picked = pickScoredEntry(genderPool, [], filters.excludeIds);
  }

  return picked;
}

export type RandomCharacterOutfit = {
  wardrobeId: string | null;
  footwearId: string | null;
  accessoriesId: string | null;
  wardrobe: string | null;
  footwear: string | null;
  accessories: string | null;
  summary: string;
  filters: ClothingPickFilters;
};

export function pickRandomCharacterOutfit(
  filters: ClothingPickFilters = { gender: "any", contexts: ["casual"] },
): RandomCharacterOutfit {
  const used = new Set(filters.excludeIds ?? []);
  const workingFilters: ClothingPickFilters = {
    ...filters,
    excludeIds: [...used],
  };

  const useOutfit = randomInt(100) < 42;
  let wardrobe: EnrichedClothingEntry | null = null;
  let bottom: EnrichedClothingEntry | null = null;

  if (useOutfit) {
    wardrobe = pickFromCategory("outfit", workingFilters);
  } else {
    wardrobe = pickFromCategory("top", workingFilters);
    bottom = pickFromCategory("bottom", workingFilters);
  }

  const footwear = pickFromCategory("footwear", workingFilters);
  const accessory =
    randomInt(100) < 55
      ? pickFromCategory("accessory", workingFilters)
      : null;

  if (wardrobe) used.add(wardrobe.id);
  if (bottom) used.add(bottom.id);
  if (footwear) used.add(footwear.id);
  if (accessory) used.add(accessory.id);

  const parts = [
    wardrobe?.script,
    bottom?.script,
    footwear?.script,
    accessory?.script,
  ].filter(Boolean);

  return {
    wardrobeId: wardrobe?.id ?? null,
    footwearId: footwear?.id ?? null,
    accessoriesId: accessory?.id ?? null,
    wardrobe: wardrobe?.script ?? null,
    footwear: footwear?.script ?? null,
    accessories: accessory?.script ?? null,
    summary: parts.join(", "),
    filters,
  };
}

const CLOTHING_HINT =
  /\b(?:wearing|dressed|outfit|wardrobe|shirt|blouse|tee|t-shirt|top|jacket|coat|hoodie|sweater|dress|skirt|pants|jeans|shorts|boots|sneakers|shoes|heels|sandals|suit|uniform|apron|overalls|vest|blazer|cardigan|leggings|romper|jumpsuit|kimono|robe|armor|gown|tuxedo|scrubs)\b/i;

export function hintsMentionClothing(hints?: string): boolean {
  return CLOTHING_HINT.test(hints?.trim() ?? "");
}

export function hasWardrobeCatalogSelection(options: {
  wardrobe?: string;
  footwear?: string;
  accessories?: string;
  wardrobeCatalog?: string;
  footwearCatalog?: string;
  accessoriesCatalog?: string;
}): boolean {
  return Boolean(
    options.wardrobe?.trim() ||
      options.footwear?.trim() ||
      options.accessories?.trim() ||
      options.wardrobeCatalog ||
      options.footwearCatalog ||
      options.accessoriesCatalog,
  );
}

export const CLOTHING_CATALOG_FIELD_KEYS = [
  "wardrobeCatalog",
  "footwearCatalog",
  "accessoriesCatalog",
] as const;

export type ClothingCatalogFieldKey = (typeof CLOTHING_CATALOG_FIELD_KEYS)[number];

export function getClothingCatalogFieldCategories(
  key: ClothingCatalogFieldKey,
): ClothingCategory[] {
  switch (key) {
    case "wardrobeCatalog":
      return WARDROBE_CATEGORIES;
    case "footwearCatalog":
      return ["footwear"];
    case "accessoriesCatalog":
      return ["accessory"];
    default:
      return [];
  }
}

export type { ClothingPickFilters } from "./clothing-tags";
