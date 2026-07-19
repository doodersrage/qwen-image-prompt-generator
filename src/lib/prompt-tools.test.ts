import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintPrompt } from "./prompt-diagnostics";
import { fixPromptRules } from "./prompt-fix";
import { mergeLocationExclusions } from "./location-exclusions";
import { buildOutfitFromLockedWardrobeId } from "./clothing-catalog";
import { buildNegativePrompt } from "./negative-prompt-builder";
import { applyPromptTemplate, getPromptTemplate } from "./prompt-templates";
import { getSportPreset, sportPresetsForMode } from "./sport-presets";
import { formatPromptPair, modelUsesNegativePrompt } from "./prompt-pair";
import { buildRegenerateUrl } from "./regenerate-url";
import { applyLockedLocation } from "./locked-location";
import { applyLockedVariationSeed } from "./locked-variation-seed";
import { composeScenePrompt } from "./scene-composer";
import { parseStudioBackupFile } from "./studio-backup";
import { compactPromptToLimit } from "./compact-prompt";
import {
  filterHistoryEntries,
  uniqueHistoryTags,
  uniqueHistoryTools,
} from "./history-filter";
import {
  buildScenePresetShareUrl,
  buildShareableSceneParams,
  parseScenePresetFromSearch,
} from "./scene-preset-url";
import { buildPromptSidecar, parsePromptSidecar } from "./prompt-sidecar";
import { previewWorkflowInjection } from "./comfyui-workflow-preview";
import { formatComfyUiJobStatusLine } from "./comfyui-job-status";
import { validateWorkflowJson, stripEmptyComfyUiRuntime, injectWorkflowPlaceholders } from "./comfyui-config";
import { extractImagesFromOutputs } from "./comfyui-outputs";
import {
  filterComfyGalleryEntries,
  paginateGalleryEntries,
  sortGalleryEntries,
} from "./comfyui-gallery";
import { listServerWorkflowPaths } from "./comfyui-server-workflows";
import {
  DEFAULT_COMFYUI_SETTINGS,
  comfyUiSettingsToRuntime,
} from "./comfyui-settings";
import type { ComfyWorkflowFile } from "./comfyui-workflow-files";
import { createScenePreset } from "./scene-presets";
import { createUserTemplate } from "./user-templates";
import { diffPromptWords } from "./prompt-diff";
import type { PromptHistoryEntry } from "@/hooks/usePromptHistory";
import { parseSettingHint } from "./hint-location";
import {
  buildRandomTopicPhrase,
  buildTemplateTopicList,
  normalizeTopicPhrase,
} from "./specialized/scene-pools";

describe("lintPrompt", () => {
  it("flags gravel + velodrome conflicts", () => {
    const result = lintPrompt({
      hints: "gravel cyclist duo race",
      prompt: "Two cyclists sprint on a velodrome banking turn in gravel kits.",
    });
    assert.ok(
      result.issues.some((issue) => issue.code === "cycling.gravel_velodrome"),
    );
  });

  it("flags missing cycling helmets", () => {
    const result = lintPrompt({
      hints: "road cyclist criterium",
      prompt: "A cyclist in white kit sprints through a wet corner.",
    });
    assert.ok(
      result.issues.some((issue) => issue.code === "cycling.missing_helmet"),
    );
  });

  it("infers gravel discipline from hints", () => {
    const result = lintPrompt({
      hints: "two female gravel cyclists racing on doubletrack",
      prompt:
        "On the left and right, two women in gravel kits with helmets charge a muddy fire road.",
    });
    assert.equal(result.inferred.sport, "cycling");
    assert.equal(result.inferred.cyclingDiscipline, "gravel");
    assert.equal(result.inferred.duoMode, true);
  });

  it("does not infer duo from lighting or object counts in the prompt", () => {
    const result = lintPrompt({
      hints: "beautiful woman in mini dress and tall heels",
      prompt:
        "A stunning woman stands near the forefront of a shallow studio space lit by two soft box speedlights from frame left, wearing a cropped wrap dress and stiletto heels.",
    });
    assert.equal(result.inferred.duoMode, false);
    assert.equal(result.inferred.peopleCount, null);
  });

  it("does not treat pair of shoes as a duo hint", () => {
    const result = lintPrompt({
      hints: "portrait of a woman in a pair of heels",
      prompt: "A woman in a red dress wears a pair of stiletto heels.",
    });
    assert.equal(result.inferred.duoMode, false);
  });
});

describe("fixPromptRules", () => {
  it("adds cycling helmets to bare-head prompts", () => {
    const result = fixPromptRules({
      hints: "gravel cyclist duo race",
      prompt:
        "On the left, a woman in white kit sprints; on the right, a rival in blue kit.",
    });
    assert.match(result.prompt, /helmet/i);
    assert.ok(result.changes.some((change) => change.code === "cycling.add_helmet"));
  });
});

describe("location exclusions", () => {
  it("merges recent and blocked locations without duplicates", () => {
    const merged = mergeLocationExclusions(
      ["Tokyo rooftop", "neon alley"],
      ["neon alley", "velodrome banking turn"],
    );
    assert.equal(merged.length, 3);
  });
});

describe("locked wardrobe", () => {
  it("builds outfit from catalog id", () => {
    const outfit = buildOutfitFromLockedWardrobeId("outfit-low-rise-rose-cycling-kit", {
      gender: "any",
      contexts: ["athletic"],
      athleticSport: "cycling",
    });
    assert.ok(outfit);
    assert.match(outfit!.summary, /helmet/i);
  });
});

describe("negative and templates", () => {
  it("builds cycling negatives", () => {
    const prompt = buildNegativePrompt({ sport: "cycling" });
    assert.match(prompt, /helmet|dress/i);
  });

  it("builds running negatives with bottom coverage", () => {
    const prompt = buildNegativePrompt({ sport: "running", soloSubject: true });
    assert.match(prompt, /missing running shorts|split screen/i);
    assert.match(prompt, /second person|wrong gender/i);
  });

  it("fills template slots", () => {
    const template = getPromptTemplate("duo-sport-race");
    assert.ok(template);
    const filled = applyPromptTemplate(template!.template, {
      gender: "women",
      sport: "gravel cycling",
      competition: "race",
      location: "a muddy doubletrack",
    });
    assert.match(filled, /women/i);
    assert.match(filled, /doubletrack/i);
  });

  it("loads sport presets", () => {
    const preset = getSportPreset("gravel-duo-race");
    assert.ok(preset?.duo);
    assert.match(preset!.hints, /gravel/i);
  });
});

describe("prompt pair export", () => {
  it("includes negative section for qwen models", () => {
    const text = formatPromptPair({
      positive: "A cyclist sprints.",
      negative: "blurry, watermark",
      model: "qwen-image-2512",
    });
    assert.match(text, /# Positive/);
    assert.match(text, /# Negative/);
    assert.match(text, /watermark/);
  });

  it("notes flux ignores negatives", () => {
    assert.equal(modelUsesNegativePrompt("flux-2-klein"), false);
    const text = formatPromptPair({
      positive: "Portrait in rain.",
      negative: "blurry",
      model: "flux-2-klein",
    });
    assert.match(text, /ignores negatives/i);
  });
});

describe("regenerate url", () => {
  it("routes duo history to duo page with hints", () => {
    const url = buildRegenerateUrl({
      id: "1",
      tool: "duo",
      prompt: "Two cyclists race.",
      hints: "gravel duo race",
      model: "qwen-image-2512",
      timestamp: Date.now(),
    });
    assert.match(url, /^\/duo\?/);
    assert.match(url, /hints=gravel/);
  });

  it("routes character entries to character page", () => {
    const url = buildRegenerateUrl({
      id: "2",
      tool: "character",
      prompt: "A woman on a rooftop.",
      hints: "young woman, rooftop",
      model: "qwen-image-2512",
      timestamp: Date.now(),
    });
    assert.match(url, /^\/character\?/);
  });
});

describe("locked location", () => {
  it("appends location hint when missing", () => {
    const merged = applyLockedLocation("young woman, long hair", "Tokyo rooftop at night");
    assert.match(merged!, /location:\s*Tokyo rooftop at night/i);
  });

  it("preserves explicit location in hints", () => {
    const merged = applyLockedLocation("location: neon alley", "Tokyo rooftop");
    assert.match(merged!, /location:\s*neon alley/i);
    assert.doesNotMatch(merged!, /Tokyo rooftop/);
  });
});

describe("sport preset modes", () => {
  it("filters solo presets", () => {
    const solo = sportPresetsForMode("solo");
    assert.ok(solo.every((preset) => !preset.duo));
    assert.ok(solo.some((preset) => preset.id === "gravel-solo"));
    assert.ok(solo.some((preset) => preset.id === "marathon-solo"));
    assert.ok(solo.some((preset) => preset.id === "trail-run-solo"));
  });

  it("filters running duo presets", () => {
    const duo = sportPresetsForMode("duo");
    const running = duo.filter((preset) => preset.category === "running");
    assert.equal(running.length, 4);
    assert.ok(running.some((preset) => preset.id === "running-duo"));
  });
});

describe("scene composer", () => {
  it("merges background and subject in layered mode", () => {
    const merged = composeScenePrompt({
      backgroundPrompt: "A misty pine forest at dawn.",
      subjectPrompt: "Two cyclists sprint through mud.",
      style: "layered",
    });
    assert.match(merged, /Two cyclists/);
    assert.match(merged, /misty pine forest/i);
  });
});

describe("locked variation seed", () => {
  it("uses locked seed when provided", () => {
    assert.equal(
      applyLockedVariationSeed("random roll", "pinned seed phrase"),
      "pinned seed phrase",
    );
  });
});

describe("regenerate url seed", () => {
  it("includes seed param for reproducible regenerate", () => {
    const url = buildRegenerateUrl({
      id: "3",
      tool: "duo",
      prompt: "Race prompt",
      hints: "gravel duo",
      model: "qwen-image-2512",
      timestamp: Date.now(),
      metadata: { seed: "velodrome banking, wet pavement" },
    });
    assert.match(url, /seed=/);
  });
});

describe("studio backup", () => {
  it("parses valid backup json", () => {
    const backup = parseStudioBackupFile(
      JSON.stringify({
        version: 1,
        exportedAt: new Date().toISOString(),
        history: [],
        locationBlocklist: ["velodrome"],
        settings: { shared: { model: "qwen-image-2512", detail: "balanced" }, tools: {} },
        scenePresets: [
          {
            id: "preset-1",
            name: "Night gravel",
            createdAt: Date.now(),
            hints: "gravel duo at night",
          },
        ],
      }),
    );
    assert.equal(backup.version, 1);
    assert.deepEqual(backup.locationBlocklist, ["velodrome"]);
    assert.equal(backup.scenePresets?.[0]?.name, "Night gravel");
  });

  it("parses v2 backup with comfyui extras", () => {
    const backup = parseStudioBackupFile(
      JSON.stringify({
        version: 2,
        exportedAt: new Date().toISOString(),
        history: [],
        locationBlocklist: [],
        settings: { shared: { model: "qwen-image-2512", detail: "balanced" }, tools: {} },
        comfyUiSettings: { useServerDefaults: false, apiUrl: "http://127.0.0.1:8188" },
        comfyGallery: [
          {
            id: "g1",
            promptId: "p1",
            prompt: "test",
            comfyUrl: "http://127.0.0.1:8188",
            status: "completed",
            queuedAt: 1,
            images: [],
          },
        ],
        comfyWorkflowPresets: [
          {
            id: "w1",
            name: "Default",
            createdAt: 1,
            workflowJson: '{"6":{"inputs":{"text":"{{POSITIVE}}"}}}',
          },
        ],
      }),
    );
    assert.equal(backup.version, 2);
    if (backup.version === 2) {
      assert.equal(backup.comfyUiSettings?.apiUrl, "http://127.0.0.1:8188");
      assert.equal(backup.comfyGallery?.length, 1);
      assert.equal(backup.comfyWorkflowPresets?.[0]?.name, "Default");
    }
  });
});

describe("compactPromptToLimit", () => {
  it("trims prompts longer than model detail limit", () => {
    const longPrompt = `${"A detailed gravel race scene with mud and rain. ".repeat(40)}`.trim();
    const result = compactPromptToLimit(longPrompt, "qwen-image-2512", "concise");
    assert.ok(result.afterChars <= result.maxChars);
    assert.ok(result.afterChars < result.beforeChars);
  });
});

describe("history filter", () => {
  const sample: PromptHistoryEntry[] = [
    {
      id: "1",
      tool: "duo",
      prompt: "A",
      model: "qwen-image-2512",
      timestamp: 1,
      favorite: true,
      rating: 5,
    },
    {
      id: "2",
      tool: "character",
      prompt: "B",
      model: "flux-2-klein",
      timestamp: 2,
      rating: 2,
    },
  ];

  it("filters favorites and tools", () => {
    const filtered = filterHistoryEntries(sample, {
      favoritesOnly: true,
      tool: "duo",
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.id, "1");
  });

  it("lists unique tools", () => {
    assert.deepEqual(uniqueHistoryTools(sample), ["character", "duo"]);
  });

  it("filters by tag", () => {
    const withTags: PromptHistoryEntry[] = [
      {
        id: "1",
        tool: "duo",
        prompt: "a",
        model: "qwen-image-2512",
        timestamp: 1,
        tags: ["race", "night"],
      },
      {
        id: "2",
        tool: "duo",
        prompt: "b",
        model: "qwen-image-2512",
        timestamp: 2,
        tags: ["portrait"],
      },
    ];
    assert.equal(filterHistoryEntries(withTags, { tag: "night" }).length, 1);
    assert.deepEqual(uniqueHistoryTags(withTags), ["night", "portrait", "race"]);
  });
});

describe("scene presets", () => {
  it("creates preset with shared locks", () => {
    const preset = createScenePreset({
      name: "Pinned kit",
      hints: "gravel sprint",
      sharedLocks: {
        lockedWardrobeId: "gravel-kit-01",
        lockedLocation: "forest doubletrack",
      },
    });
    assert.equal(preset.name, "Pinned kit");
    assert.ok(preset.id);
    assert.equal(preset.sharedLocks?.lockedLocation, "forest doubletrack");
  });
});

describe("user templates", () => {
  it("creates custom template entries", () => {
    const template = createUserTemplate({
      name: "Night race",
      template: "two cyclists racing at {{location}}",
    });
    assert.equal(template.label, "Night race");
    assert.match(template.id, /^user-/);
  });
});

describe("prompt diff", () => {
  it("marks changed words", () => {
    const diff = diffPromptWords(
      "two gravel cyclists racing",
      "two gravel cyclists racing with helmets",
    );
    assert.equal(diff.changed, true);
    assert.ok(diff.segments.some((segment) => segment.type === "add"));
  });
});

describe("scene preset share URL", () => {
  it("round-trips shareable scene params", () => {
    const params = buildShareableSceneParams({
      hints: "gravel sprint at dusk",
      sportPresetId: "gravel-duo",
      shared: {
        lockedWardrobeId: "kit-01",
        lockedLocation: "forest doubletrack",
        lockedVariationSeed: "seed-abc",
      },
    });
    const url = buildScenePresetShareUrl("/duo", params);
    const parsed = parseScenePresetFromSearch(url.slice(url.indexOf("?")));
    assert.deepEqual(parsed, params);
  });
});

describe("prompt sidecar", () => {
  it("builds versioned sidecar payload", () => {
    const sidecar = buildPromptSidecar({
      positive: "Two cyclists racing",
      model: "qwen-image-2512",
      tool: "duo",
      hints: "gravel sprint",
      comfyNode: "TextEncodeQwenImage",
    });
    assert.equal(sidecar.version, 1);
    assert.equal(sidecar.positive, "Two cyclists racing");
    assert.equal(sidecar.tool, "duo");
    assert.ok(sidecar.exportedAt);
  });

  it("parses valid sidecar files", () => {
    const sidecar = parsePromptSidecar(
      JSON.stringify({
        version: 1,
        exportedAt: new Date().toISOString(),
        positive: "Two cyclists racing",
        model: "qwen-image-2512",
        negative: "blurry",
        hints: "gravel duo",
      }),
    );
    assert.equal(sidecar.positive, "Two cyclists racing");
    assert.equal(sidecar.negative, "blurry");
  });

  it("rejects invalid sidecar files", () => {
    assert.throws(() => parsePromptSidecar("{}"));
  });
});

describe("comfyui workflow preview", () => {
  it("previews placeholder injection without queueing", () => {
    const preview = previewWorkflowInjection({
      prompt: "Two cyclists racing",
      negativePrompt: "blurry",
      params: {
        seed: "999",
        width: "768",
        height: "512",
        cfg: "6",
        steps: "24",
      },
      comfy: {
        workflowJson: JSON.stringify({
          "3": {
            class_type: "KSampler",
            inputs: { seed: "{{SEED}}", steps: "{{STEPS}}", cfg: "{{CFG}}" },
          },
          "5": {
            class_type: "EmptyLatentImage",
            inputs: { width: "{{WIDTH}}", height: "{{HEIGHT}}" },
          },
          "6": {
            class_type: "CLIPTextEncode",
            inputs: { text: "{{POSITIVE}}", clip: ["4", 0] },
          },
          "7": {
            class_type: "CLIPTextEncode",
            inputs: { text: "{{NEGATIVE}}", clip: ["4", 0] },
          },
        }),
      },
    });

    assert.equal(preview.ok, true);
    assert.equal(preview.replacements?.positive, 1);
    assert.equal(preview.replacements?.negative, 1);
    assert.equal(preview.resolvedParams?.seed, "999");
    assert.match(preview.workflowJson ?? "", /Two cyclists racing/);
  });
});

describe("comfyui workflow config", () => {
  const sampleWorkflow = JSON.stringify({
    "6": {
      class_type: "CLIPTextEncode",
      inputs: { text: "{{POSITIVE}}", clip: ["4", 0] },
    },
    "7": {
      class_type: "CLIPTextEncode",
      inputs: { text: "{{NEGATIVE}}", clip: ["4", 0] },
    },
  });

  it("validates API workflow JSON with placeholders", () => {
    const validation = validateWorkflowJson(sampleWorkflow);
    assert.equal(validation.ok, true);
    assert.deepEqual(validation.nodeIds, ["6", "7"]);
    assert.equal(validation.placeholders?.positive, 1);
    assert.equal(validation.placeholders?.negative, 1);
  });

  it("rejects workflows without a positive placeholder", () => {
    const validation = validateWorkflowJson(
      JSON.stringify({
        "6": { class_type: "CLIPTextEncode", inputs: { text: "", clip: ["4", 0] } },
      }),
    );
    assert.equal(validation.ok, false);
  });

  it("injects prompts via placeholder tokens anywhere in the tree", () => {
    const workflow = JSON.parse(sampleWorkflow) as Record<string, unknown>;
    const injected = injectWorkflowPlaceholders(
      workflow,
      { positive: "Two cyclists racing", negative: "blurry, watermark" },
      {
        positive: "{{POSITIVE}}",
        negative: "{{NEGATIVE}}",
        seed: "{{SEED}}",
        width: "{{WIDTH}}",
        height: "{{HEIGHT}}",
        cfg: "{{CFG}}",
        steps: "{{STEPS}}",
      },
    );
    assert.equal(injected.positiveReplacements, 1);
    assert.equal(injected.negativeReplacements, 1);
    const positiveNode = injected.workflow["6"] as { inputs: { text: string } };
    assert.equal(positiveNode.inputs.text, "Two cyclists racing");
  });

  it("injects queue parameter placeholders", () => {
    const workflow = {
      "3": {
        class_type: "KSampler",
        inputs: {
          seed: "{{SEED}}",
          steps: "{{STEPS}}",
          cfg: "{{CFG}}",
        },
      },
      "5": {
        class_type: "EmptyLatentImage",
        inputs: { width: "{{WIDTH}}", height: "{{HEIGHT}}" },
      },
      "6": {
        class_type: "CLIPTextEncode",
        inputs: { text: "{{POSITIVE}}", clip: ["4", 0] },
      },
    } satisfies Record<string, unknown>;

    const injected = injectWorkflowPlaceholders(
      workflow,
      {
        positive: "A rainy alley",
        params: {
          seed: "12345",
          width: "768",
          height: "512",
          cfg: "6.5",
          steps: "28",
        },
      },
      {
        positive: "{{POSITIVE}}",
        negative: "{{NEGATIVE}}",
        seed: "{{SEED}}",
        width: "{{WIDTH}}",
        height: "{{HEIGHT}}",
        cfg: "{{CFG}}",
        steps: "{{STEPS}}",
      },
    );

    assert.equal(injected.paramReplacements.seed, 1);
    assert.equal(injected.paramReplacements.width, 1);
    const sampler = injected.workflow["3"] as {
      inputs: { seed: string; steps: string; cfg: string };
    };
    assert.equal(sampler.inputs.seed, "12345");
    assert.equal(sampler.inputs.steps, "28");
    const latent = injected.workflow["5"] as {
      inputs: { width: string; height: string };
    };
    assert.equal(latent.inputs.width, "768");
    assert.equal(latent.inputs.height, "512");
  });

  it("injects custom workflow tokens", () => {
    const workflow = {
      "2": {
        class_type: "CheckpointLoaderSimple",
        inputs: { ckpt_name: "{{CHECKPOINT}}" },
      },
      "6": {
        class_type: "CLIPTextEncode",
        inputs: { text: "{{POSITIVE}}", clip: ["2", 0] },
      },
    } satisfies Record<string, unknown>;

    const injected = injectWorkflowPlaceholders(
      workflow,
      {
        positive: "A rainy alley",
        customTokens: [{ token: "{{CHECKPOINT}}", value: "flux1-dev.safetensors" }],
      },
      {
        positive: "{{POSITIVE}}",
        negative: "{{NEGATIVE}}",
        seed: "{{SEED}}",
        width: "{{WIDTH}}",
        height: "{{HEIGHT}}",
        cfg: "{{CFG}}",
        steps: "{{STEPS}}",
      },
    );

    assert.equal(injected.customReplacements?.["{{CHECKPOINT}}"], 1);
    const checkpoint = injected.workflow["2"] as {
      inputs: { ckpt_name: string };
    };
    assert.equal(checkpoint.inputs.ckpt_name, "flux1-dev.safetensors");
  });

  it("strips empty runtime overrides", () => {
    assert.equal(
      stripEmptyComfyUiRuntime({ apiUrl: "  ", positiveToken: "" }),
      undefined,
    );
    assert.deepEqual(stripEmptyComfyUiRuntime({ apiUrl: "http://127.0.0.1:8188" }), {
      apiUrl: "http://127.0.0.1:8188",
    });
  });
});

describe("comfyui workflow files", () => {
  it("builds runtime with only workflow json from a selected file", () => {
    const file: ComfyWorkflowFile = {
      id: "flux-main",
      name: "Flux main",
      createdAt: 1,
      workflowJson: '{"6":{"inputs":{"text":"{{POSITIVE}}"}}}',
    };

    const runtime = comfyUiSettingsToRuntime({
      ...DEFAULT_COMFYUI_SETTINGS,
      useServerDefaults: false,
      workflowJson: file.workflowJson,
    });

    assert.equal(runtime?.workflowJson, file.workflowJson);
    assert.match(runtime?.workflowJson ?? "", /POSITIVE/);
  });

  it("keeps server defaults when no workflow file is selected", () => {
    assert.equal(
      comfyUiSettingsToRuntime({
        ...DEFAULT_COMFYUI_SETTINGS,
        useServerDefaults: true,
      }),
      undefined,
    );
  });

  it("lists server workflow paths from env", () => {
    process.env.COMFYUI_WORKFLOW_PATHS = "workflows/a.json,workflows/b.json";
    assert.deepEqual(listServerWorkflowPaths(), [
      "workflows/a.json",
      "workflows/b.json",
    ]);
    delete process.env.COMFYUI_WORKFLOW_PATHS;
  });
});

describe("comfyui gallery outputs", () => {
  it("extracts image refs from ComfyUI history outputs", () => {
    const images = extractImagesFromOutputs({
      "9": {
        images: [
          { filename: "ComfyUI_00001_.png", subfolder: "", type: "output" },
        ],
      },
      "12": {
        images: [
          { filename: "preview.png", subfolder: "temp", type: "temp" },
        ],
      },
    });
    assert.equal(images.length, 2);
    assert.equal(images[0]?.filename, "ComfyUI_00001_.png");
  });

  it("filters gallery entries by status and favorites", () => {
    const entries = [
      {
        id: "1",
        promptId: "a",
        prompt: "one",
        comfyUrl: "http://127.0.0.1:8188",
        status: "completed" as const,
        queuedAt: 1,
        favorite: true,
        images: [],
      },
      {
        id: "2",
        promptId: "b",
        prompt: "two",
        comfyUrl: "http://127.0.0.1:8188",
        status: "pending" as const,
        queuedAt: 2,
        images: [],
      },
    ];
    assert.equal(
      filterComfyGalleryEntries(entries, { favoritesOnly: true }).length,
      1,
    );
    assert.equal(
      filterComfyGalleryEntries(entries, { status: "pending" }).length,
      1,
    );
    assert.equal(
      filterComfyGalleryEntries(entries, { query: "one" }).length,
      1,
    );
    assert.equal(
      filterComfyGalleryEntries(entries, { query: "duo" }).length,
      0,
    );
  });

  it("paginates gallery entries", () => {
    const entries = Array.from({ length: 25 }, (_, index) => `entry-${index}`);
    const page1 = paginateGalleryEntries(entries, 1, 12);
    assert.equal(page1.items.length, 12);
    assert.equal(page1.page, 1);
    assert.equal(page1.totalPages, 3);
    assert.equal(page1.items[0], "entry-0");

    const page3 = paginateGalleryEntries(entries, 3, 12);
    assert.equal(page3.items.length, 1);
    assert.equal(page3.items[0], "entry-24");

    const overflow = paginateGalleryEntries(entries, 99, 12);
    assert.equal(overflow.page, 3);
    assert.equal(overflow.items[0], "entry-24");
  });

  it("sorts gallery entries", () => {
    const entries = [
      {
        id: "1",
        promptId: "a",
        prompt: "alpha",
        tool: "duo",
        comfyUrl: "http://127.0.0.1:8188",
        status: "completed" as const,
        queuedAt: 100,
        completedAt: 300,
        favorite: false,
        images: [],
      },
      {
        id: "2",
        promptId: "b",
        prompt: "beta",
        tool: "character",
        comfyUrl: "http://127.0.0.1:8188",
        status: "completed" as const,
        queuedAt: 200,
        completedAt: 100,
        favorite: true,
        images: [],
      },
    ];

    assert.deepEqual(
      sortGalleryEntries(entries, "queued-desc").map((entry) => entry.id),
      ["2", "1"],
    );
    assert.deepEqual(
      sortGalleryEntries(entries, "queued-asc").map((entry) => entry.id),
      ["1", "2"],
    );
    assert.deepEqual(
      sortGalleryEntries(entries, "completed-desc").map((entry) => entry.id),
      ["1", "2"],
    );
    assert.deepEqual(
      sortGalleryEntries(entries, "tool-asc").map((entry) => entry.id),
      ["2", "1"],
    );
    assert.deepEqual(
      sortGalleryEntries(entries, "favorites-first").map((entry) => entry.id),
      ["2", "1"],
    );
  });
});

describe("comfyui job status formatting", () => {
  it("includes queue position while pending", () => {
    const line = formatComfyUiJobStatusLine({
      promptId: "abc-123",
      status: "pending",
      queuePosition: 2,
      statusMessage: "Queue position 2",
      comfyUrl: "http://127.0.0.1:8188",
    });
    assert.match(line, /Queued · position 2/);
    assert.match(line, /prompt_id abc-123/);
  });

  it("labels running jobs", () => {
    const line = formatComfyUiJobStatusLine({
      promptId: "abc-123",
      status: "running",
      queuePosition: 0,
      statusMessage: "Running now",
    });
    assert.match(line, /Running in ComfyUI/);
  });
});

describe("history search filter", () => {
  it("filters by query substring", () => {
    const sample: PromptHistoryEntry[] = [
      {
        id: "1",
        tool: "duo",
        prompt: "velodrome sprint",
        model: "qwen-image-2512",
        timestamp: 1,
      },
    ];
    assert.equal(
      filterHistoryEntries(sample, { query: "velodrome" }).length,
      1,
    );
    assert.equal(
      filterHistoryEntries(sample, { query: "gravel" }).length,
      0,
    );
  });
});

describe("topic phrase normalization", () => {
  it("collapses duplicated dash phrases", () => {
    assert.equal(
      normalizeTopicPhrase(
        "beautiful woman dressed for night on the town — beautiful woman dressed for night on the town",
      ),
      "beautiful woman dressed for night on the town",
    );
  });

  it("collapses duplicated in phrases", () => {
    assert.equal(
      normalizeTopicPhrase("neon alley in neon alley"),
      "neon alley",
    );
  });
});

describe("parseSettingHint for topic seeds", () => {
  it("does not treat subject-led seeds as standalone locations", () => {
    const parsed = parseSettingHint(
      "beautiful woman dressed for night on the town",
    );
    assert.equal(parsed.location, null);
    assert.equal(parsed.remainder, "beautiful woman dressed for night on the town");
  });
});

describe("buildRandomTopicPhrase", () => {
  it("never returns theme duplicated with an em dash", () => {
    const seed = "beautiful woman dressed for night on the town";
    const duplicatePattern = /^(.+)\s+[—–-]\s+\1$/i;
    for (let index = 0; index < 40; index += 1) {
      const { seed: phrase } = buildRandomTopicPhrase(seed, []);
      assert.equal(duplicatePattern.test(phrase), false, `duplicate dash phrase: ${phrase}`);
      assert.notEqual(
        phrase.toLowerCase(),
        `${seed.toLowerCase()} — ${seed.toLowerCase()}`,
      );
    }
  });
});

describe("buildTemplateTopicList", () => {
  it("returns unique normalized topics for subject seeds", () => {
    const topics = buildTemplateTopicList({
      seedTopic: "beautiful woman dressed for night on the town",
      count: 8,
    });
    const duplicatePattern = /^(.+)\s+[—–-]\s+\1$/i;
    assert.ok(topics.length >= 3);
    assert.equal(
      new Set(topics.map((topic) => topic.toLowerCase())).size,
      topics.length,
    );
    for (const topic of topics) {
      assert.equal(duplicatePattern.test(topic), false, `duplicate dash phrase: ${topic}`);
    }
  });
});
