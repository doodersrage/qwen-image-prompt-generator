const LOCATIONS = [
  "abandoned observatory on a windy cliff",
  "rain-slick cyberpunk alley with neon reflections",
  "sunlit greenhouse full of overgrown tropical plants",
  "marble train station at midnight",
  "desert roadside diner with cracked vinyl booths",
  "floating market under paper lanterns",
  "gothic library with spiral staircases and dust motes",
  "industrial warehouse converted into an art studio",
  "misty pine forest after rainfall",
  "rooftop garden overlooking a sprawling city",
  "underwater research tunnel with blue-green light",
  "snow-covered mountain lodge porch",
  "retro arcade with buzzing cabinets and carpet patterns",
  "cliffside monastery above cloud cover",
  "flooded cathedral nave with light through stained glass",
  "busy night market in a narrow street",
  "salt flats mirroring the sky at dawn",
  "Victorian greenhouse conservatory",
  "abandoned amusement park carousel",
  "canal-side café in a European old town",
];

const SUBJECTS = [
  "a street musician tuning a worn guitar",
  "a courier with a reflective jacket and scuffed boots",
  "a chef plating food under heat lamps",
  "a diver checking equipment beside a dock",
  "a painter mixing colors on a stained palette",
  "a botanist examining a strange flower",
  "a mechanic leaning over an open engine",
  "a dancer stretching before rehearsal",
  "a sailor coiling rope on a weathered deck",
  "a archivist carrying a stack of old maps",
];

const CHARACTER_POSES = [
  "standing with relaxed contrapposto",
  "seated on a simple wooden chair",
  "leaning against a plain wall",
  "kneeling on worn floorboards",
  "captured mid-step on empty pavement",
  "arms crossed with level shoulders",
  "looking over one shoulder",
  "hands resting in lap",
  "standing before a workbench",
  "perched on a low crate",
];

const CHARACTER_SETTINGS = [
  "a plain studio backdrop",
  "an empty sunlit room",
  "a quiet alley with no passersby",
  "a sparse workshop with tools but no staff",
  "a minimalist interior with clean lines",
  "a foggy open landscape with no figures in sight",
  "a rooftop at dusk with an empty skyline",
  "a soft-lit bedroom corner",
  "an abandoned corridor with peeling paint",
  "a small courtyard empty of other people",
];

const MOODS = [
  "quiet and contemplative",
  "charged with restless energy",
  "dreamlike and slightly surreal",
  "gritty and lived-in",
  "tense, as if a moment before something happens",
  "celebratory and bright",
  "melancholic but beautiful",
  "electric and unpredictable",
  "serene and suspended in time",
  "sacred and hushed",
];

const LIGHTING = [
  "golden-hour backlight with warm rim glow",
  "cool blue moonlight and deep shadow pools",
  "neon color spill mixing magenta and cyan",
  "soft overcast light with muted contrast",
  "candlelight flicker with warm amber pools",
  "harsh midday sun casting crisp shadows",
  "storm-light with bruised purple clouds",
  "early-morning fog diffusing pale sunlight",
  "projector light cutting through haze",
  "underwater caustics rippling across surfaces",
];

const WEATHER = [
  "after a recent rain",
  "during a light snowfall",
  "in humid summer heat",
  "with wind lifting dust and fabric",
  "under rolling thunderclouds",
  "in dense coastal fog",
  "during a dry desert breeze",
  "with cherry blossoms drifting through the air",
];

const BACKDROP_TYPES = [
  "interior architecture",
  "natural landscape",
  "urban streetscape",
  "industrial ruin",
  "coastal environment",
  "fantasy environment",
  "sci-fi environment",
  "historical setting",
];

const BACKGROUND_FEATURES = [
  "layered depth from foreground debris to distant horizon",
  "weathered textures on stone, wood, and metal surfaces",
  "atmospheric haze softening the far background",
  "strong leading lines drawing the eye inward",
  "pockets of warm practical light against cool ambient fill",
  "reflections on wet or polished surfaces",
  "vegetation encroaching on built structures",
  "signs of age, repair, and human use without visible people",
];

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

export function buildRandomSceneSeed(options: {
  genre?: string;
  includePeople?: boolean;
}): string {
  const parts = [
    pick(LOCATIONS),
    pick(WEATHER),
    pick(LIGHTING),
    pick(MOODS),
  ];

  if (options.includePeople !== false) {
    parts.unshift(pick(SUBJECTS));
  }

  if (options.genre?.trim()) {
    parts.unshift(options.genre.trim());
  }

  return parts.join(", ");
}

export function buildRandomBackgroundSeed(options: {
  settingType?: string;
  timeOfDay?: string;
  mood?: string;
}): string {
  const parts = [
    options.settingType?.trim() || pick(BACKDROP_TYPES),
    pick(LOCATIONS),
    options.timeOfDay?.trim() || pick(LIGHTING),
    options.mood?.trim() || pick(MOODS),
    pick(WEATHER),
    pick(BACKGROUND_FEATURES),
    "empty of people, figures, silhouettes, and crowds",
  ];

  return parts.join(", ");
}

export function buildRandomCharacterSeed(hints?: string): string {
  const parts = [
    "solo subject only, no other people anywhere",
    pick(CHARACTER_SETTINGS),
    pick(CHARACTER_POSES),
    pick(LIGHTING),
    pick(MOODS),
  ];

  if (!hints?.trim()) {
    parts.push("distinct face, clothing, posture, and expression");
  }

  return parts.join(", ");
}
