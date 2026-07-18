import type { SubjectGender } from "./variation-seed";

export type ClothingScenePresetHints = {
  atmosphere?: string;
  aesthetic?: string;
};

export type ClothingGenderTag = "women" | "men" | "neutral";

export type ClothingContextTag =
  | "casual"
  | "formal"
  | "evening"
  | "athletic"
  | "outdoor"
  | "cold"
  | "warm"
  | "wet"
  | "work"
  | "uniform"
  | "costume"
  | "beach"
  | "urban"
  | "swimwear"
  | "intimate"
  | "hosiery"
  | "formalwear"
  | "sleepwear"
  | "underwear"
  | "traditional";

export const CLOTHING_CONTEXT_TAGS: ClothingContextTag[] = [
  "casual",
  "formal",
  "evening",
  "athletic",
  "outdoor",
  "cold",
  "warm",
  "wet",
  "work",
  "uniform",
  "costume",
  "beach",
  "urban",
  "swimwear",
  "intimate",
  "hosiery",
  "formalwear",
  "sleepwear",
  "underwear",
  "traditional",
];

/** Contexts that require a matching scene tag before random pick or catalog validation. */
export const RESTRICTED_CLOTHING_CONTEXTS: ClothingContextTag[] = [
  "swimwear",
  "intimate",
  "hosiery",
  "formalwear",
  "sleepwear",
  "underwear",
];

const RESTRICTED_CONTEXT_REQUIREMENTS: Partial<
  Record<ClothingContextTag, readonly ClothingContextTag[]>
> = {
  swimwear: ["swimwear"],
  intimate: ["intimate"],
  hosiery: ["formal", "evening", "intimate"],
  formalwear: ["formal", "evening"],
  sleepwear: ["intimate"],
  underwear: ["intimate"],
};

const WOMEN_GARMENT =
  /\b(?:dress|gown|skirt|heels|stiletto|tutu|cocktail dress|evening gown|a-line skirt|fish-tail skirt|maxi skirt|mini skirt|pencil skirt|wrap skirt|romper|camisole|corset top|blouse|peasant blouse|wrap blouse|halter top|slip dress|shirt dress|sweater dress|dirndl|sari|salwar kameez|hanbok|flamenco dress|ballroom dance dress|mary jane|kitten heels|block heel pumps|ballet flats|leggings|yoga pants|bikini|one-piece swimsuit|tankini|chemise|negligee|lingerie|bralette|bustier|teddy|garter belt|tap pants|stockings|pantyhose|tights|fishnet|twinset|skirt suit|fascinator|opera gloves)\b/i;

const MEN_GARMENT =
  /\b(?:brogues|monk strap|oxford dress shoes|tuxedo|three-piece suit|boxer briefs|jockstrap|codpiece|necktie with suit|suspenders and tie|chore coat with work boots|cowboy boots with hat|swim trunks|swim briefs|lounge shorts with robe)\b/i;

const WOMEN_LEAN =
  /\b(?:crop top|off-shoulder|bodysuit|spaghetti strap|wrap dress|sequin gown|platform heels|thigh-high boots with skirt)\b/i;

const MEN_LEAN =
  /\b(?:rugby shirt|fatigue jacket|military fatigue|dress shirt and tie|suit jacket|sport coat|tweed sport coat|work chore coat|steel-toe boots|hi-vis safety vest)\b/i;

const CONTEXT_RULES: Array<{ tag: ClothingContextTag; pattern: RegExp }> = [
  { tag: "athletic", pattern: /\b(?:jersey|running|jogger|yoga|gym|cycling|soccer|cleats|track pants|sweatpants|sport|ski jacket|climbing|trail runner|basketball|fencing|dance kit|triathlon|workout|compression|goalkeeper|baseball uniform|hockey|swim|snorkel|cleats|mogul|parkour)\b/i },
  { tag: "formal", pattern: /\b(?:suit|tuxedo|gown|cocktail|blazer|oxford dress|brogues|monk strap|evening wear|wedding|pencil skirt|sport coat|tailcoat|formal wear|three-piece|evening gown|cocktail dress|skirt suit|twinset|formalwear|opera gloves|fascinator)\b/i },
  { tag: "evening", pattern: /\b(?:cocktail|evening gown|sequin|silk slip|stiletto|heels|gown|tuxedo|smoking jacket|ballroom|satin slip|pearl necklace|clutch|opera gloves|fascinator|minaudiere|stole|tiara)\b/i },
  { tag: "outdoor", pattern: /\b(?:hiking|trail|parka|puffer|anorak|fleece|gore-tex|windbreaker|cargo pants|work boots|mountain shell|rain slicker|field jacket|cagoule|poncho|bandana|sun hat|straw hat|backpack|climbing|camp|safari|gorpcore)\b/i },
  { tag: "cold", pattern: /\b(?:parka|puffer|wool|fleece|peacoat|duffle coat|shearling|down|beanie|scarf|mittens|balaclava|moon boots|overcoat|quilted|insulated|ear muffs|winter)\b/i },
  { tag: "warm", pattern: /\b(?:shorts|sandals|flip-flops|tank top|linen|hawaiian shirt|board shorts|muscle tank|racerback|espadrilles|sun hat|crop top|sleeveless|mesh jersey|sleeveless)\b/i },
  { tag: "wet", pattern: /\b(?:rain|slicker|wellington|rubber boots|gore-tex|poncho|oilskin|waterproof|hardshell|rain boots|cagoule|packable shell)\b/i },
  { tag: "work", pattern: /\b(?:coveralls|overalls|workbench|apron|hi-vis|safety vest|tool belt|mechanic|chef|barista|warehouse|scrubs|lab coat|barber|butcher|forge|paint-stained|work boots|steel-toe|utilitarian|chore coat|boiler suit)\b/i },
  { tag: "uniform", pattern: /\b(?:uniform|kit|gi|dobok|judogi|karate|scrubs|police|military|firefighter|turnout|pilot|flight attendant|nurse|paramedic|chef whites|server room|bellhop|postal|mail carrier|referee|umpire)\b/i },
  { tag: "costume", pattern: /\b(?:wizard|knight|armor|circus|magician|monk robes|nun habit|cosplay|vampire|steampunk|elven|dwarven|halloween|renaissance faire|mermaid|superhero|ballerina tutu)\b/i },
  { tag: "beach", pattern: /\b(?:board shorts|flip-flops|sarong|snorkel|bikini|swim trunks|rash guard|beach|coastal|linen camp shirt|espadrilles|sun hat|cover-up|kaftan cover-up|poolside)\b/i },
  { tag: "swimwear", pattern: /\b(?:bikini|one-piece swimsuit|tankini|swim trunks|swim briefs|rash guard|cut-out swimsuit|bandeau bikini|high-waist bikini|sport swimsuit|swim set|monokini|swim top|swim bottom|competitive swim)\b/i },
  { tag: "intimate", pattern: /\b(?:lingerie|bra\b|bralette|panties|briefs|boxer briefs|chemise|negligee|teddy|bodysuit lingerie|garter belt|bustier|corset lingerie|tap pants|silk robe set|lace set|satin slip set|lounge lingerie|drawers and vest|sleep set|stay-up stockings|garter stockings)\b/i },
  { tag: "hosiery", pattern: /\b(?:stockings|pantyhose|tights|fishnet|sheer hose|nylon hose|thigh-high stockings|stay-up stockings|back-seam stockings|seamed pantyhose|garter stockings|opaque tights|lace-top stockings)\b/i },
  { tag: "formalwear", pattern: /\b(?:skirt suit|pants suit|twinset|formal suit|evening suit|tweed suit|sheath dress and jacket|formal jumpsuit|ballroom-ready|chanel-style|dress suit|formal cape|ladies' tuxedo|morning dress suit)\b/i },
  { tag: "sleepwear", pattern: /\b(?:pajama|pyjama|nightgown|nightdress|sleep shirt|sleep set|bathrobe|dressing gown|peignoir|onesie pajama|footie pajama|lounge sleep)\b/i },
  { tag: "underwear", pattern: /\b(?:underwear|undershirt|long johns|thermal underwear|union suit|everyday bra|sports bra|boxer briefs|hipster panties|shapewear|A-shirt|wifebeater undershirt)\b/i },
  { tag: "traditional", pattern: /\b(?:qipao|cheongsam|ao dai|abaya|kaftan dress|dashiki|boubou|djellaba|kebaya|huipil|hanfu|yukata|dirndl|lederhosen|kilt|serape|shalwar|gomesi|bunad|chapan)\b/i },
  { tag: "urban", pattern: /\b(?:streetwear|techwear|hoodie|denim jacket|leather jacket|bomber|sneakers|crossbody|snapback|cargo pants|oversized fit|y2k|grunge|cyberpunk|neon|metro|skateboard|parkour)\b/i },
  { tag: "casual", pattern: /\b(?:tee|t-shirt|henley|jeans|chinos|hoodie|sneakers|flannel|cardigan|loafers|casual|everyday|relaxed-fit)\b/i },
];

const SCENE_CONTEXT_RULES: Array<{ tag: ClothingContextTag; pattern: RegExp }> = [
  { tag: "cold", pattern: /\b(?:snow|frost|winter|arctic|glacier|blizzard|ice|polar|alpine|hoarfrost|siberian|tundra|iceland|antarctica|cold|freezing|subzero|mountain lodge|ski slope|frozen)\b/i },
  { tag: "warm", pattern: /\b(?:desert|heat haze|humid|summer|tropical|palm|sahara|savanna|oasis|jungle|rainforest|noon sun|midsummer|arid|dry heat)\b/i },
  { tag: "wet", pattern: /\b(?:rain|monsoon|drizzle|downpour|puddle|storm|wet pavement|after a recent rain|spray|misty rain|showers)\b/i },
  { tag: "beach", pattern: /\b(?:beach|shore|coastal|sand|surf|lagoon|tropical reef|seaside|boardwalk pier|overwater|island|coral|harbor quay|dhow|tidal)\b/i },
  { tag: "swimwear", pattern: /\b(?:pool|swimming|swim\b|aquatic|hot tub|jacuzzi|yacht deck|lakeside|water park|infinity pool|rooftop pool|spa pool|snorkeling|surfing|tropical resort|beach club pool)\b/i },
  { tag: "intimate", pattern: /\b(?:bedroom|boudoir|master suite|hotel room|hotel suite|ensuite|dressing room|vanity mirror|silk sheets|canopy bed|candlelit|bathtub|soaking tub|spa suite|private suite|morning light through curtains|getting ready|lingerie shoot|penthouse bed)\b/i },
  { tag: "outdoor", pattern: /\b(?:forest|mountain|trail|meadow|field|garden|canyon|lake|river|farm|barn|countryside|hiking|pine|valley|cliff|rooftop garden|park|orchard|vineyard|steppe|prairie|wetland|marsh|glade|fjord)\b/i },
  { tag: "formal", pattern: /\b(?:ballroom|gala|opera house|wedding|cathedral|courthouse|formal hall|banquet|black tie|reception|palais|palace hall|symphony|orchestra pit|red carpet|premiere)\b/i },
  { tag: "evening", pattern: /\b(?:midnight|dusk|twilight|blue hour|night|after hours|neon|jazz club|speakeasy|bar\b|night market|moonlit|starry|late evening|sunset|golden hour window)\b/i },
  { tag: "work", pattern: /\b(?:office|workshop|factory|kitchen|hospital|clinic|server room|warehouse|construction|studio backlot|laboratory|courtroom|pharmacy|garage|mill|forge|bakery|butcher|studio|newsroom|trading floor)\b/i },
  { tag: "urban", pattern: /\b(?:alley|street|city|downtown|metro|subway|skyline|urban|neon|cyberpunk|penthouse|loft|brick facade|shophouse|bodega|parking garage|overpass)\b/i },
  { tag: "athletic", pattern: /\b(?:gym|dojo|stadium|arena|court|track|rink|pool deck|skate park|climbing gym|yoga studio|boxing gym|ballet studio|soccer|baseball field|ferry deck running)\b/i },
  { tag: "uniform", pattern: /\b(?:barracks|prison|dungeon|military|naval|submarine|aircraft hangar|police station|fire station|hospital ward|monastery|convent|academy|school campus|parade ground)\b/i },
  { tag: "costume", pattern: /\b(?:fantasy|medieval|wizard|dragon|enchanted|fairy|gothic library|amusement park|circus|stage|theater fly|renaissance|myth|cosplay|larp)\b/i },
];

const PRESET_ATMOSPHERE_CONTEXT: Record<string, ClothingContextTag[]> = {
  "light-rain": ["wet", "outdoor"],
  "fog-haze": ["outdoor", "urban"],
  "dust-particles": ["outdoor", "warm"],
  "falling-snow": ["cold", "outdoor"],
};

const PRESET_AESTHETIC_CONTEXT: Record<string, ClothingContextTag[]> = {
  cyberpunk: ["urban", "evening"],
  "noir-dramatic": ["formal", "evening", "urban"],
  "cottage-soft": ["casual", "outdoor"],
  "nineties-film": ["casual", "urban"],
  "seventies-warm": ["casual", "warm"],
};

export function normalizeClothingContextTags(
  raw: string[] | readonly string[] | undefined,
): ClothingContextTag[] {
  if (!raw?.length) {
    return [];
  }

  const allowed = new Set<string>(CLOTHING_CONTEXT_TAGS);
  const tags: ClothingContextTag[] = [];

  for (const tag of raw) {
    if (allowed.has(tag)) {
      tags.push(tag as ClothingContextTag);
    }
  }

  return [...new Set(tags)];
}

export function inferClothingGender(text: string): ClothingGenderTag {
  const value = text.toLowerCase();
  let womenScore = 0;
  let menScore = 0;

  if (WOMEN_GARMENT.test(value)) womenScore += 3;
  if (WOMEN_LEAN.test(value)) womenScore += 2;
  if (MEN_GARMENT.test(value)) menScore += 3;
  if (MEN_LEAN.test(value)) menScore += 2;

  if (/\b(?:ball gown|prom dress|bridesmaid|maternity dress)\b/i.test(value)) womenScore += 4;
  if (/\b(?:tuxedo|cummerbund|dress shirt and tie)\b/i.test(value)) menScore += 2;

  if (womenScore >= menScore + 2) return "women";
  if (menScore >= womenScore + 2) return "men";
  return "neutral";
}

export function inferClothingContexts(text: string): ClothingContextTag[] {
  const value = text.toLowerCase();
  const tags = new Set<ClothingContextTag>();

  for (const rule of CONTEXT_RULES) {
    if (rule.pattern.test(value)) {
      tags.add(rule.tag);
    }
  }

  if (tags.size === 0) {
    tags.add("casual");
  } else if (
    tags.has("swimwear") ||
    tags.has("intimate") ||
    tags.has("hosiery") ||
    tags.has("formalwear") ||
    tags.has("sleepwear") ||
    tags.has("underwear") ||
    tags.has("uniform") ||
    tags.has("costume")
  ) {
    tags.delete("casual");
  }

  return [...tags];
}

export function subjectGenderToClothingGender(
  gender: SubjectGender | undefined,
): "women" | "men" | "any" {
  if (gender === "women" || gender === "men") {
    return gender;
  }

  return "any";
}

export function inferSceneClothingContexts(input: {
  sceneLocation?: string | null;
  environmentSeed?: string;
  hints?: string;
  presetOptions?: ClothingScenePresetHints;
}): ClothingContextTag[] {
  const corpus = [
    input.sceneLocation,
    input.environmentSeed,
    input.hints,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const tags = new Set<ClothingContextTag>();

  if (hintsAllowSwimwearCatalog(input.hints)) {
    tags.add("swimwear");
  }
  if (hintsAllowIntimateCatalog(input.hints)) {
    tags.add("intimate");
  }
  if (hintsAllowFormalwearCatalog(input.hints)) {
    tags.add("formalwear");
    tags.add("formal");
  }
  if (hintsAllowHosieryCatalog(input.hints)) {
    tags.add("hosiery");
  }

  for (const rule of SCENE_CONTEXT_RULES) {
    if (rule.pattern.test(corpus)) {
      tags.add(rule.tag);
    }
  }

  const atmosphere = input.presetOptions?.atmosphere;
  if (atmosphere && PRESET_ATMOSPHERE_CONTEXT[atmosphere]) {
    for (const tag of PRESET_ATMOSPHERE_CONTEXT[atmosphere]!) {
      tags.add(tag);
    }
  }

  const aesthetic = input.presetOptions?.aesthetic;
  if (aesthetic && PRESET_AESTHETIC_CONTEXT[aesthetic]) {
    for (const tag of PRESET_AESTHETIC_CONTEXT[aesthetic]!) {
      tags.add(tag);
    }
  }

  if (tags.has("beach") || /\b(?:pool|swim|jacuzzi|hot tub)\b/i.test(corpus)) {
    tags.add("swimwear");
  }

  if (tags.size === 0) {
    tags.add("casual");
  }

  return [...tags];
}

export type ClothingPickFilters = {
  gender: "women" | "men" | "any";
  contexts: ClothingContextTag[];
  excludeIds?: readonly string[];
};

export function buildClothingPickFilters(input: {
  gender?: SubjectGender;
  sceneLocation?: string | null;
  environmentSeed?: string;
  hints?: string;
  presetOptions?: ClothingScenePresetHints;
  excludeIds?: readonly string[];
}): ClothingPickFilters {
  return {
    gender: subjectGenderToClothingGender(input.gender),
    contexts: inferSceneClothingContexts({
      sceneLocation: input.sceneLocation,
      environmentSeed: input.environmentSeed,
      hints: input.hints,
      presetOptions: input.presetOptions,
    }),
    excludeIds: input.excludeIds,
  };
}

export function clothingMatchesGender(
  entryGender: ClothingGenderTag,
  filterGender: "women" | "men" | "any",
): boolean {
  if (filterGender === "any") {
    return true;
  }

  if (entryGender === "neutral") {
    return true;
  }

  return entryGender === filterGender;
}

export function entryHasRestrictedContext(
  entryContexts: readonly ClothingContextTag[],
): boolean {
  return entryContexts.some((tag) => RESTRICTED_CLOTHING_CONTEXTS.includes(tag));
}

export function clothingAllowedInScene(
  entryContexts: readonly ClothingContextTag[],
  sceneContexts: readonly ClothingContextTag[],
): boolean {
  for (const tag of RESTRICTED_CLOTHING_CONTEXTS) {
    if (!entryContexts.includes(tag)) {
      continue;
    }

    const required = RESTRICTED_CONTEXT_REQUIREMENTS[tag] ?? [tag];
    if (!required.some((requiredTag) => sceneContexts.includes(requiredTag))) {
      return false;
    }
  }

  return true;
}

const SWIMWEAR_HINT =
  /\b(?:beach|pool|swim|swimming|swimwear|bikini|trunks|tropical|resort|yacht|hot tub|jacuzzi|snorkel|surfer|aquatic|lakeside|board shorts|one-piece)\b/i;

const INTIMATE_HINT =
  /\b(?:bedroom|boudoir|lingerie|intimate|silk sheets|hotel room|hotel suite|vanity|bathtub|soaking tub|chemise|negligee|getting dressed|morning after|private suite|dressing room|robe only|sleepwear|nightgown)\b/i;

const FORMALWEAR_HINT =
  /\b(?:formal|gala|ballroom|black tie|cocktail|evening gown|opera|wedding reception|red carpet|premiere|skirt suit|pants suit|twinset|fascinator|opera gloves|formalwear|dress suit|banquet|charity ball)\b/i;

const HOSIERY_HINT =
  /\b(?:stockings|pantyhose|tights|hosiery|fishnet hose|sheer hose|nylon hose|back-seam stockings|thigh-high stockings|garter and stockings|seamed pantyhose)\b/i;

export function hintsAllowSwimwearCatalog(hints?: string): boolean {
  return SWIMWEAR_HINT.test(hints?.trim() ?? "");
}

export function hintsAllowIntimateCatalog(hints?: string): boolean {
  return INTIMATE_HINT.test(hints?.trim() ?? "");
}

export function hintsAllowFormalwearCatalog(hints?: string): boolean {
  return FORMALWEAR_HINT.test(hints?.trim() ?? "");
}

export function hintsAllowHosieryCatalog(hints?: string): boolean {
  const value = hints?.trim() ?? "";
  return (
    HOSIERY_HINT.test(value) ||
    hintsAllowFormalwearCatalog(value) ||
    hintsAllowIntimateCatalog(value)
  );
}

export function catalogEntryAllowedByHints(
  _entry: {
    category?: string;
    contexts?: readonly ClothingContextTag[];
  },
  _hints?: string,
): boolean {
  // Manual catalog picks always allow every entry; random rolls use clothingAllowedInScene.
  return true;
}

export function scoreClothingContextMatch(
  entryContexts: readonly ClothingContextTag[],
  preferredContexts: readonly ClothingContextTag[],
): number {
  if (preferredContexts.length === 0) {
    return 1;
  }

  let score = 0;
  for (const tag of preferredContexts) {
    if (entryContexts.includes(tag)) {
      score +=
        tag === "swimwear" ||
        tag === "intimate" ||
        tag === "hosiery" ||
        tag === "formalwear" ||
        tag === "sleepwear" ||
        tag === "underwear"
          ? 4
          : tag === "traditional"
            ? 3
            : 2;
    }
  }

  if (entryContexts.includes("casual") && preferredContexts.includes("casual")) {
    score += 1;
  }

  return score;
}

export function buildClothingCoherenceUserDirective(
  filters: ClothingPickFilters,
  outfitSummary: string,
): string {
  const genderLabel =
    filters.gender === "any"
      ? "the subject's natural presentation"
      : filters.gender === "women"
        ? "a woman"
        : "a man";

  return [
    "WARDROBE COHERENCE (mandatory):",
    `The subject reads clearly as ${genderLabel}.`,
    `Scene-appropriate clothing context: ${filters.contexts.join(", ")}.`,
    `Assigned wardrobe ingredients: ${outfitSummary}.`,
    "Weave these garments into the subject's description—do not open with a separate wardrobe paragraph.",
    "Name each garment briefly in the final prompt—short labels only, not long material paragraphs.",
    "Keep every assigned garment type in the final prompt.",
    "Adjust fit, layering, or weather-appropriate styling only when needed so clothing matches the subject's gender and the environment—do not swap to unrelated outfits.",
    filters.contexts.includes("swimwear")
      ? "Swimwear is appropriate here—keep coverage and styling realistic for a swim or poolside setting."
      : null,
    filters.contexts.includes("intimate")
      ? "Intimate apparel is appropriate in this private setting—keep fabrics, fit, and mood coherent with the scene."
      : null,
    filters.contexts.includes("formalwear") ||
      filters.contexts.includes("formal")
      ? "Formal or dressy attire fits this setting—keep tailoring, fabric weight, and accessories coherent with an elevated occasion."
      : null,
    filters.contexts.includes("hosiery")
      ? "Hosiery is appropriate here—render sheer or opaque texture, seam detail, and fit naturally with the rest of the outfit."
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}
