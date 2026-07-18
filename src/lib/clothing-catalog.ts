import { ALL_CLOTHING_CATALOG_ENTRIES } from "./clothing-catalog-batches";

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
};

const CATALOG: ClothingCatalogEntry[] = [...ALL_CLOTHING_CATALOG_ENTRIES];

const BY_ID = new Map(CATALOG.map((entry) => [entry.id, entry]));

const BY_CATEGORY = CATALOG.reduce(
  (acc, entry) => {
    (acc[entry.category] ??= []).push(entry);
    return acc;
  },
  {} as Record<ClothingCategory, ClothingCatalogEntry[]>,
);

const WARDROBE_CATEGORIES: ClothingCategory[] = [
  "outfit",
  "top",
  "bottom",
  "outerwear",
];

export function getClothingCatalogSize(): number {
  return CATALOG.length;
}

export function getClothingEntry(id: string | undefined): ClothingCatalogEntry | null {
  if (!id?.trim()) {
    return null;
  }

  return BY_ID.get(id.trim()) ?? null;
}

export function getClothingScript(id: string | undefined): string | null {
  return getClothingEntry(id)?.script ?? null;
}

export function getClothingSelectOptions(
  categories: ClothingCategory[],
): Array<{ value: string; label: string; group?: string }> {
  const options: Array<{ value: string; label: string; group?: string }> = [
    { value: "", label: "Default (random / LLM)" },
  ];

  for (const category of categories) {
    for (const entry of BY_CATEGORY[category] ?? []) {
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

function pickFromCategory(
  category: ClothingCategory,
  exclude: readonly string[] = [],
): ClothingCatalogEntry | null {
  const pool = BY_CATEGORY[category] ?? [];
  if (pool.length === 0) {
    return null;
  }

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const candidate = pick(pool);
    if (!isExcluded(candidate.id, exclude)) {
      return candidate;
    }
  }

  return pick(pool);
}

export type RandomCharacterOutfit = {
  wardrobeId: string | null;
  footwearId: string | null;
  accessoriesId: string | null;
  wardrobe: string | null;
  footwear: string | null;
  accessories: string | null;
  summary: string;
};

export function pickRandomCharacterOutfit(
  excludeIds: readonly string[] = [],
): RandomCharacterOutfit {
  const used = new Set(excludeIds);
  const exclude = () => [...used];

  const useOutfit = randomInt(100) < 42;
  let wardrobe: ClothingCatalogEntry | null = null;
  let bottom: ClothingCatalogEntry | null = null;

  if (useOutfit) {
    wardrobe = pickFromCategory("outfit", exclude());
  } else {
    wardrobe = pickFromCategory("top", exclude());
    bottom = pickFromCategory("bottom", exclude());
  }

  const footwear = pickFromCategory("footwear", exclude());
  const accessory =
    randomInt(100) < 55 ? pickFromCategory("accessory", exclude()) : null;

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
