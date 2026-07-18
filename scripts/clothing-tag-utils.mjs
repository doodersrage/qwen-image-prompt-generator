const WOMEN_GARMENT =
  /\b(?:dress|gown|skirt|heels|stiletto|tutu|cocktail dress|evening gown|a-line skirt|fish-tail skirt|maxi skirt|mini skirt|pencil skirt|wrap skirt|romper|camisole|corset top|blouse|peasant blouse|wrap blouse|halter top|slip dress|shirt dress|sweater dress|dirndl|sari|salwar kameez|hanbok|flamenco dress|ballroom dance dress|mary jane|kitten heels|block heel pumps|ballet flats|leggings|yoga pants)\b/i;

const MEN_GARMENT =
  /\b(?:brogues|monk strap|oxford dress shoes|tuxedo|three-piece suit|boxer briefs|jockstrap|codpiece|necktie with suit|suspenders and tie|chore coat with work boots|cowboy boots with hat)\b/i;

const WOMEN_LEAN =
  /\b(?:crop top|off-shoulder|bodysuit|spaghetti strap|wrap dress|sequin gown|platform heels|thigh-high boots with skirt)\b/i;

const MEN_LEAN =
  /\b(?:rugby shirt|fatigue jacket|military fatigue|dress shirt and tie|suit jacket|sport coat|tweed sport coat|work chore coat|steel-toe boots|hi-vis safety vest)\b/i;

const CONTEXT_RULES = [
  { tag: "athletic", pattern: /\b(?:jersey|running|jogger|yoga|gym|cycling|soccer|cleats|track pants|sweatpants|sport|ski jacket|climbing|trail runner|basketball|fencing|dance kit|triathlon|workout|compression|goalkeeper|baseball uniform|hockey|swim|snorkel|cleats|mogul|parkour)\b/i },
  { tag: "formal", pattern: /\b(?:suit|tuxedo|gown|cocktail|blazer|oxford dress|brogues|monk strap|evening wear|wedding|pencil skirt|sport coat|tailcoat|formal wear|three-piece|evening gown|cocktail dress)\b/i },
  { tag: "evening", pattern: /\b(?:cocktail|evening gown|sequin|silk slip|stiletto|heels|gown|tuxedo|smoking jacket|ballroom|satin slip|pearl necklace|clutch)\b/i },
  { tag: "outdoor", pattern: /\b(?:hiking|trail|parka|puffer|anorak|fleece|gore-tex|windbreaker|cargo pants|work boots|mountain shell|rain slicker|field jacket|cagoule|poncho|bandana|sun hat|straw hat|backpack|climbing|camp|safari|gorpcore)\b/i },
  { tag: "cold", pattern: /\b(?:parka|puffer|wool|fleece|peacoat|duffle coat|shearling|down|beanie|scarf|mittens|balaclava|moon boots|overcoat|quilted|insulated|ear muffs|winter)\b/i },
  { tag: "warm", pattern: /\b(?:shorts|sandals|flip-flops|tank top|linen|hawaiian shirt|board shorts|muscle tank|racerback|espadrilles|sun hat|crop top|sleeveless|mesh jersey|sleeveless)\b/i },
  { tag: "wet", pattern: /\b(?:rain|slicker|wellington|rubber boots|gore-tex|poncho|oilskin|waterproof|hardshell|rain boots|cagoule|packable shell)\b/i },
  { tag: "work", pattern: /\b(?:coveralls|overalls|workbench|apron|hi-vis|safety vest|tool belt|mechanic|chef|barista|warehouse|scrubs|lab coat|barber|butcher|forge|paint-stained|work boots|steel-toe|utilitarian|chore coat|boiler suit)\b/i },
  { tag: "uniform", pattern: /\b(?:uniform|kit|gi|dobok|judogi|karate|scrubs|police|military|firefighter|turnout|pilot|flight attendant|nurse|paramedic|chef whites|server room|bellhop|postal|mail carrier|referee|umpire)\b/i },
  { tag: "costume", pattern: /\b(?:wizard|knight|armor|circus|magician|monk robes|nun habit|cosplay|vampire|steampunk|elven|dwarven|halloween|renaissance faire|mermaid|superhero|ballerina tutu)\b/i },
  { tag: "beach", pattern: /\b(?:board shorts|flip-flops|sarong|snorkel|bikini|swim trunks|rash guard|beach|coastal|linen camp shirt|espadrilles|sun hat|cover-up)\b/i },
  { tag: "urban", pattern: /\b(?:streetwear|techwear|hoodie|denim jacket|leather jacket|bomber|sneakers|crossbody|snapback|cargo pants|oversized fit|y2k|grunge|cyberpunk|neon|metro|skateboard|parkour)\b/i },
  { tag: "casual", pattern: /\b(?:tee|t-shirt|henley|jeans|chinos|hoodie|sneakers|flannel|cardigan|loafers|casual|everyday|relaxed-fit)\b/i },
];

export function inferClothingGender(text) {
  const value = text.toLowerCase();
  let womenScore = 0;
  let menScore = 0;

  if (WOMEN_GARMENT.test(value)) womenScore += 3;
  if (WOMEN_LEAN.test(value)) womenScore += 2;
  if (MEN_GARMENT.test(value)) menScore += 3;
  if (MEN_LEAN.test(value)) menScore += 2;

  if (/\b(?:ball gown|prom dress|bridesmaid|maternity dress)\b/i.test(value)) {
    womenScore += 4;
  }
  if (/\b(?:tuxedo|cummerbund|dress shirt and tie)\b/i.test(value)) {
    menScore += 2;
  }

  if (womenScore >= menScore + 2) return "women";
  if (menScore >= womenScore + 2) return "men";
  return "neutral";
}

export function inferClothingContexts(text) {
  const value = text.toLowerCase();
  const tags = new Set();

  for (const rule of CONTEXT_RULES) {
    if (rule.pattern.test(value)) {
      tags.add(rule.tag);
    }
  }

  if (tags.size === 0) {
    tags.add("casual");
  }

  return [...tags];
}

export function tagClothingEntry(entry) {
  const text = `${entry.label} ${entry.script}`;
  return {
    ...entry,
    gender: entry.gender ?? inferClothingGender(text),
    contexts: entry.contexts?.length
      ? entry.contexts
      : inferClothingContexts(text),
  };
}
