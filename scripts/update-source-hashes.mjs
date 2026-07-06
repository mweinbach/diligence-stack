#!/usr/bin/env node
// update-source-hashes.mjs - recompute the `sourceHash` of every plugins[]/skills[] entry in
// .agents/plugins/marketplace.json, or verify them with --check.
//
// The hash reproduces Cowork's computeSourceRootHash (src/extensions/sourceFingerprint.ts)
// byte-for-byte: sha256 seeded with "cowork-source-root-v1\0"; sorted directory traversal;
// each file framed as `file\0<posix-path>\0<bytes>\0`; each symlink as
// `symlink\0<path>\0<target>\0`; ignoring .git, .DS_Store, .cowork-skill.json, names containing
// ".incoming-" or ".backup-", and .cowork-plugin/install.json / .codex-plugin/install.json.
// Cowork verifies plugin installs against this hash (a stale value fails the install with
// "Marketplace source hash mismatch") and uses it to surface "Update available".
//
// Standalone: no dependencies; runs under `node` or `bun`.
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const USAGE = `usage: node update-source-hashes.mjs [--check] [repo-root]

Recompute (default) or verify (--check) the sourceHash of every plugins[] and
skills[] entry in <repo-root>/.agents/plugins/marketplace.json.

  --check      do not write; exit 1 listing entries whose sourceHash is stale
  --help, -h   show this help
  repo-root    marketplace repo root (default: current directory)

Exit codes: 0 = hashes current (or updated), 1 = stale hashes under --check,
2 = usage or IO error.`;

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(USAGE);
  process.exit(0);
}
const checkOnly = args.includes("--check");
const positional = args.filter((arg) => !arg.startsWith("-"));
if (positional.length > 1 || args.some((arg) => arg.startsWith("-") && arg !== "--check")) {
  console.error(USAGE);
  process.exit(2);
}
const repoRoot = path.resolve(positional[0] ?? process.cwd());
const marketplacePath = path.join(repoRoot, ".agents", "plugins", "marketplace.json");

function shouldIgnoreEntry(relativePath, name) {
  if (
    name === ".git" ||
    name === ".DS_Store" ||
    name === ".cowork-skill.json" ||
    name.includes(".incoming-") ||
    name.includes(".backup-")
  ) {
    return true;
  }

  const normalized = relativePath.split(path.sep).join("/");
  return (
    normalized === ".cowork-plugin/install.json" ||
    normalized === ".codex-plugin/install.json" ||
    normalized.endsWith("/.cowork-plugin/install.json") ||
    normalized.endsWith("/.codex-plugin/install.json")
  );
}

async function updateHashForPath(hash, rootDir, relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  const stat = await fs.lstat(absolutePath);
  const stablePath = relativePath.split(path.sep).join("/");
  const name = path.basename(relativePath);

  if (shouldIgnoreEntry(relativePath, name)) {
    return;
  }

  if (stat.isDirectory()) {
    const entries = await fs.readdir(absolutePath, { withFileTypes: true, encoding: "utf8" });
    const sortedEntries = entries
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
    for (const entryName of sortedEntries) {
      await updateHashForPath(hash, rootDir, path.join(relativePath, entryName));
    }
    return;
  }

  if (stat.isSymbolicLink()) {
    const target = await fs.readlink(absolutePath);
    hash.update(`symlink\0${stablePath}\0${target}\0`);
    return;
  }

  if (!stat.isFile()) {
    return;
  }

  hash.update(`file\0${stablePath}\0`);
  hash.update(await fs.readFile(absolutePath));
  hash.update("\0");
}

async function computeSourceRootHash(rootDir) {
  const hash = createHash("sha256");
  hash.update("cowork-source-root-v1\0");
  await updateHashForPath(hash, path.resolve(rootDir), ".");
  return `sha256:${hash.digest("hex")}`;
}

function resolveLocalSourcePath(entry) {
  if (entry?.source?.source !== "local" || typeof entry.source.path !== "string") {
    return null;
  }
  return path.resolve(repoRoot, entry.source.path);
}

function withSourceHash(entry, sourceHash) {
  const nextEntry = {};
  let inserted = false;
  for (const [key, value] of Object.entries(entry)) {
    if (key === "sourceHash") {
      continue;
    }
    nextEntry[key] = value;
    if (key === "source") {
      nextEntry.sourceHash = sourceHash;
      inserted = true;
    }
  }
  if (!inserted) {
    nextEntry.sourceHash = sourceHash;
  }
  return nextEntry;
}

async function updateEntries(entries, label) {
  const updatedEntries = [];
  const changes = [];
  for (const entry of entries ?? []) {
    const sourcePath = resolveLocalSourcePath(entry);
    if (!sourcePath) {
      updatedEntries.push(entry);
      continue;
    }
    const sourceHash = await computeSourceRootHash(sourcePath);
    if (entry.sourceHash !== sourceHash) {
      changes.push(`${label}/${entry.name}: ${entry.sourceHash ?? "(missing)"} -> ${sourceHash}`);
    }
    updatedEntries.push(withSourceHash(entry, sourceHash));
  }
  return { updatedEntries, changes };
}

let raw;
try {
  raw = await fs.readFile(marketplacePath, "utf8");
} catch (error) {
  console.error(`Cannot read ${marketplacePath}: ${String(error)}`);
  process.exit(2);
}
let marketplace;
try {
  marketplace = JSON.parse(raw);
} catch (error) {
  console.error(`Invalid JSON in ${marketplacePath}: ${String(error)}`);
  process.exit(2);
}
const pluginResult = await updateEntries(marketplace.plugins, "plugins");
const skillResult = await updateEntries(marketplace.skills, "skills");
const updatedMarketplace = {
  ...marketplace,
  plugins: pluginResult.updatedEntries,
  ...(marketplace.skills !== undefined ? { skills: skillResult.updatedEntries } : {}),
};
const updatedRaw = `${JSON.stringify(updatedMarketplace, null, 2)}\n`;
const changes = [...pluginResult.changes, ...skillResult.changes];

if (checkOnly) {
  if (raw !== updatedRaw) {
    console.error("Marketplace source hashes are out of date:");
    for (const change of changes) {
      console.error(`- ${change}`);
    }
    process.exit(1);
  }
  console.log("Marketplace source hashes are current.");
} else {
  await fs.writeFile(marketplacePath, updatedRaw, "utf8");
  if (changes.length === 0) {
    console.log("Marketplace source hashes were already current.");
  } else {
    console.log(
      `Updated ${changes.length} marketplace source hash${changes.length === 1 ? "" : "es"}.`,
    );
    for (const change of changes) {
      console.log(`- ${change}`);
    }
  }
}