import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGenerateWardrobeAssignments,
  buildGenerateWardrobeUserDirective,
} from "./generate-wardrobe";
import {
  collectWardrobeEntryIds,
  getClothingEntry,
  mergeWardrobeAssignmentsIntoPrompt,
  sanitizeCatalogScriptsInPrompt,
} from "./clothing-catalog";
import {
  buildClothingGuardrailLines,
  hintsLockPrimaryGarment,
  hintsSwimwearOnlyMode,
  hintsWorkWardrobeAllowed,
  inferWorkProfession,
} from "./clothing-tags";
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
