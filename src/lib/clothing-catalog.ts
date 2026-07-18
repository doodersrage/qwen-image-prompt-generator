import { ALL_CLOTHING_CATALOG_ENTRIES } from "./clothing-catalog-batches";
import {
  clothingAllowedInScene,
  clothingMatchesGender,
  entryHasRestrictedContext,
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
  | "accessory"
  | "swimwear"
  | "intimate"
  | "hosiery"
  | "formalwear"
  | "dressy-accessory"
  | "sleepwear"
  | "underwear"
  | "socks"
  | "headwear"
  | "traditional";

export const ALL_CLOTHING_CATEGORIES: ClothingCategory[] = [
  "outfit",
  "top",
  "bottom",
  "outerwear",
  "footwear",
  "accessory",
  "swimwear",
  "intimate",
  "hosiery",
  "formalwear",
  "dressy-accessory",
  "sleepwear",
  "underwear",
  "socks",
  "headwear",
  "traditional",
];

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
  "swimwear",
  "intimate",
  "formalwear",
  "sleepwear",
  "underwear",
  "traditional",
];

function sceneAllowsFormalwear(contexts: readonly ClothingContextTag[]): boolean {
  return contexts.includes("formal") || contexts.includes("evening");
}

function sceneAllowsHosiery(contexts: readonly ClothingContextTag[]): boolean {
  return (
    contexts.includes("formal") ||
    contexts.includes("evening") ||
    contexts.includes("intimate")
  );
}

function mergeCategoryContexts(
  category: ClothingCategory,
  contexts: ClothingContextTag[],
  text: string,
): ClothingContextTag[] {
  const tags = new Set(contexts);

  if (category === "swimwear") {
    tags.add("swimwear");
    tags.add("beach");
    tags.add("warm");
    tags.delete("casual");
    tags.delete("work");
    tags.delete("cold");
  }

  if (category === "intimate") {
    tags.add("intimate");
    tags.delete("casual");
    tags.delete("work");
    tags.delete("outdoor");
    if (
      /\b(?:lace|satin|silk|chemise|negligee|garter|bustier|luxury|champagne|embroidered)\b/i.test(
        text,
      )
    ) {
      tags.add("evening");
    }
  }

  if (category === "hosiery") {
    tags.add("hosiery");
    tags.add("formal");
    tags.delete("casual");
    tags.delete("work");
    tags.delete("outdoor");
    if (/\b(?:fishnet|garter|stay-up|sheer)\b/i.test(text)) {
      tags.add("intimate");
    }
    if (/\b(?:opaque|wool|ribbed|winter)\b/i.test(text)) {
      tags.add("cold");
    }
  }

  if (category === "formalwear") {
    tags.add("formalwear");
    tags.add("formal");
    tags.add("evening");
    tags.delete("casual");
    tags.delete("work");
    tags.delete("athletic");
  }

  if (category === "dressy-accessory") {
    tags.add("formalwear");
    tags.add("formal");
    tags.add("evening");
    tags.delete("casual");
    tags.delete("work");
  }

  if (category === "sleepwear") {
    tags.add("sleepwear");
    tags.add("intimate");
    tags.delete("work");
    tags.delete("outdoor");
  }

  if (category === "underwear") {
    tags.add("underwear");
    tags.add("intimate");
    tags.delete("work");
    tags.delete("outdoor");
  }

  if (category === "socks") {
    if (/\b(?:dress|argyle)\b/i.test(text)) {
      tags.add("formal");
    }
    if (/\b(?:athletic|compression)\b/i.test(text)) {
      tags.add("athletic");
    }
    if (/\b(?:wool|merino|hiking)\b/i.test(text)) {
      tags.add("outdoor");
    }
    if (/\b(?:wool|winter|thick)\b/i.test(text)) {
      tags.add("cold");
    }
  }

  if (category === "headwear") {
    if (/\b(?:formal|fascinator|church|cloche|boater)\b/i.test(text)) {
      tags.add("formal");
      tags.add("evening");
    }
    if (/\b(?:sun|bucket|visor)\b/i.test(text)) {
      tags.add("warm");
    }
    if (/\b(?:balaclava|knit|earmuff)\b/i.test(text)) {
      tags.add("cold");
    }
  }

  if (category === "traditional") {
    tags.add("traditional");
    tags.add("formal");
    tags.delete("casual");
  }

  return [...tags];
}

function enrichEntry(raw: ClothingCatalogEntry): EnrichedClothingEntry {
  const text = `${raw.label} ${raw.script}`;
  const baseContexts = raw.contexts?.length
    ? normalizeClothingContextTags([...raw.contexts])
    : inferClothingContexts(text);

  return {
    ...raw,
    gender:
      raw.gender ??
      (raw.category === "hosiery" ||
      raw.category === "formalwear" ||
      raw.category === "dressy-accessory"
        ? "women"
        : inferClothingGender(text)),
    contexts: mergeCategoryContexts(raw.category, baseContexts, text),
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
    case "swimwear":
      return "Swimwear";
    case "intimate":
      return "Intimates & loungewear";
    case "hosiery":
      return "Hosiery";
    case "formalwear":
      return "Formal & dressy";
    case "dressy-accessory":
      return "Dressy accessories";
    case "sleepwear":
      return "Sleepwear & robes";
    case "underwear":
      return "Underwear & base layers";
    case "socks":
      return "Socks & legwear";
    case "headwear":
      return "Headwear";
    case "traditional":
      return "Traditional & cultural";
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

function pick<T>(items: readonly T[]): T | undefined {
  if (items.length === 0) {
    return undefined;
  }

  return items[randomInt(items.length)];
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

function filterPoolByScene(
  pool: readonly EnrichedClothingEntry[],
  sceneContexts: readonly ClothingContextTag[],
): EnrichedClothingEntry[] {
  const allowed = pool.filter((entry) =>
    clothingAllowedInScene(entry.contexts, sceneContexts),
  );

  if (allowed.length > 0) {
    return allowed;
  }

  return pool.filter((entry) => !entryHasRestrictedContext(entry.contexts));
}

function pickScoredEntry(
  pool: readonly EnrichedClothingEntry[],
  contexts: readonly ClothingContextTag[],
  exclude: readonly string[] = [],
): EnrichedClothingEntry | null {
  if (pool.length === 0) {
    return null;
  }

  const scenePool = filterPoolByScene(pool, contexts);
  if (scenePool.length === 0) {
    return null;
  }

  const scored = scenePool.map((entry) => ({
    entry,
    score: scoreClothingContextMatch(entry.contexts, contexts),
  }));
  scored.sort((a, b) => b.score - a.score);

  const topScore = scored[0]?.score ?? 0;
  const tier = scored.filter(
    (item) => item.score >= topScore || (topScore === 0 && item.score === 0),
  );

  if (tier.length === 0) {
    return null;
  }

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const chosen = pick(tier);
    const candidate = chosen?.entry;
    if (candidate && !isExcluded(candidate.id, exclude)) {
      return candidate;
    }
  }

  const fallback = tier.find((item) => !isExcluded(item.entry.id, exclude));
  if (fallback) {
    return fallback.entry;
  }

  const sceneFallback = scenePool.find((entry) => !isExcluded(entry.id, exclude));
  return sceneFallback ?? null;
}

function pickWardrobeLayers(
  filters: ClothingPickFilters,
): {
  wardrobe: EnrichedClothingEntry | null;
  bottom: EnrichedClothingEntry | null;
} {
  if (filters.contexts.includes("swimwear") && randomInt(100) < 58) {
    const swimwear = pickFromCategory("swimwear", filters);
    if (swimwear) {
      return { wardrobe: swimwear, bottom: null };
    }
  }

  if (filters.contexts.includes("intimate") && randomInt(100) < 45) {
    const intimate = pickFromCategory("intimate", filters);
    if (intimate) {
      return { wardrobe: intimate, bottom: null };
    }
  }

  if (sceneAllowsFormalwear(filters.contexts) && randomInt(100) < 38) {
    const formalwear = pickFromCategory("formalwear", filters);
    if (formalwear) {
      return { wardrobe: formalwear, bottom: null };
    }
  }

  if (
    (filters.contexts.includes("formal") ||
      filters.contexts.includes("costume") ||
      filters.contexts.includes("traditional")) &&
    randomInt(100) < 22
  ) {
    const traditional = pickFromCategory("traditional", filters);
    if (traditional) {
      return { wardrobe: traditional, bottom: null };
    }
  }

  if (filters.contexts.includes("intimate") && randomInt(100) < 30) {
    const sleepwear = pickFromCategory("sleepwear", filters);
    if (sleepwear) {
      return { wardrobe: sleepwear, bottom: null };
    }
  }

  const useOutfit = randomInt(100) < 42;
  if (useOutfit) {
    return {
      wardrobe: pickFromCategory("outfit", filters),
      bottom: null,
    };
  }

  return {
    wardrobe: pickFromCategory("top", filters),
    bottom: pickFromCategory("bottom", filters),
  };
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

  const useIntimateFootwear =
    filters.contexts.includes("intimate") && randomInt(100) < 35;

  const { wardrobe, bottom } = pickWardrobeLayers(workingFilters);
  const hosiery =
    sceneAllowsHosiery(filters.contexts) && randomInt(100) < 44
      ? pickFromCategory("hosiery", workingFilters)
      : null;
  const dressyAccessory =
    sceneAllowsFormalwear(filters.contexts) && randomInt(100) < 36
      ? pickFromCategory("dressy-accessory", workingFilters)
      : null;
  const socks =
    randomInt(100) < 48 ? pickFromCategory("socks", workingFilters) : null;
  const headwear =
    randomInt(100) < 28 ? pickFromCategory("headwear", workingFilters) : null;
  const footwear = useIntimateFootwear
    ? null
    : pickFromCategory("footwear", workingFilters);
  const accessory =
    dressyAccessory ??
    headwear ??
    (randomInt(100) < 55
      ? pickFromCategory("accessory", workingFilters)
      : null);

  if (wardrobe) used.add(wardrobe.id);
  if (bottom) used.add(bottom.id);
  if (hosiery) used.add(hosiery.id);
  if (socks) used.add(socks.id);
  if (footwear) used.add(footwear.id);
  if (accessory) used.add(accessory.id);

  const parts = [
    wardrobe?.script,
    bottom?.script,
    hosiery?.script,
    socks?.script,
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

export function mergeAssignedWardrobeIntoPrompt(
  prompt: string,
  wardrobeSummary: string,
): string {
  const trimmed = prompt.trim();
  const summary = wardrobeSummary.trim();
  if (!summary) {
    return trimmed;
  }

  const normPrompt = trimmed.toLowerCase();
  const chunks = summary
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length >= 10);

  const alreadyPresent = chunks.some((chunk) =>
    normPrompt.includes(chunk.toLowerCase().slice(0, Math.min(28, chunk.length))),
  );

  if (alreadyPresent) {
    return trimmed;
  }

  const clause = summary.endsWith(".") ? `wearing ${summary}` : `wearing ${summary}.`;
  return trimmed ? `${clause} ${trimmed}` : clause;
}

export function shouldPickRandomCharacterOutfit(input: {
  presetOptions: {
    wardrobe?: string;
    footwear?: string;
    accessories?: string;
    wardrobeCatalog?: string;
    footwearCatalog?: string;
    accessoriesCatalog?: string;
  };
  hints?: string;
  alwaysIncludeClothing?: boolean;
}): boolean {
  if (hasWardrobeCatalogSelection(input.presetOptions)) {
    return false;
  }

  if (input.alwaysIncludeClothing !== false) {
    return true;
  }

  return !hintsMentionClothing(input.hints);
}

const CLOTHING_HINT =
  /\b(?:wearing|dressed|outfit|wardrobe|shirt|blouse|tee|t-shirt|top|jacket|coat|hoodie|sweater|dress|skirt|pants|jeans|shorts|boots|sneakers|shoes|heels|sandals|suit|uniform|apron|overalls|vest|blazer|cardigan|leggings|romper|jumpsuit|kimono|robe|armor|gown|tuxedo|scrubs|bikini|swimsuit|swim trunks|lingerie|chemise|negligee|stockings|pantyhose|tights|fascinator|opera gloves|twinset|skirt suit)\b/i;

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
      return ["accessory", "dressy-accessory", "hosiery", "socks", "headwear"];
    default:
      return [];
  }
}

export type { ClothingPickFilters } from "./clothing-tags";
