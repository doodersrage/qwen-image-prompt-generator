type VariationPools = {
  subjects: string[];
  lighting: string[];
  framing: string[];
  atmosphere: string[];
  palette: string[];
};

const POOLS: VariationPools = {
  subjects: [
    "an elderly man with a creased face, silver stubble, and work-worn hands",
    "a young Black woman with box braids, high cheekbones, and gold hoop earrings",
    "a middle-aged Latina with gray-streaked hair, soft build, and laugh lines",
    "a tall androgynous person with a shaved side, sharp jawline, and a worn leather jacket",
    "a teenage East Asian boy with messy hair, freckles, and a shy half-smile",
    "an older South Asian woman in a bright sari, gentle eyes, and henna on her palms",
    "a muscular Polynesian man with traditional arm tattoos and sun-darkened skin",
    "a pale red-haired woman in her thirties, light dusting of freckles, cropped copper hair",
    "a stocky Mediterranean man with olive skin, thick beard, and rolled shirtsleeves",
    "a slender elderly woman with white hair in a loose bun, reading glasses, and steady posture",
    "a young nonbinary person with dyed teal undercut, angular features, and layered jewelry",
    "a heavyset middle-aged man with a bald head, warm expression, and paint-stained apron",
    "a lithe dancer in her twenties, deep brown skin, locs tied back, expressive hands",
    "a grizzled fisherman with rope-scarred fingers, salt-and-pepper beard, and squinting eyes",
    "a school-age girl with braids, gap-toothed grin, and scuffed sneakers",
  ],
  lighting: [
    "harsh midday sun casting crisp, short shadows",
    "soft overcast light with muted contrast",
    "golden-hour backlight with warm rim glow",
    "cool blue moonlight and deep shadow pools",
    "a single warm practical light source with falloff into darkness",
    "neon color spill mixing magenta and cyan across surfaces",
    "dappled light filtering through leaves or lattice",
    "storm-light with bruised purple clouds and sudden highlights",
    "candlelight flicker with warm amber pools on nearby surfaces",
    "early-morning fog diffusing pale sunlight",
  ],
  framing: [
    "a wide establishing view with layered depth",
    "a low angle looking upward for scale and drama",
    "a tight close framing on hands, face, or a key object",
    "an over-the-shoulder view opening into the scene beyond",
    "a slightly off-center asymmetric composition",
    "a bird's-eye perspective looking down into the space",
    "a three-quarter view with strong foreground-to-background separation",
    "a symmetrical centered composition with balanced negative space",
  ],
  atmosphere: [
    "quiet and contemplative",
    "charged with restless energy",
    "humid and heavy",
    "crisp and wind-swept",
    "dreamlike and slightly surreal",
    "gritty and lived-in",
    "serene and suspended in time",
    "tense, as if a moment before something happens",
    "celebratory and bright",
    "melancholic but beautiful",
  ],
  palette: [
    "rust, cream, and deep teal",
    "charcoal, silver, and a single red accent",
    "sun-faded ochre, sage, and dusty rose",
    "electric violet, acid green, and midnight blue",
    "warm amber, burnt sienna, and shadow brown",
    "ice blue, pale lavender, and soft white",
    "terracotta, olive, and sun-bleached sand",
    "ink black, pearl gray, and molten gold highlights",
  ],
};

function randomInt(max: number): number {
  if (max <= 0) return 0;
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

function pick<T>(items: T[]): T {
  return items[randomInt(items.length)]!;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

export function buildVariationSeed(): string {
  const subject = pick(POOLS.subjects);
  const lighting = pick(POOLS.lighting);
  const framing = pick(POOLS.framing);
  const atmosphere = pick(POOLS.atmosphere);
  const palette = pick(POOLS.palette);

  return [
    "Invent a fresh scene—do not reuse generic stock characters.",
    `If people belong in the scene, imagine someone like ${subject}; never default to the same young couple or anonymous model.`,
    `Light the scene with ${lighting}.`,
    `Compose it as ${framing}.`,
    `Atmosphere: ${atmosphere}. Color palette leaning toward ${palette}.`,
    "Vary age, ethnicity, body type, hair, clothing, and expression from prior generations.",
  ].join(" ");
}

export function pickFewShotExamples<T>(examples: T[], count = 2): T[] {
  return shuffle(examples).slice(0, Math.min(count, examples.length));
}

export function buildTemplateVariation(): string {
  const subject = pick(POOLS.subjects);
  const lighting = pick(POOLS.lighting);
  const palette = pick(POOLS.palette);

  return `When figures appear, describe ${subject} with specific, distinct features—not a generic default. ${capitalize(lighting)}. The palette favors ${palette}.`;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
