import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGenerateWardrobeAssignments,
  buildGenerateWardrobeUserDirective,
  mergeGenerateWardrobeIntoPrompt,
  refreshSportWardrobeAssignmentForPrompt,
} from "./generate-wardrobe";
import {
  collectWardrobeEntryIds,
  getClothingEntry,
  mergeWardrobeAssignmentsIntoPrompt,
  sanitizeCatalogScriptsInPrompt,
} from "./clothing-catalog";
import {
  buildClothingGuardrailLines,
  buildClothingPickFilters,
  hintsDescribeCyclingActivity,
  hintsLockPrimaryGarment,
  hintsSwimwearOnlyMode,
  hintsWorkWardrobeAllowed,
  inferAthleticSport,
  inferWorkProfession,
} from "./clothing-tags";
import { summaryMatchesSportWardrobe } from "./athletic-sport-profiles";
import {
  inferCyclingDiscipline,
  resolveAthleticSportForWardrobe,
  stripForeignSportActionsFromPrompt,
  stripIncompatibleCyclingVenuesFromPrompt,
} from "./athletic-sport-actions";
import { buildRandomCharacterSeed } from "./specialized/scene-pools";
import { pickRandomCharacterOutfit } from "./clothing-catalog";
import { DEFAULT_GENERATION_SETTINGS } from "./generation-settings";

describe("hintsLockPrimaryGarment", () => {
  it("locks on explicit garment phrases", () => {
    assert.equal(hintsLockPrimaryGarment("woman in a red bikini"), true);
    assert.equal(hintsLockPrimaryGarment("wearing a floor-length evening gown"), true);
  });

  it("does not lock on generic clothing tokens alone", () => {
    assert.equal(hintsLockPrimaryGarment("neon alley, rain, black cat"), false);
    assert.equal(hintsLockPrimaryGarment("vendor near the docks at dusk"), false);
    assert.equal(hintsLockPrimaryGarment("woman in a red top and jeans"), false);
  });
});

describe("work and swim context", () => {
  it("allows profession-only work wardrobe", () => {
    assert.equal(hintsWorkWardrobeAllowed("portrait of a chef"), true);
    assert.equal(inferWorkProfession("portrait of a chef in studio"), "chef");
  });

  it("detects swimwear-only beach context", () => {
    assert.equal(
      hintsSwimwearOnlyMode("tropical beach photoshoot", ["beach", "swimwear", "warm"]),
      true,
    );
  });
});

describe("multi-person wardrobe assignments", () => {
  it("builds distinct outfits for duo input", () => {
    const assignments = buildGenerateWardrobeAssignments(
      "two women on a rooftop bar",
      { ...DEFAULT_GENERATION_SETTINGS, distinctPeople: true },
      { assumePeople: true, forcedCount: 2, forcedDistinctPeople: true },
    );

    assert.ok(assignments && assignments.length === 2);
    assert.notEqual(assignments[0]?.summary, assignments[1]?.summary);
    assert.match(buildGenerateWardrobeUserDirective(assignments) ?? "", /Per-person scene rules/);
  });

  it("tracks bottom layer ids in outfit collection", () => {
    const ids = collectWardrobeEntryIds({
      wardrobeId: "top-1",
      bottomId: "bottom-1",
      footwearId: "shoe-1",
    });
    assert.deepEqual(ids, ["top-1", "bottom-1", "shoe-1"]);
  });
});

describe("merge and sanitize", () => {
  it("injects wardrobe for person 3 sentences", () => {
    const prompt =
      "Person on the left wears a red coat. Person on the right smiles. Person 3 watches from the center.";
    const merged = mergeWardrobeAssignmentsIntoPrompt(prompt, [
      { label: "person on the left", summary: "navy peacoat, black boots" },
      { label: "person on the right", summary: "olive field jacket, tan chinos" },
      { label: "person 3", summary: "charcoal hoodie, gray joggers" },
    ]);

    assert.match(merged, /Person 3 watches from the center, wearing charcoal hoodie, gray joggers\./i);
  });

  it("replaces catalog scripts with labels when entry id is known", () => {
    const entry = getClothingEntry("top-frost-lace-chef-coat");
    assert.ok(entry);
    const sanitized = sanitizeCatalogScriptsInPrompt(
      `She wears ${entry!.script} under warm light.`,
      [entry!.id],
    );
    assert.match(sanitized, new RegExp(entry!.label, "i"));
    assert.doesNotMatch(sanitized, /natural fabric creases/);
  });
});

describe("sport-specific wardrobe", () => {
  it("detects cycling activity from cyclist cues", () => {
    const corpus =
      "fierce female cyclist dives sideways during a competitive race on a dirt track";
    assert.equal(inferAthleticSport(corpus), "cycling");
    assert.equal(hintsDescribeCyclingActivity(corpus), true);
  });

  it("picks cycling kit pieces instead of track pants or soccer cleats", () => {
    const filters = buildClothingPickFilters({
      hints:
        "fierce female cyclist competitive race dirt track cleats ahead",
      environmentSeed: "female cyclist competitive race",
    });
    assert.equal(filters.athleticSport, "cycling");

    const outfit = pickRandomCharacterOutfit(filters);
    const summary = outfit.summary.toLowerCase();
    assert.doesNotMatch(summary, /track pants/);
    assert.doesNotMatch(summary, /soccer cleats/);
    assert.match(
      summary,
      /\b(?:cycling jersey|cycling kit|cycling bib shorts|bib shorts|cycling shoes)\b/,
    );
  });

  it("picks basketball jersey sets for basketball scenes", () => {
    const filters = buildClothingPickFilters({
      hints: "point guard driving to the hoop during an nba game",
      environmentSeed: "basketball player indoor court",
    });
    assert.equal(filters.athleticSport, "basketball");

    const outfit = pickRandomCharacterOutfit(filters);
    const summary = outfit.summary.toLowerCase();
    assert.match(summary, /\bbasketball jersey set\b/);
    assert.doesNotMatch(summary, /cycling kit/);
    assert.doesNotMatch(summary, /soccer cleats/);
  });

  it("picks judogi for martial arts scenes", () => {
    const filters = buildClothingPickFilters({
      hints: "karate student bowing in the dojo before sparring",
      environmentSeed: "martial arts dojo",
    });
    assert.equal(filters.athleticSport, "martial_arts");

    const outfit = pickRandomCharacterOutfit(filters);
    const summary = outfit.summary.toLowerCase();
    assert.match(summary, /\b(?:judogi|karate gi|dobok)\b/);
    assert.doesNotMatch(summary, /cycling bib shorts/);
    assert.doesNotMatch(summary, /track pants/);
  });

  it("picks climbing shoes for bouldering scenes", () => {
    const filters = buildClothingPickFilters({
      hints: "climber dynoing on an overhang during a bouldering session",
      environmentSeed: "indoor climbing wall",
    });
    assert.equal(filters.athleticSport, "climbing");

    const outfit = pickRandomCharacterOutfit(filters);
    const summary = outfit.summary.toLowerCase();
    assert.match(summary, /\bclimbing shoes\b/);
    assert.doesNotMatch(summary, /soccer cleats/);
    assert.doesNotMatch(summary, /cycling shoes/);
  });

  it("picks cycling kit for on-bike competition scenes without the word cyclist", () => {
    const filters = buildClothingPickFilters({
      hints: "woman on bike fierce competition solo race wet pavement",
      environmentSeed: "woman on bike fierce competition solo race wet pavement",
      gender: "women",
    });
    assert.equal(filters.athleticSport, "cycling");

    const outfit = pickRandomCharacterOutfit(filters);
    const summary = outfit.summary.toLowerCase();
    assert.doesNotMatch(summary, /track pants/);
    assert.doesNotMatch(summary, /running shoes/);
    assert.match(
      summary,
      /\b(?:cycling jersey|cycling kit|cycling bib shorts|bib shorts|cycling shoes|cleats)\b/,
    );
  });

  it("refreshes wrong generic athletic assignment when prompt clearly describes cycling", () => {
    const wrongAssignment = {
      summary: "mustard fleece mesh jersey, sepia track pants, oatmeal running shoes",
      filters: buildClothingPickFilters({
        hints: "fierce competition sprint race wet pavement snow",
        gender: "women",
      }),
    };
    const prompt =
      "A woman cyclist in a fierce competition sprints across the wet pavement. She wears a mustard fleece mesh jersey and sepia track pants. Her oatmeal running shoes grip the wet surface as she leans forward on the bike.";

    const refreshed = refreshSportWardrobeAssignmentForPrompt(prompt, wrongAssignment as never);
    assert.equal(refreshed.filters.athleticSport, "cycling");
    assert.equal(summaryMatchesSportWardrobe("cycling", refreshed.summary), true);
  });

  it("prefers track and field over cycling when javelin throw is in the scene", () => {
    const corpus =
      "fierce competition scene intense woman cyclist hurling a javelin mid-motion body rotating";
    assert.equal(inferAthleticSport(corpus), "track_field");

    const filters = buildClothingPickFilters({
      hints: corpus,
      environmentSeed: corpus,
      gender: "women",
    });
    assert.equal(filters.athleticSport, "track_field");

    const outfit = pickRandomCharacterOutfit(filters);
    const summary = outfit.summary.toLowerCase();
    assert.doesNotMatch(summary, /cycling kit/);
    assert.doesNotMatch(summary, /cycling bib shorts/);
    assert.doesNotMatch(summary, /climbing shoes/);
    assert.match(summary, /\b(?:running singlet|singlet|running shorts|track pants|running shoes)\b/);
  });

  it("does not treat endurance physique preset copy as cycling activity", () => {
    assert.equal(
      inferAthleticSport("athletic individual lean endurance-toned physique hurling javelin"),
      "track_field",
    );
    assert.equal(
      inferAthleticSport("athletic individual lean cyclist-toned physique portrait"),
      null,
    );
  });

  it("includes sport-specific guardrails in directives", () => {
    const lines = buildClothingGuardrailLines({
      gender: "women",
      contexts: ["athletic"],
      athleticActivity: true,
      athleticSport: "cycling",
    });
    assert.ok(lines.some((line) => line.includes("bib shorts")));
    assert.ok(lines.some((line) => line.includes("No track pants")));
  });
});

describe("character action seeds", () => {
  it("builds duo cycling competition seeds from two-cyclist hints", () => {
    const { seed } = buildRandomCharacterSeed(
      "two female cyclists in a fierce competition",
      "action",
    );
    assert.match(seed, /two subjects only/i);
    assert.match(seed, /two women/i);
    assert.match(seed, /wheel-to-wheel competition/i);
    assert.doesNotMatch(seed, /solo subject only/i);
    assert.doesNotMatch(seed, /javelin/i);
  });

  it("keeps gravel cyclists off velodromes in action seeds", () => {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const { seed, location } = buildRandomCharacterSeed(
        "gravel cyclist on a long adventure ride",
        "action",
      );
      assert.doesNotMatch(seed, /velodrome|banking turn|indoor track/i);
      assert.doesNotMatch(location, /velodrome|banking turn|indoor track/i);
      assert.match(
        seed,
        /gravel|fire road|doubletrack|rail-trail|unpaved|dirt|loose/i,
      );
    }
  });

  it("strips velodrome language from gravel cyclist prompts", () => {
    const polluted =
      "A gravel cyclist charges through a velodrome banking turn under harsh floodlights, wearing a dusty kit.";
    const cleaned = stripIncompatibleCyclingVenuesFromPrompt(
      polluted,
      "gravel cyclist adventure ride",
    );
    assert.doesNotMatch(cleaned, /velodrome|banking turn/i);
    assert.match(cleaned, /gravel|fire road|loose/i);
  });

  it("detects gravel discipline before generic road cycling", () => {
    assert.equal(inferCyclingDiscipline("gravel cyclist"), "gravel");
    assert.equal(inferCyclingDiscipline("road cyclist criterium"), "road");
    assert.equal(inferCyclingDiscipline("velodrome sprint"), "track");
    assert.equal(inferCyclingDiscipline("mountain biker on singletrack"), "mountain");
    assert.equal(inferCyclingDiscipline("downhill rider"), "mountain");
    assert.equal(inferCyclingDiscipline("generic cyclist sprint"), "road");
  });

  it("keeps mountain bikers on trail terrain in action seeds", () => {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const { seed, location } = buildRandomCharacterSeed(
        "mountain biker charging a rocky singletrack descent",
        "action",
      );
      assert.doesNotMatch(seed, /velodrome|city circuit|cobblestone race/i);
      assert.doesNotMatch(location, /velodrome|city circuit|cobblestone race/i);
      assert.match(seed, /singletrack|trail|rocky|alpine|flow trail|pine-needle/i);
    }
  });

  it("keeps road cyclists on paved race terrain in action seeds", () => {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const { seed, location } = buildRandomCharacterSeed(
        "road cyclist in a criterium sprint",
        "action",
      );
      assert.doesNotMatch(seed, /singletrack|fire road|doubletrack|velodrome/i);
      assert.doesNotMatch(location, /singletrack|fire road|doubletrack|velodrome/i);
      assert.match(
        seed,
        /city circuit|cobblestone|open road|road bike|racing bicycle|wet pavement/i,
      );
    }
  });

  it("strips foreign actions from basketball prompts", () => {
    const prompt =
      "Two players battle on court as one hurls a javelin across the hardwood while wearing a navy jersey.";
    const cleaned = stripForeignSportActionsFromPrompt(prompt, "basketball");
    assert.doesNotMatch(cleaned, /javelin/i);
    assert.match(cleaned, /jump shot|basketball|hardwood|court/i);
  });

  it("strips foreign actions from soccer prompts", () => {
    const prompt =
      "A midfielder pedaling hard on handlebars through the penalty area in full kit.";
    const cleaned = stripForeignSportActionsFromPrompt(prompt, "soccer");
    assert.doesNotMatch(cleaned, /pedaling|handlebars/i);
    assert.match(cleaned, /ball|kit|soccer|pitch|follow-through/i);
  });

  it("keeps cycling intent when the model hallucinates a javelin throw", () => {
    const intent = "two female cyclists in a fierce competition";
    const polluted =
      "A fierce competition scene with an intense woman cyclist hurling a javelin mid-motion, wearing cropped ivory cycling kit, rose cycling shoes.";
    assert.equal(
      resolveAthleticSportForWardrobe(intent, polluted, "cycling"),
      "cycling",
    );
    const assignment = {
      summary: "cropped ivory cycling kit, rose cycling shoes",
      filters: buildClothingPickFilters({ hints: intent, gender: "women" }),
    };
    const merged = mergeGenerateWardrobeIntoPrompt(
      polluted,
      [assignment],
      undefined,
      intent,
    );
    assert.doesNotMatch(merged, /javelin/i);
    assert.match(merged, /cycling kit/i);
  });
});

describe("buildClothingGuardrailLines", () => {
  it("includes athletic guardrails when activity is detected", () => {
    const lines = buildClothingGuardrailLines({
      gender: "any",
      contexts: ["athletic"],
      athleticActivity: true,
    });
    assert.ok(lines.some((line) => line.includes("Athletic activity")));
  });
});
