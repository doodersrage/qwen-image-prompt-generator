#!/usr/bin/env node
/**
 * Generate clothing catalog batch files for the character wardrobe library.
 *
 * Usage:
 *   node scripts/generate-clothing.mjs --count
 *   node scripts/generate-clothing.mjs --add 500
 *   node scripts/generate-clothing.mjs --target 3000
 */

import fs from "node:fs";
import path from "node:path";
import {
  accessories,
  bottoms,
  colors,
  details,
  fits,
  footwear,
  materials,
  outerwear,
  outfits,
  tops,
} from "./clothing-word-pools.mjs";
import { tagClothingEntry } from "./clothing-tag-utils.mjs";

const ROOT = process.cwd();
const LIB_DIR = path.join(ROOT, "src/lib");
const BATCH_INDEX = path.join(LIB_DIR, "clothing-catalog-batches.ts");
const CATALOG_GLOB = /^clothing-catalog-(\d+)\.ts$/;

const CATEGORY_QUOTAS = {
  outfit: 0.2,
  top: 0.18,
  bottom: 0.14,
  outerwear: 0.12,
  footwear: 0.18,
  accessory: 0.18,
};

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function parseArgs(argv) {
  const args = {
    count: false,
    add: null,
    target: null,
    seed: Date.now() & 0x7fffffff,
    dryRun: false,
    batch: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--count") args.count = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--add") args.add = Number(argv[++i]);
    else if (arg === "--target") args.target = Number(argv[++i]);
    else if (arg === "--seed") args.seed = Number(argv[++i]);
    else if (arg === "--batch") args.batch = Number(argv[++i]);
    else if (arg === "--help" || arg === "-h") args.help = true;
  }

  return args;
}

function printHelp() {
  console.log(`Generate clothing catalog entries for character wardrobe presets.

Options:
  --count              Print current catalog size
  --add <n>            Append <n> new entries (default: 500)
  --target <n>         Grow catalog until total unique entries reach <n>
  --batch <n>          Write specific batch number (auto if omitted)
  --seed <n>           RNG seed
  --dry-run            Preview without writing
  -h, --help           Show help

Examples:
  npm run clothing:count
  npm run clothing:generate
  npm run clothing:generate -- --target 3000
`);
}

function listCatalogFiles() {
  return fs
    .readdirSync(LIB_DIR)
    .filter((name) => CATALOG_GLOB.test(name))
    .sort(
      (a, b) =>
        Number(a.match(CATALOG_GLOB)?.[1] ?? "0") -
        Number(b.match(CATALOG_GLOB)?.[1] ?? "0"),
    );
}

function parseEntriesFromFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const entries = [];
  const re =
    /\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*category:\s*"([^"]+)",\s*script:\s*"([^"]*)"(?:,\s*gender:\s*"([^"]+)")?(?:,\s*contexts:\s*(\[[^\]]*\]))?\s*\}/g;

  for (const match of content.matchAll(re)) {
    const entry = {
      id: match[1],
      label: match[2],
      category: match[3],
      script: match[4],
    };

    if (match[5]) {
      entry.gender = match[5];
    }

    if (match[6]) {
      try {
        entry.contexts = JSON.parse(match[6]);
      } catch {
        entry.contexts = undefined;
      }
    }

    entries.push(tagClothingEntry(entry));
  }

  return entries;
}

function loadExistingCatalog() {
  const byId = new Map();
  const sources = [];

  for (const fileName of listCatalogFiles()) {
    const filePath = path.join(LIB_DIR, fileName);
    const entries = parseEntriesFromFile(filePath);
    for (const entry of entries) {
      byId.set(entry.id, entry);
    }
    sources.push({ label: fileName, count: entries.length });
  }

  return { byId, sources };
}

function nextBatchNumber(explicitBatch) {
  if (explicitBatch) return explicitBatch;
  const batches = listCatalogFiles().map((f) => Number(f.match(CATALOG_GLOB)?.[1] ?? "0"));
  return batches.length === 0 ? 1 : Math.max(...batches) + 1;
}

function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function buildPhrase(category, pick) {
  const color = pick(colors);
  const material = pick(materials);
  const detail = pick(details);
  const fit = pick(fits);

  if (category === "outfit") {
    const outfit = pick(outfits);
    return {
      label: `${fit} ${color} ${outfit}`,
      script: `a ${fit} ${color} ${outfit}, ${detail} and natural fabric creases`,
    };
  }

  if (category === "top") {
    const top = pick(tops);
    return {
      label: `${color} ${material} ${top}`,
      script: `a ${color} ${material} ${top}, ${detail} and natural fabric creases`,
    };
  }

  if (category === "bottom") {
    const bottom = pick(bottoms);
    return {
      label: `${color} ${bottom}`,
      script: `${color} ${bottom}, ${detail} and believable drape`,
    };
  }

  if (category === "outerwear") {
    const piece = pick(outerwear);
    return {
      label: `${color} ${material} ${piece}`,
      script: `a ${color} ${material} ${piece}, ${detail} and weight on the shoulders`,
    };
  }

  if (category === "footwear") {
    const shoe = pick(footwear);
    return {
      label: `${color} ${shoe}`,
      script: `${color} ${shoe}, showing sole wear, material scuffing, and believable weight on the foot`,
    };
  }

  const accessory = pick(accessories);
  return {
    label: `${color} ${accessory}`,
    script: `a ${color} ${accessory}, rendered with readable material weight, fine detail, and natural placement on the body`,
  };
}

function generateEntries(byId, countNeeded, seed) {
  const rand = createRng(seed);
  const pick = (items) => items[Math.floor(rand() * items.length)];
  const categories = Object.keys(CATEGORY_QUOTAS);
  const newEntries = [];
  let attempts = 0;
  const maxAttempts = Math.max(countNeeded * 50, 8000);

  while (newEntries.length < countNeeded && attempts < maxAttempts) {
    attempts += 1;
    const category = categories[attempts % categories.length];
    const phrase = buildPhrase(category, pick);
    const baseId = slugify(`${category}-${phrase.label}`);
    let id = baseId;
    let suffix = 1;

    while (byId.has(id)) {
      suffix += 1;
      id = `${baseId}-${suffix}`;
    }

    const entry = tagClothingEntry({
      id,
      label: phrase.label,
      category,
      script: phrase.script,
    });

    byId.set(id, entry);
    newEntries.push(entry);
  }

  if (newEntries.length < countNeeded) {
    throw new Error(
      `Only generated ${newEntries.length}/${countNeeded} entries. Try another --seed.`,
    );
  }

  return newEntries;
}

function writeBatchFile(batchNumber, entries) {
  const exportName = `CLOTHING_CATALOG_${batchNumber}`;
  const filePath = path.join(LIB_DIR, `clothing-catalog-${batchNumber}.ts`);
  const lines = entries.map(
    (entry) =>
      `  { id: ${JSON.stringify(entry.id)}, label: ${JSON.stringify(entry.label)}, category: ${JSON.stringify(entry.category)}, script: ${JSON.stringify(entry.script)}, gender: ${JSON.stringify(entry.gender)}, contexts: ${JSON.stringify(entry.contexts)} },`,
  );

  const content = [
    `/** Clothing catalog batch ${batchNumber}. Generated by scripts/generate-clothing.mjs */`,
    `export const ${exportName} = [`,
    ...lines,
    "] as const;",
    "",
  ].join("\n");

  fs.writeFileSync(filePath, content);
  return filePath;
}

function writeBatchIndex() {
  const files = listCatalogFiles();
  const imports = files
    .map((fileName) => {
      const batchNumber = Number(fileName.match(CATALOG_GLOB)?.[1] ?? "0");
      return `import { CLOTHING_CATALOG_${batchNumber} } from "./clothing-catalog-${batchNumber}";`;
    })
    .join("\n");

  const spreads = files
    .map((fileName) => {
      const batchNumber = Number(fileName.match(CATALOG_GLOB)?.[1] ?? "0");
      return `  ...(CLOTHING_CATALOG_${batchNumber} as readonly ClothingBatchEntry[]),`;
    })
    .join("\n");

  fs.writeFileSync(
    BATCH_INDEX,
    [
      "/** Auto-generated by scripts/generate-clothing.mjs — do not edit manually. */",
      imports,
      "",
      "type ClothingBatchEntry = {",
      "  readonly id: string;",
      "  readonly label: string;",
      "  readonly category: string;",
      "  readonly script: string;",
      "  readonly gender?: string;",
      "  readonly contexts?: readonly string[];",
      "};",
      "",
      "export const ALL_CLOTHING_CATALOG_ENTRIES: readonly ClothingBatchEntry[] = [",
      spreads,
      "];",
      "",
    ].join("\n"),
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const { byId, sources } = loadExistingCatalog();
  const currentTotal = byId.size;

  if (args.count) {
    console.log(`Clothing catalog entries: ${currentTotal}`);
    for (const source of sources) {
      console.log(`  ${source.label}: ${source.count}`);
    }
    const byCategory = {};
    for (const entry of byId.values()) {
      byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
    }
    console.log("By category:", byCategory);
    return;
  }

  let addCount = args.add;
  if (args.target != null) {
    addCount = Math.max(0, args.target - currentTotal);
    if (addCount === 0) {
      console.log(`Catalog already at ${currentTotal} entries (target ${args.target}).`);
      return;
    }
  }
  if (addCount == null || Number.isNaN(addCount) || addCount <= 0) {
    addCount = 500;
  }

  const batchNumber = nextBatchNumber(args.batch);
  const newEntries = generateEntries(new Map(byId), addCount, args.seed);

  console.log(`Current catalog: ${currentTotal}`);
  console.log(`Generated: ${newEntries.length}`);
  console.log(`New total: ${currentTotal + newEntries.length}`);
  console.log(`Batch: ${batchNumber}`);
  console.log(`Seed: ${args.seed}`);

  if (args.dryRun) {
    console.log("Dry run — no files written.");
    for (const sample of newEntries.slice(0, 5)) {
      console.log(`  [${sample.category}] ${sample.label}`);
    }
    return;
  }

  const written = writeBatchFile(batchNumber, newEntries);
  writeBatchIndex();
  console.log(`Wrote ${written}`);
  console.log(`Updated ${BATCH_INDEX}`);
}

main();
