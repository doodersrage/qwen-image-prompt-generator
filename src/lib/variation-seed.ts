type VariationPools = {
  subjects: string[];
  lighting: string[];
  framing: string[];
  atmosphere: string[];
  palette: string[];
  styles: string[];
  eras: string[];
  lenses: string[];
  twists: string[];
  reinterpretations: string[];
  mandates: string[];
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
    "a wheelchair user with sharp features, buzzed hair, and a vintage bomber jacket",
    "a pregnant woman in her late thirties, curly auburn hair, linen dress, calm focus",
    "a street vendor with sun-creased skin, quick hands, and a stained apron",
    "a retired boxer with a flattened nose, gray temples, and quiet stillness",
    "a monk with a shaved head, deep brown robes, and ink-stained fingers",
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
    "sodium-vapor streetlight green cast on wet pavement",
    "lightning flash freezing motion for a split second",
    "projector light cutting through haze and dust",
    "underwater caustics rippling across surfaces",
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
    "a Dutch tilt that adds unease and motion",
    "extreme foreground obstruction with the subject beyond",
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
    "electric and unpredictable",
    "sacred and hushed",
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
    "copper, plum, and smoke gray",
    "lime, coral, and deep indigo",
  ],
  styles: [
    "documentary realism with unposed candid energy",
    "painterly impressionism with visible brushstroke logic",
    "cinematic widescreen still with anamorphic depth",
    "gritty street photography with grain and contrast",
    "soft romantic illustration with flowing edges",
    "hyper-detailed editorial fashion energy",
    "noir with crushed blacks and selective highlights",
    "surrealist dream logic with impossible scale shifts",
    "retro pulp cover boldness",
    "intimate indie film stillness",
  ],
  eras: [
    "a 1970s texture of film grain and faded warmth",
    "a near-future layer of worn tech and patched fabrics",
    "a 1920s elegance of art deco lines and polished surfaces",
    "a post-apocalyptic salvage aesthetic",
    "a timeless mythic past with no exact century",
    "a 1990s suburban mundane interrupted by something strange",
    "a colonial-era frontier roughness",
    "a solarpunk optimism of greenery and reclaimed materials",
  ],
  lenses: [
    "shot on a wide 24mm lens with environmental context",
    "compressed telephoto flattening layers at 85mm",
    "macro intimacy on a small telling detail",
    "fisheye distortion wrapping the space",
    "shallow depth of field isolating one sharp plane",
    "deep focus keeping foreground and horizon crisp",
  ],
  twists: [
    "a flock of paper birds caught mid-flight",
    "an obsolete object that should not belong there",
    "weather that contradicts the setting",
    "a mirror or window doubling the scene",
    "bioluminescence where none is expected",
    "evidence of a recent unseen event",
    "scale play—something tiny made monumental",
    "a stray animal behaving oddly",
    "architecture bleeding into nature",
    "light from two incompatible sources",
  ],
  reinterpretations: [
    "a mundane slice-of-life version of the topic",
    "a mythic or folkloric version of the topic",
    "a sci-fi reframing of the topic",
    "a horror-tinged version of the topic",
    "a tender romantic version of the topic",
    "a chaotic action-fragment version of the topic",
    "a minimalist version with few objects but strong mood",
    "a maximalist version overflowing with specific clutter",
  ],
  mandates: [
    "Push beyond the obvious first interpretation of the keywords.",
    "Surprise the viewer with at least one detail they would not expect.",
    "Avoid the most clichéd visual solution to this topic.",
    "Change the focal subject from what you would normally choose first.",
    "Open the description with an unusual detail, not a generic establishing line.",
    "Let one color or texture dominate unexpectedly.",
    "Make the scene feel like a specific place, not a stock backdrop.",
    "Give any person a specific job, habit, or tell visible in the frame.",
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

function sessionNonce(): string {
  const array = new Uint32Array(2);
  crypto.getRandomValues(array);
  return `${array[0]!.toString(36)}-${array[1]!.toString(36)}`;
}

export function buildVariationSeed(strength = 65): string {
  const parts: string[] = [];
  const wild = strength >= 75;
  const chaos = strength >= 90;

  parts.push(`Light the scene with ${pick(POOLS.lighting)}.`);
  parts.push(`Color palette leaning toward ${pick(POOLS.palette)}.`);
  parts.push(`Compose it as ${pick(POOLS.framing)}.`);
  parts.push(`Atmosphere: ${pick(POOLS.atmosphere)}.`);

  if (strength >= 35) {
    parts.push(
      `If people belong in the scene, imagine someone like ${pick(POOLS.subjects)}—specific, not generic.`,
    );
  }

  if (wild) {
    parts.push(
      `Or someone utterly unlike prior outputs, such as ${pick(POOLS.subjects)}—choose one and commit fully.`,
    );
    parts.push(`Visual style: ${pick(POOLS.styles)}.`);
    parts.push(`Era or world texture: ${pick(POOLS.eras)}.`);
    parts.push(`Camera feel: ${pick(POOLS.lenses)}.`);
    parts.push(`Weave in an unexpected detail: ${pick(POOLS.twists)}.`);
    parts.push(`Reinterpret the topic as ${pick(POOLS.reinterpretations)}.`);
    parts.push(pick(POOLS.mandates));
  }

  if (chaos) {
    parts.push(pick(POOLS.mandates));
    parts.push(pick(POOLS.mandates));
    parts.push(
      "Radically invent—never reuse default faces, couples, alley cats, beach walkers, or prior sentence structures.",
    );
    parts.push(
      "Vary who is centered, what action is happening, and how the scene opens from any previous generation.",
    );
    parts.push(`One-off composition id ${sessionNonce()}—must read as a unique image.`);
  } else if (strength >= 50) {
    parts.push(
      "Invent a fresh scene—vary age, ethnicity, body type, hair, clothing, and expression from prior generations.",
    );
  }

  return parts.join(" ");
}

export function buildVariationSystemAddendum(strength: number): string {
  if (strength < 55) {
    return "";
  }

  const lines = [pick(POOLS.mandates)];

  if (strength >= 75) {
    lines.push(
      "Treat repeated keywords as an excuse to explore a new angle, not to repeat prior wording or cast.",
    );
    lines.push(pick(POOLS.reinterpretations));
  }

  if (strength >= 90) {
    lines.push(
      "Maximize novelty: different opening line, different hero subject, different emotional temperature than your default.",
    );
  }

  return lines.join(" ");
}

export function pickFewShotExamples<T>(
  examples: T[],
  strength = 65,
  enabled = true,
): T[] {
  if (!enabled) {
    return examples;
  }

  if (strength >= 90) {
    return [];
  }

  if (strength >= 75) {
    return shuffle(examples).slice(0, 1);
  }

  if (strength <= 25) {
    return examples;
  }

  if (strength <= 50) {
    return shuffle(examples).slice(0, Math.min(3, examples.length));
  }

  return shuffle(examples).slice(0, Math.min(2, examples.length));
}

export function buildTemplateVariation(strength = 65): string {
  const parts: string[] = [
    capitalize(pick(POOLS.lighting)),
    `Palette favors ${pick(POOLS.palette)}.`,
    `Mood feels ${pick(POOLS.atmosphere)}.`,
  ];

  if (strength >= 45) {
    parts.push(
      `Figures, if any, resemble ${pick(POOLS.subjects)} with concrete, distinct features.`,
    );
  }

  if (strength >= 75) {
    parts.push(`Style leans ${pick(POOLS.styles)}.`);
    parts.push(`Include ${pick(POOLS.twists)}.`);
    parts.push(pick(POOLS.reinterpretations));
  }

  if (strength >= 90) {
    parts.push(`Also consider ${pick(POOLS.subjects)} instead of a generic default.`);
    parts.push(pick(POOLS.mandates));
  }

  return parts.join(" ");
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function getSamplingBoost(strength: number): {
  temperatureBoost: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
} {
  const t = strength / 100;

  return {
    temperatureBoost: t * 0.55,
    topP: 0.88 + t * 0.11,
    frequencyPenalty: t * 0.65,
    presencePenalty: t * 0.75,
  };
}
