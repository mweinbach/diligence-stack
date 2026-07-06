#!/usr/bin/env node
// validate-marketplace.mjs - check that a marketplace repo will be accepted by Cowork.
//
// Reproduces the strict rules of Cowork's marketplace parser (src/plugins/marketplace.ts):
// top-level `name` + `plugins` (+ optional `interface`, `skills`), strict entry shape
// (`name`, `source`, `policy`, `category`, optional `interface`/`sourceHash`), `./`-relative
// source paths that stay inside the repo - plus content checks the parser defers to install
// time: each source path exists, plugin entries carry a .cowork-plugin/plugin.json (or
// .codex-plugin/plugin.json), skill entries carry a SKILL.md whose frontmatter `name` equals
// the directory name, every `sourceHash` matches a fresh recompute, and names are unique.
//
// Standalone: no dependencies; runs under `node` or `bun`.
//
// Usage:  node validate-marketplace.mjs [repo-root]
// Exit:   0 = valid, 1 = invalid, 2 = usage/IO error.
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const SOURCE_HASH_RE = /^sha256:[a-f0-9]{64}$/;
const SKILL_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FRONTMATTER_RE = /^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/;

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("usage: node validate-marketplace.mjs [repo-root]");
  process.exit(0);
}
if (args.length > 1 || args.some((arg) => arg.startsWith("-"))) {
  console.error("usage: node validate-marketplace.mjs [repo-root]");
  process.exit(2);
}
const repoRoot = path.resolve(args[0] ?? process.cwd());
const marketplacePath = path.join(repoRoot, ".agents", "plugins", "marketplace.json");

const errors = [];
const warnings = [];

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function checkStrictKeys(obj, allowed, label) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      errors.push(`${label}: unrecognized key "${key}" (the parser is strict and rejects it)`);
    }
  }
}

// --- Hashing: identical to Cowork's computeSourceRootHash (sourceFingerprint.ts) ---

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

// --- Minimal frontmatter reading (top-level single-line scalars only) ---

function readFrontmatterScalar(frontmatterRaw, key) {
  for (const line of frontmatterRaw.split(/\r?\n/)) {
    const match = line.match(new RegExp(`^${key}:\\s*(.*)$`));
    if (!match) continue;
    let value = match[1].trim();
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      try {
        value = JSON.parse(value);
      } catch {
        value = value.slice(1, -1);
      }
    } else if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
      value = value.slice(1, -1).replace(/''/g, "'");
    }
    return value;
  }
  return null;
}

// --- Entry validation ---

function validateEntryShape(entry, label) {
  if (!isPlainObject(entry)) {
    errors.push(`${label}: entry must be an object`);
    return false;
  }
  checkStrictKeys(entry, ["name", "source", "policy", "category", "interface", "sourceHash"], label);
  let ok = true;
  if (!isNonEmptyString(entry.name)) {
    errors.push(`${label}: "name" is required and must be a non-empty string`);
    ok = false;
  }
  if (!isPlainObject(entry.source)) {
    errors.push(`${label}: "source" is required and must be an object`);
    ok = false;
  } else {
    checkStrictKeys(entry.source, ["source", "path"], `${label}.source`);
    if (entry.source.source !== "local") {
      errors.push(`${label}: source.source must be the literal "local"`);
      ok = false;
    }
    if (!isNonEmptyString(entry.source.path)) {
      errors.push(`${label}: source.path is required and must be a non-empty string`);
      ok = false;
    }
  }
  if (!isPlainObject(entry.policy)) {
    errors.push(`${label}: "policy" is required and must be an object`);
  } else {
    checkStrictKeys(entry.policy, ["installation", "authentication"], `${label}.policy`);
    if (!isNonEmptyString(entry.policy.installation)) {
      errors.push(`${label}: policy.installation is required and must be a non-empty string`);
    }
    if (!isNonEmptyString(entry.policy.authentication)) {
      errors.push(`${label}: policy.authentication is required and must be a non-empty string`);
    }
  }
  if (!isNonEmptyString(entry.category)) {
    errors.push(`${label}: "category" is required and must be a non-empty string`);
  }
  if (entry.interface !== undefined) {
    if (!isPlainObject(entry.interface)) {
      errors.push(`${label}: "interface", if present, must be an object`);
    } else {
      checkStrictKeys(
        entry.interface,
        ["displayName", "icon", "logo", "brandColor"],
        `${label}.interface`,
      );
      for (const [key, value] of Object.entries(entry.interface)) {
        if (!isNonEmptyString(value)) {
          errors.push(`${label}: interface.${key} must be a non-empty string`);
        }
      }
    }
  }
  if (entry.sourceHash !== undefined && !SOURCE_HASH_RE.test(String(entry.sourceHash))) {
    errors.push(`${label}: sourceHash must match "sha256:<64 lowercase hex chars>"`);
  }
  return ok;
}

function resolveEntrySourceDir(entry, label) {
  const raw = entry.source.path;
  if (!raw.startsWith("./")) {
    errors.push(`${label}: source.path must start with "./" (got "${raw}")`);
    return null;
  }
  const normalized = path.posix.normalize(raw);
  if (path.posix.isAbsolute(normalized) || normalized === ".." || normalized.startsWith("../")) {
    errors.push(`${label}: source.path resolves outside the marketplace root ("${raw}")`);
    return null;
  }
  return path.resolve(repoRoot, normalized);
}

async function validatePluginContent(sourceDir, label) {
  const manifestCandidates = [
    path.join(sourceDir, ".cowork-plugin", "plugin.json"),
    path.join(sourceDir, ".codex-plugin", "plugin.json"),
  ];
  for (const candidate of manifestCandidates) {
    let raw;
    try {
      raw = await fs.readFile(candidate, "utf8");
    } catch {
      continue;
    }
    try {
      JSON.parse(raw);
    } catch (error) {
      errors.push(`${label}: ${path.relative(repoRoot, candidate)} is not valid JSON: ${String(error)}`);
    }
    return;
  }
  errors.push(
    `${label}: missing .cowork-plugin/plugin.json (or .codex-plugin/plugin.json) under ${path.relative(repoRoot, sourceDir)}`,
  );
}

async function validateSkillContent(sourceDir, label) {
  const skillMdPath = path.join(sourceDir, "SKILL.md");
  let raw;
  try {
    raw = await fs.readFile(skillMdPath, "utf8");
  } catch {
    errors.push(`${label}: missing SKILL.md under ${path.relative(repoRoot, sourceDir)}`);
    return;
  }
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    errors.push(`${label}: SKILL.md has no YAML frontmatter (must start with a --- fenced block)`);
    return;
  }
  const dirName = path.basename(sourceDir);
  const name = readFrontmatterScalar(match[1], "name");
  if (name === null) {
    errors.push(`${label}: SKILL.md frontmatter has no top-level "name" key`);
  } else {
    if (!SKILL_NAME_RE.test(name) || name.length > 64) {
      errors.push(`${label}: frontmatter name "${name}" must be kebab-case and 1-64 chars`);
    }
    if (name !== dirName) {
      errors.push(`${label}: frontmatter name "${name}" must equal the directory name "${dirName}"`);
    }
  }
  const description = readFrontmatterScalar(match[1], "description");
  if (description === null) {
    errors.push(`${label}: SKILL.md frontmatter has no top-level "description" key`);
  } else if (description.trim().length < 1 || description.trim().length > 1024) {
    errors.push(`${label}: frontmatter description must be 1-1024 chars (got ${description.trim().length})`);
  }
}

async function validateEntries(entries, kind) {
  const seen = new Set();
  for (const entry of entries) {
    const label = `${kind}.${isPlainObject(entry) && isNonEmptyString(entry.name) ? entry.name : "(unnamed)"}`;
    if (!validateEntryShape(entry, label)) {
      continue;
    }
    if (seen.has(entry.name)) {
      errors.push(`${label}: duplicate "name" within ${kind}[]`);
    }
    seen.add(entry.name);

    const sourceDir = resolveEntrySourceDir(entry, label);
    if (!sourceDir) continue;

    let stat;
    try {
      stat = await fs.stat(sourceDir);
    } catch {
      errors.push(`${label}: source.path "${entry.source.path}" does not exist`);
      continue;
    }
    if (!stat.isDirectory()) {
      errors.push(`${label}: source.path "${entry.source.path}" is not a directory`);
      continue;
    }

    if (kind === "plugins") {
      await validatePluginContent(sourceDir, label);
    } else {
      await validateSkillContent(sourceDir, label);
    }

    const actualHash = await computeSourceRootHash(sourceDir);
    if (entry.sourceHash === undefined) {
      warnings.push(
        `${label}: no sourceHash published - installs skip verification and update detection is disabled (expected ${actualHash})`,
      );
    } else if (entry.sourceHash !== actualHash) {
      errors.push(
        `${label}: stale sourceHash - manifest has ${entry.sourceHash}, content hashes to ${actualHash}; run update-source-hashes.mjs`,
      );
    }
  }
}

async function main() {
  console.log(`Validating marketplace: ${repoRoot}`);

  let raw;
  try {
    raw = await fs.readFile(marketplacePath, "utf8");
  } catch {
    console.error(`  ERROR missing manifest (expected ${marketplacePath})`);
    process.exit(2);
  }

  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (error) {
    console.error(`  ERROR manifest is not valid JSON: ${String(error)}`);
    process.exit(1);
  }

  if (!isPlainObject(doc)) {
    errors.push("manifest: root must be a JSON object");
  } else {
    checkStrictKeys(doc, ["name", "interface", "plugins", "skills"], "manifest");
    if (!isNonEmptyString(doc.name)) {
      errors.push('manifest: "name" is required and must be a non-empty string');
    }
    if (doc.interface !== undefined) {
      if (!isPlainObject(doc.interface)) {
        errors.push('manifest: "interface", if present, must be an object');
      } else {
        checkStrictKeys(doc.interface, ["displayName"], "manifest.interface");
        if (doc.interface.displayName !== undefined && !isNonEmptyString(doc.interface.displayName)) {
          errors.push("manifest: interface.displayName must be a non-empty string");
        }
      }
    }
    if (!Array.isArray(doc.plugins)) {
      errors.push('manifest: "plugins" is required and must be an array (use [] when empty)');
    } else {
      await validateEntries(doc.plugins, "plugins");
    }
    if (doc.skills !== undefined) {
      if (!Array.isArray(doc.skills)) {
        errors.push('manifest: "skills", if present, must be an array');
      } else {
        await validateEntries(doc.skills, "skills");
      }
    }
  }

  for (const warning of warnings) console.log(`  WARN  ${warning}`);
  for (const error of errors) console.log(`  ERROR ${error}`);

  if (errors.length > 0) {
    console.log(`FAIL - ${errors.length} error(s); Cowork would reject this marketplace`);
    process.exit(1);
  }
  console.log("PASS - the manifest parses and every entry verifies against its content");
  process.exit(0);
}

await main();