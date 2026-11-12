#!/usr/bin/env node

// <define:HARNESS_MODULES>
var define_HARNESS_MODULES_default = ["adr", "context", "cto-review", "docs", "greenfield", "memory", "playbooks", "principles", "qa", "roles"];

// tools/src/cli.ts
import { parseArgs } from "node:util";
import { existsSync as existsSync9, statSync as statSync8 } from "node:fs";
import path30 from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// tools/src/version.ts
var VERSION = true ? "0.1.0" : "dev";

// tools/src/errors.ts
var UsageError = class extends Error {
};

// tools/src/fsutil.ts
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
var IGNORED_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "target",
  ".venv",
  "venv",
  "vendor",
  ".harness"
]);
var NOT_PARTS = /* @__PURE__ */ new Set([...IGNORED_DIRS, "out", "coverage", "__pycache__"]);
function partFolders(root) {
  return listDir(root, "").filter((n) => !n.startsWith(".") && !NOT_PARTS.has(n) && !isLink(root, n) && isDir(root, n));
}
function toPosix(p) {
  return p.replaceAll("\\", "/");
}
function readText(root, rel2, raw = false) {
  const file = path.join(root, rel2);
  try {
    if (!statSync(file).isFile()) return null;
  } catch {
    return null;
  }
  const text2 = readFileSync(file, "utf8");
  return raw ? text2 : text2.replace(/^﻿/, "").replace(/\r\n/g, "\n");
}
function readJson(root, rel2) {
  const text2 = readText(root, rel2);
  if (text2 === null) return { ok: false, reason: "missing" };
  try {
    return { ok: true, value: JSON.parse(text2) };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
function exists(root, rel2) {
  return existsSync(path.join(root, rel2));
}
function existsExact(root, rel2) {
  const slash = rel2.lastIndexOf("/");
  return listDir(root, slash === -1 ? "" : rel2.slice(0, slash)).includes(rel2.slice(slash + 1));
}
function isDir(root, rel2) {
  try {
    return statSync(path.join(root, rel2)).isDirectory();
  } catch {
    return false;
  }
}
function listDir(root, rel2) {
  try {
    return readdirSync(path.join(root, rel2)).sort();
  } catch {
    return [];
  }
}
function sha256(text2) {
  return "sha256:" + createHash("sha256").update(text2, "utf8").digest("hex");
}
function isLink(root, rel2) {
  try {
    return lstatSync(path.join(root, rel2)).isSymbolicLink();
  } catch {
    return false;
  }
}
function assertNoLink(root, rel2) {
  const parts = rel2.split("/");
  for (let i = 1; i <= parts.length; i++) {
    const sub = parts.slice(0, i).join("/");
    if (!exists(root, sub) && !isLink(root, sub)) return;
    if (isLink(root, sub)) throw new UsageError(`refusing to write through a link: ${sub}`);
  }
}
function safeWrite(root, rel2, text2, mode) {
  assertNoLink(root, rel2);
  mkdirSync(path.dirname(path.join(root, rel2)), { recursive: true });
  writeFileSync(path.join(root, rel2), text2);
  if (mode !== void 0) chmodSync(path.join(root, rel2), mode);
}
function isInsideRelative(p) {
  const s = toPosix(p.trim());
  if (s === "" || s.startsWith("/") || /^[A-Za-z]:/.test(s)) return false;
  const n = path.posix.normalize(s);
  return n !== ".." && !n.startsWith("../");
}
function samePath(a, b) {
  const norm = (p) => {
    const s = path.posix.normalize(toPosix(p.trim())).replace(/^(\.\/)+/, "").replace(/\/+$/, "");
    return process.platform === "win32" ? s.toLowerCase() : s;
  };
  return norm(a) === norm(b);
}
function gitDirOf(dir) {
  const dot = path.join(dir, ".git");
  if (isDir(dir, ".git")) return dot;
  const m = /^gitdir:\s*(.+?)\s*$/m.exec(readText(dir, ".git") ?? "");
  return m ? path.resolve(dir, m[1]) : null;
}
function within(outer, inner) {
  const rel2 = path.relative(process.platform === "win32" ? outer.toLowerCase() : outer, process.platform === "win32" ? inner.toLowerCase() : inner);
  return !rel2.startsWith("..") && !path.isAbsolute(rel2);
}
function ownGitFolders(root) {
  const candidates = partFolders(root).filter((name) => exists(root, `${name}/.git`));
  const rootGit = gitDirOf(root);
  if (!rootGit || !candidates.length) return candidates;
  const listed = [...(readText(root, ".gitmodules") ?? "").matchAll(/^\s*path\s*=\s*(.+?)\s*$/gm)].map((m) => m[1].replace(/^"(.*)"$/, "$1"));
  const modules = path.join(rootGit, "modules");
  return candidates.filter((name) => {
    if (listed.some((p) => samePath(p, name))) return false;
    const own = gitDirOf(path.join(root, name));
    return !(own && !isDir(root, `${name}/.git`) && within(modules, own));
  });
}

// tools/src/profile/detect.ts
import path2 from "node:path";

// tools/src/profile/ci-commands.ts
var PM = String.raw`\b(npm|pnpm|yarn|bun)( run)?`;
var NAME_END = String.raw`(?![\w:-])`;
var PATTERNS = [
  ["test", [new RegExp(`${PM} test${NAME_END}`), /\bpytest\b/, /\bgo test\b/, /\bmvn\b.*\btest\b/, /\bcargo test\b/, /\bgradlew?\b.*\btest\b/]],
  ["lint", [new RegExp(`${PM} lint${NAME_END}`), /\bruff check\b/, /\beslint\b/, /\bgo vet\b/, /\bcargo clippy\b/]],
  ["format", [/\b(prettier|ruff format|black|cargo fmt)\b.*--check\b/]],
  ["typecheck", [/\btsc\b.*--noEmit/, /\bmypy\b/, new RegExp(`${PM} (typecheck|type-check)${NAME_END}`)]],
  ["build", [new RegExp(`${PM} build${NAME_END}`), /\bgo build\b/, /\bmvn\b.*\bpackage\b/, /\bcargo build\b/]]
];
var REJECT = { test: /-D(skipTests|maven\.test\.skip)\b/, lint: /--fix\b/ };
var INSTALL = /\b(pip3?|pipx|uv pip|uv add|poetry add|npm|pnpm|yarn|bun|gem|go|cargo|apt-get|apt|brew|choco)\s+(install|add|i|get)\b/;
var indentOf = (line) => line.length - line.trimStart().length;
var unquote = (s) => s.trim().replace(/^(["'])(.*)\1$/, "$2");
function flowItems(value) {
  return value.slice(1, -1).split(/,(?=(?:[^"']|"[^"]*"|'[^']*')*$)/).map(unquote).filter(Boolean);
}
function commandLines(text2, gitlab) {
  const lines = text2.split("\n");
  const out2 = [];
  for (let i = 0; i < lines.length; i++) {
    const run2 = lines[i].match(/^(\s*)(?:-\s+)?run:\s*(.*)$/);
    const scriptKey = gitlab ? lines[i].match(/^(\s*)(?:before_|after_)?script:\s*(.*)$/) : null;
    const inline = scriptKey?.[2].trim();
    if (inline && !inline.startsWith("#") && !/^[|>][-+]?$/.test(inline)) {
      for (const cmd of inline.startsWith("[") && inline.endsWith("]") ? flowItems(inline) : [unquote(inline)]) out2.push([i + 1, cmd]);
      continue;
    }
    const script = inline ? null : scriptKey;
    if (run2 && !/^[|>][-+]?\s*$/.test(run2[2])) {
      if (run2[2] && !run2[2].startsWith("#")) out2.push([i + 1, unquote(run2[2])]);
      continue;
    }
    if (!run2 && !script) continue;
    const base = indentOf(lines[i]);
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j];
      if (line.trim() === "") continue;
      if (indentOf(line) <= base && !(script && /^\s*-\s/.test(line) && indentOf(line) === base)) break;
      const body = script ? line.match(/^\s*-\s+(.*)$/)?.[1] : line.trim();
      if (body && !body.trim().startsWith("#")) out2.push([j + 1, unquote(body)]);
      i = j;
    }
  }
  return out2;
}
function ciCommands(root, ciFiles) {
  const found = {};
  for (const file of ciFiles) {
    for (const [line, cmd] of commandLines(readText(root, file) ?? "", file === ".gitlab-ci.yml")) {
      if (INSTALL.test(cmd)) continue;
      for (const [cat, patterns] of PATTERNS) {
        if (!found[cat] && !REJECT[cat]?.test(cmd) && patterns.some((p) => p.test(cmd))) found[cat] = { value: cmd, source: `${file}:${line}`, confidence: "high" };
      }
    }
  }
  return found;
}

// tools/src/profile/make.ts
var TARGETS = {
  test: "test",
  lint: "lint",
  "format-check": "format",
  "fmt-check": "format",
  typecheck: "typecheck",
  "type-check": "typecheck",
  build: "build",
  start: "start"
};
function makefileName(root) {
  return ["GNUmakefile", "makefile", "Makefile"].find((f) => existsExact(root, f)) ?? null;
}
function makeTargets(root) {
  const found = {};
  const file = makefileName(root);
  if (!file) return found;
  (readText(root, file) ?? "").split("\n").forEach((line, i) => {
    const m = line.match(/^([A-Za-z][\w-]*):(?!=)/);
    const cat = m && TARGETS[m[1]];
    if (cat && !found[cat]) found[cat] = { value: `make ${m[1]}`, source: `${file}:${i + 1}`, confidence: "high" };
  });
  return found;
}

// tools/src/profile/repo.ts
function detectCi(root) {
  const workflows = listDir(root, ".github/workflows").filter((f) => f.endsWith(".yml") || f.endsWith(".yaml")).map((f) => `.github/workflows/${f}`);
  return [...workflows, ...[".gitlab-ci.yml", "Jenkinsfile"].filter((f) => existsExact(root, f))];
}
var ADR_DIRS = ["docs/adr", "docs/decisions", "doc/adr", "docs/architecture/decisions", "adr"];
function detectAdrDir(root) {
  return ADR_DIRS.find((d) => isDir(root, d)) ?? null;
}
function detectInstructions(root) {
  const files = ["AGENTS.md", "CLAUDE.md"].filter((f) => exists(root, f));
  const dirs2 = [".claude", ".opencode"].filter((d) => isDir(root, d)).map((d) => `${d}/`);
  return [...files, ...dirs2];
}
function detectSecrets(root) {
  const found = (mechanism, source) => ({ mechanism, source, confidence: "medium" });
  if (exists(root, "doppler.yaml")) return found("doppler", "doppler.yaml");
  const pkg = readJson(root, "package.json");
  const scripts = pkg.ok && pkg.value?.scripts && typeof pkg.value.scripts === "object" ? pkg.value.scripts : {};
  for (const [name, cmd] of Object.entries(scripts)) {
    if (typeof cmd === "string" && /\bdoppler run\b/.test(cmd)) return found("doppler", `package.json#scripts.${name}`);
  }
  if (exists(root, ".sops.yaml")) return found("sops", ".sops.yaml");
  const example = [".env.example", ".env.sample", ".env.template"].find((f) => exists(root, f));
  if (example) return found("dotenv", example);
  const deps = pkg.ok && pkg.value ? { ...pkg.value.dependencies, ...pkg.value.devDependencies } : {};
  if ("dotenv" in deps) return found("dotenv", "package.json#dependencies.dotenv");
  return { mechanism: "none" };
}

// tools/src/profile/types.ts
var STACKS = ["node-ts", "node-js", "python", "java", "go", "rust", "dotnet", "php", "ruby", "unknown"];
var CATEGORIES = ["test", "lint", "format", "typecheck", "build", "start"];
var RISKS = ["sin CI", "sin tests", "sin lockfile"];

// tools/src/profile/eco/node.ts
var LOCKFILES = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lock", "bun"],
  ["bun.lockb", "bun"],
  ["package-lock.json", "npm"]
];
var SCRIPTS = {
  test: ["test"],
  lint: ["lint"],
  format: ["format:check", "fmt:check", "check:format", "prettier:check"],
  typecheck: ["typecheck", "type-check", "check-types", "tsc"],
  build: ["build"],
  start: ["start"]
};
var TSC = { npm: "npx tsc --noEmit", pnpm: "pnpm exec tsc --noEmit", yarn: "yarn tsc --noEmit", bun: "bunx tsc --noEmit" };
function stackOf(root, dir, pkg) {
  const prefix = dir ? `${dir}/` : "";
  const deps = pkg ? { ...pkg.dependencies, ...pkg.devDependencies } : {};
  return exists(root, `${prefix}tsconfig.json`) || "typescript" in deps ? "node-ts" : "node-js";
}
function workspacePatterns(root, pkg) {
  const yaml = readText(root, "pnpm-workspace.yaml");
  if (yaml !== null) {
    const patterns = [];
    let inPackages = false;
    for (const line of yaml.split("\n")) {
      if (/^packages:\s*$/.test(line)) {
        inPackages = true;
        continue;
      }
      if (inPackages && /^\S/.test(line)) break;
      const m = inPackages && line.match(/^\s*-\s*["']?([^"'#]+?)["']?\s*(#.*)?$/);
      if (m) patterns.push(m[1]);
    }
    return { patterns, file: "pnpm-workspace.yaml" };
  }
  const ws = pkg?.workspaces;
  const list = Array.isArray(ws) ? ws : Array.isArray(ws?.packages) ? ws.packages : null;
  return { patterns: list ? list.filter((p) => typeof p === "string") : [], file: list ? "package.json" : null };
}
function detectNode(root) {
  if (!exists(root, "package.json")) return null;
  const read = readJson(root, "package.json");
  const pkg = read.ok && read.value && typeof read.value === "object" ? read.value : null;
  const unknowns = read.ok ? [] : ["package.json (ilegible)"];
  const manifests = ["package.json"];
  const lock = LOCKFILES.find(([f]) => exists(root, f));
  let packageManager;
  if (lock) {
    packageManager = { value: lock[1], source: lock[0], confidence: "high" };
    manifests.push(lock[0]);
  } else if (typeof pkg?.packageManager === "string") {
    packageManager = { value: pkg.packageManager.split("@")[0], source: "package.json#packageManager", confidence: "high" };
  } else if (exists(root, "pnpm-workspace.yaml")) {
    packageManager = { value: "pnpm", source: "pnpm-workspace.yaml", confidence: "high" };
  } else {
    packageManager = { value: "npm", source: "package.json", confidence: "low" };
  }
  const pm = packageManager.value;
  const scripts = pkg && typeof pkg.scripts === "object" && pkg.scripts ? pkg.scripts : {};
  const scriptCommands = {};
  for (const [cat, names2] of Object.entries(SCRIPTS)) {
    const name = names2.find((n) => typeof scripts[n] === "string");
    if (name) scriptCommands[cat] = { value: `${pm} run ${name}`, source: `package.json#scripts.${name}`, confidence: "high" };
  }
  const stack = stackOf(root, "", pkg);
  const commands2 = {};
  if (stack === "node-ts" && TSC[pm]) {
    const dep = ["devDependencies", "dependencies"].find((k) => pkg?.[k] && typeof pkg[k] === "object" && "typescript" in pkg[k]);
    commands2.typecheck = exists(root, "tsconfig.json") ? { value: TSC[pm], source: "tsconfig.json", confidence: "medium" } : { value: TSC[pm], source: `package.json#${dep ?? "devDependencies"}.typescript`, confidence: "low" };
  }
  if (exists(root, "tsconfig.json")) manifests.push("tsconfig.json");
  const ws = workspacePatterns(root, pkg);
  if (ws.file === "pnpm-workspace.yaml") manifests.push(ws.file);
  const dirs2 = /* @__PURE__ */ new Set();
  for (const pattern of ws.patterns) {
    const clean = pattern.replace(/\/+$/, "");
    const star = clean.match(/^([^*]+)\/\*$/);
    if (star) {
      for (const name of listDir(root, star[1])) if (name !== "node_modules" && isDir(root, `${star[1]}/${name}`)) dirs2.add(`${star[1]}/${name}`);
    } else if (!clean.includes("*")) {
      dirs2.add(clean);
    } else if (!unknowns.includes("packages")) {
      unknowns.push("packages");
    }
  }
  const packages = [];
  for (const dir of [...dirs2].sort()) {
    if (!exists(root, `${dir}/package.json`)) continue;
    const sub = readJson(root, `${dir}/package.json`);
    const value = sub.ok ? sub.value : null;
    manifests.push(`${dir}/package.json`);
    packages.push({ name: typeof value?.name === "string" ? value.name : dir.split("/").pop(), path: dir, stacks: [stackOf(root, dir, value)] });
  }
  return { stack, packageManager, commands: commands2, scriptCommands, packages, manifests, lockfileMissing: !lock, unknowns };
}

// tools/src/profile/eco/python.ts
function tables(text2) {
  return new Set([...(text2 ?? "").matchAll(/^\[\[?([^[\]]+)\]\]?\s*$/gm)].map((m) => m[1].trim()));
}
function table(t, name) {
  return [...t].find((h) => h === name || h.startsWith(`${name}.`));
}
function detectPython(root) {
  const entry = ["pyproject.toml", "requirements.txt", "setup.py"].find((f) => exists(root, f));
  if (!entry) return null;
  const t = tables(readText(root, "pyproject.toml"));
  const manifests = ["pyproject.toml", "requirements.txt", "setup.py", "uv.lock", "poetry.lock", "pytest.ini", "ruff.toml", "mypy.ini"].filter((f) => exists(root, f));
  let packageManager;
  let lockfileMissing = false;
  if (exists(root, "uv.lock")) packageManager = { value: "uv", source: "uv.lock", confidence: "high" };
  else if (exists(root, "poetry.lock")) packageManager = { value: "poetry", source: "poetry.lock", confidence: "high" };
  else if (t.has("tool.uv")) {
    packageManager = { value: "uv", source: "pyproject.toml#tool.uv", confidence: "medium" };
    lockfileMissing = true;
  } else if (t.has("tool.poetry")) {
    packageManager = { value: "poetry", source: "pyproject.toml#tool.poetry", confidence: "medium" };
    lockfileMissing = true;
  } else packageManager = { value: "pip", source: entry, confidence: "medium" };
  const prefix = packageManager.value === "pip" ? "" : `${packageManager.value} run `;
  const cmd = (value, source) => ({ value: prefix + value, source, confidence: "medium" });
  const commands2 = {};
  const testSource = t.has("tool.pytest.ini_options") ? "pyproject.toml#tool.pytest.ini_options" : ["pytest.ini", "conftest.py"].find((f) => exists(root, f));
  if (testSource) commands2.test = cmd("pytest", testSource);
  const ruffTable = table(t, "tool.ruff");
  const ruff = ruffTable ? `pyproject.toml#${ruffTable}` : exists(root, "ruff.toml") ? "ruff.toml" : null;
  if (ruff) {
    commands2.lint = cmd("ruff check .", ruff);
    commands2.format = cmd("ruff format --check .", ruff);
  } else if (t.has("tool.black")) {
    commands2.format = cmd("black --check .", "pyproject.toml#tool.black");
  }
  const mypyTable = table(t, "tool.mypy");
  const mypy = mypyTable ? `pyproject.toml#${mypyTable}` : exists(root, "mypy.ini") ? "mypy.ini" : null;
  if (mypy) commands2.typecheck = cmd("mypy .", mypy);
  return { stack: "python", packageManager, commands: commands2, packages: [], manifests, lockfileMissing, unknowns: [] };
}

// tools/src/profile/eco/compiled.ts
function conventional(stack, manager, manifest, cmds) {
  const commands2 = Object.fromEntries(
    Object.entries(cmds).map(([cat, value]) => [cat, { value, source: manifest, confidence: "medium" }])
  );
  return {
    stack,
    packageManager: { value: manager, source: manifest, confidence: "high" },
    commands: commands2,
    packages: [],
    manifests: [manifest],
    lockfileMissing: false,
    unknowns: []
  };
}
function detectGo(root) {
  if (!exists(root, "go.mod")) return null;
  return conventional("go", "go", "go.mod", { test: "go test ./...", lint: "go vet ./...", typecheck: "go build ./...", build: "go build ./..." });
}
function detectJava(root) {
  if (exists(root, "pom.xml")) {
    return conventional("java", "maven", "pom.xml", { test: "mvn test", typecheck: "mvn compile", build: "mvn package" });
  }
  const gradle = ["build.gradle", "build.gradle.kts"].find((f) => exists(root, f));
  if (gradle) return conventional("java", "gradle", gradle, { test: "gradle test", typecheck: "gradle classes", build: "gradle build" });
  return null;
}
function detectRust(root) {
  if (!exists(root, "Cargo.toml")) return null;
  return conventional("rust", "cargo", "Cargo.toml", {
    test: "cargo test",
    lint: "cargo clippy",
    format: "cargo fmt --check",
    typecheck: "cargo check",
    build: "cargo build"
  });
}

// tools/src/profile/eco/other.ts
function only(stack, manager, manifest) {
  return {
    stack,
    packageManager: { value: manager, source: manifest, confidence: "high" },
    commands: {},
    packages: [],
    manifests: [manifest],
    lockfileMissing: false,
    unknowns: []
  };
}
function detectDotnet(root) {
  const file = listDir(root, ".").find((f) => f.endsWith(".sln") || f.endsWith(".csproj"));
  return file ? only("dotnet", "dotnet", file) : null;
}
function detectPhp(root) {
  return exists(root, "composer.json") ? only("php", "composer", "composer.json") : null;
}
function detectRuby(root) {
  return exists(root, "Gemfile") ? only("ruby", "bundler", "Gemfile") : null;
}

// tools/src/profile/detect.ts
var ROOT_LOCKFILES = ["pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb", "package-lock.json", "uv.lock", "poetry.lock"];
var ECOSYSTEMS = [detectNode, detectPython, detectGo, detectJava, detectRust, detectDotnet, detectPhp, detectRuby];
function detectPiece(dir) {
  const ecos = ECOSYSTEMS.map((d) => d(dir)).filter((e) => e !== null);
  const ci = detectCi(dir);
  const fromCi = ciCommands(dir, ci);
  const fromMake = makeTargets(dir);
  const commands2 = {};
  for (const cat of CATEGORIES) {
    const pick = fromCi[cat] ?? ecos.map((e) => e.scriptCommands?.[cat]).find(Boolean) ?? fromMake[cat] ?? ecos.map((e) => e.commands[cat]).find(Boolean);
    if (pick) commands2[cat] = pick;
  }
  const found = new Set(ecos.flatMap((e) => [e.stack, ...e.packages.flatMap((p) => p.stacks)]));
  const packageManager = ecos.map((e) => e.packageManager).find(Boolean) ?? null;
  const hashed = [...ecos.flatMap((e) => e.manifests), ...ci, "package.json", makefileName(dir) ?? "Makefile"].filter((f) => exists(dir, f));
  return { ecos, ci, commands: commands2, found, packageManager, hashed };
}
var ordered = (found) => STACKS.filter((s) => found.has(s));
function missingTests(commands2, parts) {
  if (parts.some((p) => !p.commands.test)) return true;
  return !commands2.test && !parts.some((p) => p.commands.test);
}
function detectProfile(root) {
  const piece = detectPiece(root);
  const { ecos, ci, commands: commands2, packageManager } = piece;
  const packages = ecos.flatMap((e) => e.packages);
  const parts = [];
  const hashed = [...piece.hashed];
  const ownGit = ownGitFolders(root);
  const rootLock = ROOT_LOCKFILES.some((f) => exists(root, f));
  let partCi = false;
  let partLockMissing = false;
  for (const name of partFolders(root)) {
    const own = ownGit.includes(name);
    if (ecos.length && !own) continue;
    if (!own && exists(root, `${name}/.git`)) continue;
    if (packages.some((p2) => samePath(p2.path, name))) continue;
    const dir = path2.join(root, name);
    const p = detectPiece(dir);
    if (!p.ecos.length) continue;
    parts.push({ path: name, git: own ? "own" : "shared", stacks: ordered(p.found), packageManager: p.packageManager, commands: p.commands });
    hashed.push(...p.hashed.map((f) => `${name}/${f}`));
    partCi ||= p.ci.length > 0;
    partLockMissing ||= p.ecos.some((e) => e.lockfileMissing) && (own || !rootLock);
  }
  const found = /* @__PURE__ */ new Set([...piece.found, ...parts.flatMap((p) => p.stacks)]);
  const stacks = found.size ? ordered(found) : ["unknown"];
  const risks = RISKS.filter((r) => r === "sin CI" ? ci.length === 0 && !partCi : r === "sin tests" ? missingTests(commands2, parts) : partLockMissing || ecos.some((e) => e.lockfileMissing));
  const unknowns = [
    ...packageManager ? [] : ["packageManager"],
    ...CATEGORIES.filter((c) => !commands2[c]),
    ...ecos.flatMap((e) => e.unknowns)
  ];
  hashed.push(...[".harness/overrides.json"].filter((f) => exists(root, f)));
  const manifestHash = sha256([...new Set(hashed)].sort().map((f) => `${f}
${readText(root, f) ?? ""}
`).join(""));
  return {
    schemaVersion: 1,
    manifestHash,
    stacks,
    packages,
    parts,
    packageManager,
    commands: commands2,
    secrets: detectSecrets(root),
    ci,
    adrDir: detectAdrDir(root),
    existingInstructions: detectInstructions(root),
    risks,
    unknowns
  };
}

// tools/src/profile/overrides.ts
var FILE = ".harness/overrides.json";
var QUICK = "testQuick";
function quickTest(root, part) {
  const r = readJson(root, FILE);
  const o = r.ok ? part === void 0 ? r.value : r.value?.parts?.[part] : void 0;
  const v = o?.commands?.[QUICK];
  return typeof v === "string" && v.trim() !== "" ? v : void 0;
}
var CONTEXT_DEFAULT = "docs/context";
var CONTEXT_ERROR = `${FILE}: "context" must be a relative path inside the project`;
function contextDir(root) {
  const r = readJson(root, FILE);
  const v = r.ok ? r.value?.context : void 0;
  if (v === void 0) return { ok: true, dir: CONTEXT_DEFAULT };
  return typeof v === "string" && isInsideRelative(v) ? { ok: true, dir: v.trim().replaceAll("\\", "/") } : { ok: false, reason: CONTEXT_ERROR };
}
function staleParts(root, profile) {
  const read = readJson(root, FILE);
  const given = read.ok ? read.value?.parts : void 0;
  if (typeof given !== "object" || given === null || Array.isArray(given)) return [];
  if (!Object.keys(given).length) return [];
  const detected = profile().parts ?? [];
  return Object.keys(given).filter((name) => !detected.some((x) => x.path === name)).map((name) => `${FILE}: parts.${name} is not a part of this project (parts: ${detected.map((x) => x.path).join(", ") || "none"}); it is ignored \u2014 remove it`);
}
function applyOverrides(root, p) {
  const read = readJson(root, FILE);
  if (!read.ok) {
    if (read.reason === "missing") return p;
    throw new UsageError(`${FILE} is not valid JSON`);
  }
  const o = read.value;
  if (typeof o !== "object" || o === null || o.schemaVersion !== 1) throw new UsageError(`${FILE} needs "schemaVersion": 1`);
  if (o.context !== void 0 && !(typeof o.context === "string" && isInsideRelative(o.context))) throw new UsageError(CONTEXT_ERROR);
  const commands2 = merged(o.commands, "commands", p.commands);
  const detected = p.parts ?? [];
  const givenParts = o.parts ?? {};
  if (typeof givenParts !== "object" || givenParts === null || Array.isArray(givenParts)) throw new UsageError(`${FILE}: "parts" must be an object`);
  for (const [name, v] of Object.entries(givenParts)) {
    if (!detected.some((x) => x.path === name)) continue;
    if (typeof v !== "object" || v === null || Array.isArray(v)) throw new UsageError(`${FILE}: parts.${name} must be an object`);
  }
  const parts = detected.map((part) => {
    const given = givenParts[part.path];
    return given === void 0 ? part : { ...part, commands: merged(given.commands, `parts.${part.path}.commands`, part.commands) };
  });
  return {
    ...p,
    parts,
    commands: commands2,
    risks: missingTests(commands2, parts) ? p.risks : p.risks.filter((r) => r !== "sin tests"),
    unknowns: p.unknowns.filter((u) => !(u in commands2))
  };
}
function merged(given, key2, detected) {
  const list = given ?? {};
  if (typeof list !== "object" || list === null || Array.isArray(list)) throw new UsageError(`${FILE}: "${key2}" must be an object`);
  for (const [k, v] of Object.entries(list)) {
    if (k !== QUICK && !CATEGORIES.includes(k)) throw new UsageError(`${FILE}: ${key2}.${k} is not one of ${[...CATEGORIES, QUICK].join(", ")}`);
    if (typeof v !== "string" || v.trim() === "") throw new UsageError(`${FILE}: ${key2}.${k} must be a non-empty string`);
  }
  const commands2 = {};
  for (const cat of CATEGORIES) {
    const v = list[cat];
    const pick = typeof v === "string" ? { value: v, source: `${FILE}#${key2}.${cat}`, confidence: "high" } : detected[cat];
    if (pick) commands2[cat] = pick;
  }
  return commands2;
}

// tools/src/commands/detect.ts
var PROFILE = ".harness/profile.json";
function summary(p) {
  const lines = [`Profile written: ${PROFILE}`, `stacks: ${p.stacks.join(", ")}`];
  if (p.packageManager) lines.push(`packageManager: ${p.packageManager.value} (${p.packageManager.source})`);
  if (p.packages.length) lines.push(`packages: ${p.packages.map((x) => x.path).join(", ")}`);
  lines.push("commands:");
  for (const [cat, c] of Object.entries(p.commands)) lines.push(`  ${cat.padEnd(10)} ${c.value}  [${c.source}, ${c.confidence}]`);
  for (const part of p.parts) {
    lines.push(`part ${part.path} (${part.stacks.join(", ")}; ${part.git} git):`);
    for (const [cat, c] of Object.entries(part.commands)) lines.push(`  ${cat.padEnd(10)} ${c.value}  [${part.path}/${c.source}, ${c.confidence}]`);
  }
  if (p.risks.length) lines.push(`risks: ${p.risks.join(", ")}`);
  if (p.unknowns.length) lines.push(`unknowns: ${p.unknowns.join(", ")}`);
  return lines.join("\n") + "\n";
}
function detectCommand(flags, io) {
  const profile = applyOverrides(flags.cwd, detectProfile(flags.cwd));
  for (const note of staleParts(flags.cwd, () => profile)) io.err(`harness: note: ${note}
`);
  if (flags.check) {
    const stored = readJson(flags.cwd, PROFILE);
    const status = !stored.ok ? "missing" : stored.value?.manifestHash === profile.manifestHash ? "current" : "stale";
    const text3 = { current: "profile is current", stale: "profile is stale: run harness detect", missing: "no profile: run harness detect" }[status];
    io.out(flags.json ? JSON.stringify({ status }) + "\n" : text3 + "\n");
    return status === "current" ? 0 : 3;
  }
  const text2 = JSON.stringify(profile, null, 2) + "\n";
  safeWrite(flags.cwd, PROFILE, text2);
  io.out(flags.json ? text2 : summary(profile));
  return 0;
}

// tools/src/commands/init.ts
import { existsSync as existsSync3, readdirSync as readdirSync4 } from "node:fs";
import path10 from "node:path";
import { fileURLToPath } from "node:url";

// tools/src/install/gitignore.ts
var GITIGNORE_ENTRIES = [".harness/profile.json", ".harness/verify.json", ".harness/task.md", ".harness/proposals/", ".harness/handoffs/", ".harness/review.diff"];
var START = "# >>> harness (managed by harness init)";
var END = "# <<< harness";
function upsertGitignore(text2) {
  const block = [START, ...GITIGNORE_ENTRIES, END].join("\n") + "\n";
  if (text2 === null || text2 === "") return block;
  const crlf = text2.includes("\r\n");
  const lf2 = text2.replace(/\r\n/g, "\n");
  const start = lf2.indexOf("# >>> harness");
  const end = lf2.indexOf(END, start);
  if (start !== -1 && end === -1) return null;
  const out2 = start !== -1 && end !== -1 ? lf2.slice(0, start) + block + lf2.slice(end + END.length).replace(/^\n/, "") : (lf2.endsWith("\n") ? lf2 : lf2 + "\n") + block;
  return crlf ? out2.replace(/\n/g, "\r\n") : out2;
}
function removeGitignoreBlock(text2) {
  const crlf = text2.includes("\r\n");
  const lf2 = text2.replace(/\r\n/g, "\n");
  const start = lf2.indexOf("# >>> harness");
  const end = start === -1 ? -1 : lf2.indexOf(END, start);
  if (start === -1 || end === -1) return text2;
  const out2 = lf2.slice(0, start) + lf2.slice(end + END.length).replace(/^\n/, "");
  if (out2 === "") return null;
  return crlf ? out2.replace(/\n/g, "\r\n") : out2;
}

// tools/src/install/plan.ts
import { readFileSync as readFileSync5, readdirSync as readdirSync3, rmSync as rmSync2 } from "node:fs";
import path8 from "node:path";

// tools/src/install/hook.ts
import { spawnSync } from "node:child_process";
import path3 from "node:path";
var MARK = "# harness pre-commit hook";
var RUNS_HARNESS = "harness.mjs hook pre-commit";
var HOOK = ".git/hooks/pre-commit";
var BUNDLE = ".harness/bin/harness.mjs";
var NO_ROOT_GIT = "no git here; each part with its own git has the hook";
var hookPath = (part) => part ? `${part}/${HOOK}` : HOOK;
var bundleFrom = (part) => part ? path3.posix.relative(part, BUNDLE) : BUNDLE;
var hookLine = (part) => `node ${bundleFrom(part)} hook pre-commit
`;
var ask = (cwd, ...args) => spawnSync("git", ["-c", "core.fsmonitor=false", ...args], { cwd, encoding: "utf8", windowsHide: true, timeout: 5e3 });
function managed(repo) {
  if (isDir(repo, ".husky")) return { file: path3.join(repo, ".husky/pre-commit"), by: "husky" };
  const hooksPath = ask(repo, "config", "--get", "core.hooksPath");
  const dir = hooksPath.status === 0 ? hooksPath.stdout.trim() : "";
  if (dir) return { file: path3.join(path3.resolve(repo, dir), "pre-commit"), by: `core.hooksPath (${dir})` };
  if (exists(repo, ".pre-commit-config.yaml")) return { file: path3.join(repo, ".pre-commit-config.yaml"), by: "pre-commit, as a local hook" };
  for (const f of ["lefthook.yml", "lefthook.yaml"]) if (exists(repo, f)) return { file: path3.join(repo, f), by: "lefthook, as a pre-commit command" };
  return null;
}
function shown(target, abs) {
  const rel2 = path3.relative(target, abs);
  return rel2 && !rel2.startsWith("..") && !path3.isAbsolute(rel2) ? toPosix(rel2) : toPosix(abs);
}
function theirs(target, abs, line, note) {
  const current = readText(path3.dirname(abs), path3.basename(abs), true);
  if (current?.includes(RUNS_HARNESS)) return { path: shown(target, abs), action: "kept", content: line, note: "already runs the harness pre-commit check" };
  return { path: shown(target, abs), action: "propose", content: line, note };
}
function hookRuns(target, part = "") {
  const repo = path3.join(target, part);
  const where = ask(repo, "rev-parse", "--git-path", "hooks");
  if (where.status !== 0) return { ok: true, file: hookPath(part) };
  const used = managed(repo);
  const file = used ? used.file : path3.join(path3.resolve(repo, where.stdout.trim()), "pre-commit");
  const current = readText(path3.dirname(file), path3.basename(file), true);
  return { ok: !!current?.includes(RUNS_HARNESS), file: toPosix(path3.relative(target, file) || file) };
}
function planHook(target, script, part = "") {
  const repo = path3.join(target, part);
  const rel2 = hookPath(part);
  const content = part ? script.replaceAll(BUNDLE, bundleFrom(part)) : script;
  const line = hookLine(part);
  const where = ask(repo, "rev-parse", "--git-path", "hooks");
  if (where.status !== 0) {
    const note = !part && ownGitFolders(target).length ? NO_ROOT_GIT : "not a git repository; run harness init again after git init";
    return { path: rel2, action: "kept", content, note };
  }
  const used = managed(repo);
  if (used) return theirs(target, used.file, line, `hooks run through ${used.by}; add this line to its pre-commit`);
  const hooks = path3.resolve(repo, where.stdout.trim());
  if (hooks !== path3.join(repo, ".git", "hooks")) return theirs(target, path3.join(hooks, "pre-commit"), line, "this repository's hooks live outside its folder; add this line to its pre-commit");
  const current = readText(target, rel2, true);
  if (current === null) return { path: rel2, action: "create", content, mode: 493 };
  if (current === content) return { path: rel2, action: "identical", content, mode: 493 };
  if (current.includes(MARK)) return { path: rel2, action: "conflict", content, note: "older harness hook; replace it with the one below" };
  return theirs(target, path3.join(target, rel2), line, "a pre-commit hook already exists; add this line to it");
}

// tools/src/verify/state.ts
import { spawnSync as spawnSync2 } from "node:child_process";
import { createHash as createHash2 } from "node:crypto";
import { copyFileSync, existsSync as existsSync2, rmSync, statSync as statSync2 } from "node:fs";
import path4 from "node:path";
var VERIFY_STATE = ".harness/verify.json";
var HARNESS_INDEX = "harness-index";
function git(root, args, env) {
  return spawnSync2("git", ["-c", "core.fsmonitor=false", ...args], { cwd: root, encoding: "utf8", windowsHide: true, timeout: 1e4, env: env ? { ...process.env, ...env } : void 0 });
}
function out(root, args) {
  const r = git(root, args);
  return r.status === 0 ? r.stdout.trim() || null : null;
}
function oneWorkTree(root) {
  const paths2 = out(root, ["rev-parse", "--git-path", "index", "--git-path", HARNESS_INDEX]);
  if (paths2 === null) return null;
  const [index, own] = paths2.split(/\r?\n/).map((p) => path4.resolve(root, p));
  if (!index || !own) return null;
  try {
    if (!existsSync2(index)) rmSync(own, { force: true });
    else if (!existsSync2(own) || statSync2(index).mtimeMs > statSync2(own).mtimeMs) copyFileSync(index, own);
  } catch {
    return null;
  }
  const env = { GIT_INDEX_FILE: own };
  if (git(root, ["add", "-A", "--", ".", ":(exclude).harness"], env).status !== 0) return null;
  const tree = git(root, ["write-tree"], env);
  return tree.status === 0 ? tree.stdout.trim() || null : null;
}
function ownGitParts(root) {
  return ownGitFolders(root);
}
function combined(root, one) {
  const parts = ownGitParts(root);
  const base = one(root);
  if (!parts.length) return base;
  const lines = base === null ? [] : [`.	${base}`];
  for (const p of parts) {
    const v = one(path4.join(root, p));
    lines.push(`${p}	${v ?? "<none>"}`);
  }
  return createHash2("sha256").update(lines.sort().join("\n"), "utf8").digest("hex");
}
function workTree(root) {
  return combined(root, oneWorkTree);
}
function headOf(root) {
  return combined(root, (dir) => out(dir, ["rev-parse", "--verify", "-q", "HEAD"]));
}
function headTree(root) {
  return combined(root, (dir) => out(dir, ["rev-parse", "--verify", "-q", "HEAD^{tree}"]));
}
function readState(root) {
  const r = readJson(root, VERIFY_STATE);
  return r.ok && typeof r.value === "object" && r.value !== null && !Array.isArray(r.value) ? r.value : {};
}
function writeState(root, s) {
  safeWrite(root, VERIFY_STATE, JSON.stringify(s, null, 2) + "\n");
}

// tools/src/install/claude-settings.ts
var SETTINGS = ".claude/settings.json";
var MATCHER = "Bash|PowerShell|Monitor|Read|Write|Edit|NotebookEdit|Grep|Glob";
var BUNDLE2 = ".harness/bin/harness.mjs";
function harnessEntries(wrapper) {
  return {
    PreToolUse: [{ matcher: MATCHER, hooks: [{ type: "command", command: "node", args: ["-e", wrapper, BUNDLE2, "guard", "--agent", "claude-code"], timeout: 20 }] }],
    SessionStart: [
      { hooks: [{ type: "command", command: "node", args: [BUNDLE2, "doctor", "--brief"], timeout: 10 }] },
      // After a compaction: the task state comes back, bounded (ADR 0015)
      { matcher: "compact", hooks: [{ type: "command", command: "node", args: [BUNDLE2, "resume"], timeout: 10 }] }
    ],
    // Turn end: compares fingerprints, runs no checks (ADR 0009)
    Stop: [{ hooks: [{ type: "command", command: "node", args: [BUNDLE2, "stop", "--agent", "claude-code"], timeout: 15 }] }]
  };
}
var SIGNATURE = { PreToolUse: ["guard"], SessionStart: ["doctor", "resume"], Stop: ["stop"] };
function isHarnessHook(hook, event) {
  const args = hook?.args;
  return Array.isArray(args) && args.some((a) => typeof a === "string" && a.endsWith("harness.mjs")) && (SIGNATURE[event] ?? []).some((w) => args.includes(w));
}
function hasHarnessHook(settings, event) {
  const list = settings?.hooks?.[event];
  return Array.isArray(list) && list.some((g) => Array.isArray(g?.hooks) && g.hooks.some((h) => isHarnessHook(h, event)));
}
var obj = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var text = (v) => JSON.stringify(v, null, 2) + "\n";
function planClaudeSettings(target, wrapper) {
  const entries = harnessEntries(wrapper);
  const current = readText(target, SETTINGS);
  if (current === null) return { path: SETTINGS, action: "create", content: text({ hooks: entries }) };
  const propose = (why) => ({ path: SETTINGS, action: "propose", content: text({ hooks: entries }), note: `${why}; add these hook entries by hand` });
  let s;
  try {
    s = JSON.parse(current);
  } catch {
    return propose("is not valid JSON");
  }
  if (!obj(s)) return propose("is not a JSON object");
  if (s.hooks !== void 0 && !obj(s.hooks)) return propose("has a hooks value that is not an object");
  const hooks = { ...s.hooks ?? {} };
  for (const [event, ours] of Object.entries(entries)) {
    const list = hooks[event];
    if (list !== void 0 && !Array.isArray(list)) return propose(`has a hooks.${event} value that is not a list`);
    const kept = [];
    let at = -1;
    for (const group of list ?? []) {
      const own = Array.isArray(group?.hooks) ? group.hooks.filter((h) => isHarnessHook(h, event)) : [];
      if (!own.length) {
        kept.push(group);
        continue;
      }
      if (at === -1) at = kept.length;
      const rest = group.hooks.filter((h) => !isHarnessHook(h, event));
      if (rest.length) kept.push({ ...group, hooks: rest });
    }
    kept.splice(at === -1 ? kept.length : at, 0, ...ours);
    hooks[event] = kept;
  }
  const next = text({ ...s, hooks });
  if (JSON.stringify({ ...s, hooks }) === JSON.stringify(s)) return { path: SETTINGS, action: "identical", content: current };
  const reflowed = text(s) !== current;
  return { path: SETTINGS, action: "update", content: next, note: reflowed ? "rewritten with 2-space indentation" : void 0 };
}
function removeHarnessHooks(s) {
  if (!obj(s.hooks)) return s;
  const hooks = { ...s.hooks };
  for (const event of Object.keys(SIGNATURE)) {
    const list = hooks[event];
    if (!Array.isArray(list)) continue;
    const kept = list.map((g) => Array.isArray(g?.hooks) ? { ...g, hooks: g.hooks.filter((h) => !isHarnessHook(h, event)) } : g).filter((g) => !Array.isArray(g?.hooks) || g.hooks.length > 0);
    if (kept.length) hooks[event] = kept;
    else delete hooks[event];
  }
  const out2 = { ...s, hooks };
  if (!Object.keys(hooks).length) delete out2.hooks;
  return out2;
}
var settingsText = (v) => JSON.stringify(v, null, 2) + "\n";

// tools/src/install/modules.ts
import { readFileSync as readFileSync2, readdirSync as readdirSync2, rmdirSync, statSync as statSync3 } from "node:fs";
import path5 from "node:path";
var SKILLS = ["harness-start", "harness-verify"];
var KNOWN_SKILL = /^harness-[a-z0-9]+(-[a-z0-9]+)*$/;
var MODULE_NAME = /^[a-z][a-z0-9-]*$/;
var BUILT_MODULES = typeof define_HARNESS_MODULES_default !== "undefined" ? define_HARNESS_MODULES_default : null;
var AGENT_DIRS = { "claude-code": ".claude/agents", opencode: ".opencode/agents" };
var GUIDES = ".harness/guides";
function statSafe(file) {
  try {
    return statSync3(file).isFile();
  } catch {
    return false;
  }
}
function dirs(dir) {
  try {
    return readdirSync2(dir).filter((n) => statSync3(path5.join(dir, n)).isDirectory()).sort();
  } catch {
    return [];
  }
}
function roles(dir) {
  try {
    return readdirSync2(dir).filter((n) => n.endsWith(".md") && KNOWN_SKILL.test(n.slice(0, -3)) && statSafe(path5.join(dir, n))).map((n) => n.slice(0, -3)).sort();
  } catch {
    return [];
  }
}
function listModules(harnessRoot) {
  const root = path5.join(harnessRoot, "modules");
  const out2 = [];
  for (const name of dirs(root)) {
    if (!MODULE_NAME.test(name)) continue;
    let def;
    try {
      def = JSON.parse(readFileSync2(path5.join(root, name, "module.json"), "utf8"));
    } catch {
      continue;
    }
    if (typeof def?.description !== "string") continue;
    const guide = statSafe(path5.join(root, name, "guide", "GUIDE.md"));
    out2.push({ name, description: def.description, recommended: def.recommended === true, guide, agents: roles(path5.join(root, name, "agents")) });
  }
  return out2;
}
function skillSource(harnessRoot, skill) {
  return path5.join(harnessRoot, "core", "skills", skill);
}
function guideSource(harnessRoot, module) {
  return path5.join(harnessRoot, "modules", module, "guide");
}
function foldersToPrune(paths2, fixed = []) {
  const folders = /* @__PURE__ */ new Set([...SKILLS.map((s) => `.claude/skills/${s}`)]);
  for (const p of paths2) {
    const parts = p.split("/");
    if (parts.length === 4 && parts[0] === ".claude" && parts[1] === "skills") folders.add(parts.slice(0, 3).join("/"));
    if (parts.length === 4 && `${parts[0]}/${parts[1]}` === GUIDES) folders.add(parts.slice(0, 3).join("/"));
    if (parts.length === 3 && Object.values(AGENT_DIRS).includes(`${parts[0]}/${parts[1]}`)) folders.add(`${parts[0]}/${parts[1]}`);
  }
  return [...folders, GUIDES, ...fixed];
}
function pruneEmpty(target, folders) {
  for (const rel2 of folders) {
    const dir = path5.join(target, rel2);
    try {
      if (readdirSync2(dir).length === 0) rmdirSync(dir);
    } catch {
    }
  }
}

// tools/src/install/guides.ts
import { readFileSync as readFileSync3 } from "node:fs";
import path6 from "node:path";
function when(harnessRoot, module) {
  const text2 = readFileSync3(path6.join(guideSource(harnessRoot, module), "GUIDE.md"), "utf8").replace(/\r\n/g, "\n");
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text2)?.[1] ?? "";
  return /^when:\s*(.*)$/m.exec(fm)?.[1].trim() ?? "";
}
function guideIndex(harnessRoot, modules) {
  const head = [
    "# Harness guides",
    "",
    "Read this once per task. Open only the guide your task needs: `.harness/guides/<name>/GUIDE.md`,",
    "then only the references that guide links to.",
    ""
  ];
  if (!modules.length) return [...head, "No guides are installed.", ""].join("\n");
  const rows = modules.map((m) => `| ${m} | ${when(harnessRoot, m).replaceAll("|", "/")} | ${GUIDES}/${m}/GUIDE.md |`);
  return [...head, "| Guide | Use when | Open |", "| --- | --- | --- |", ...rows, ""].join("\n");
}

// tools/src/install/roles.ts
import { readFileSync as readFileSync4 } from "node:fs";
import path7 from "node:path";
var CAPABILITIES = ["read", "search", "web"];
var CLAUDE_TOOLS = { read: ["Read"], search: ["Grep", "Glob"], web: ["WebFetch", "WebSearch"] };
var OPENCODE_ACTIONS = { read: ["read"], search: ["glob", "grep"], web: ["webfetch", "websearch"] };
function readRole(harnessRoot, module, role) {
  const rel2 = `modules/${module}/agents/${role}.md`;
  const text2 = readFileSync4(path7.join(harnessRoot, rel2), "utf8").replace(/\r\n/g, "\n");
  const m = /^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/.exec(text2);
  if (!m) throw new Error(`${rel2}: must start with a --- frontmatter block`);
  const field = (key2) => new RegExp(`^${key2}:[ \\t]*(.*)$`, "m").exec(m[1])?.[1].trim() ?? "";
  const name = field("name");
  if (name !== role || !KNOWN_SKILL.test(name)) throw new Error(`${rel2}: name must be "${role}" and start with harness-`);
  const caps = field("capabilities").replace(/^\[|\]$/g, "").split(",").map((c) => c.trim()).filter(Boolean);
  for (const c of caps) {
    if (!CAPABILITIES.includes(c)) throw new Error(`${rel2}: unknown capability "${c}"; allowed: ${CAPABILITIES.join(", ")}`);
  }
  return { name, description: field("description"), capabilities: caps, body: m[2] };
}
function renderClaude(role) {
  const tools = role.capabilities.flatMap((c) => CLAUDE_TOOLS[c]).join(", ");
  return `---
name: ${role.name}
description: ${role.description}
tools: ${tools}
---

${role.body}`;
}
function renderOpenCode(role) {
  const rule = (action, effect) => `  - { action: ${action}, resource: "*", effect: ${effect} }
`;
  const allows = role.capabilities.flatMap((c) => OPENCODE_ACTIONS[c]).map((a) => rule(a, "allow")).join("");
  return `---
description: ${role.description}
mode: subagent
permissions:
${rule('"*"', "deny")}${allows}---

${role.body}`;
}

// tools/src/install/plan.ts
var MANIFEST = ".harness/manifest.json";
var PROPOSALS = ".harness/proposals";
function isInstallPath(rel2) {
  if (typeof rel2 !== "string" || rel2.includes("\\") || path8.posix.isAbsolute(rel2) || /^[A-Za-z]:/.test(rel2)) return false;
  const parts = rel2.split("/");
  if (parts.some((p) => p === "" || p === "." || p === "..")) return false;
  if (rel2 === ".harness/bin/harness.mjs" || rel2 === ".opencode/plugins/harness.js" || rel2 === "AGENTS.md") return true;
  if (parts.length === 4 && parts[0] === ".claude" && parts[1] === "skills" && KNOWN_SKILL.test(parts[2])) return true;
  if (rel2 === `${GUIDES}/index.md`) return true;
  if (parts.length === 4 && `${parts[0]}/${parts[1]}` === GUIDES && MODULE_NAME.test(parts[2])) return true;
  if (parts.length === 3 && Object.values(AGENT_DIRS).includes(`${parts[0]}/${parts[1]}`)) {
    return parts[2].endsWith(".md") && KNOWN_SKILL.test(parts[2].slice(0, -3));
  }
  return parts[parts.length - 1] === "CLAUDE.md" && parts.slice(0, -1).every((p) => !p.startsWith("."));
}
function isPartHookPath(rel2) {
  if (typeof rel2 !== "string") return false;
  const m = /^([^/\\:]+)\/\.git\/hooks\/pre-commit$/.exec(rel2);
  return m !== null && !m[1].startsWith(".");
}
function installedHashes(target) {
  const m = readJson(target, MANIFEST);
  const files = m.ok && Array.isArray(m.value?.files) ? m.value.files : [];
  return new Map(files.filter((f) => isInstallPath(f?.path) && typeof f?.sha256 === "string").map((f) => [f.path, f.sha256]));
}
function previousOrphans(target) {
  const m = readJson(target, MANIFEST);
  const list = m.ok && Array.isArray(m.value?.orphans) ? m.value.orphans : [];
  return list.filter((o) => isInstallPath(o?.path) && typeof o?.sha256 === "string").map((o) => ({ path: o.path, sha256: o.sha256 }));
}
var MARK_START = "<!-- harness:start -->";
var MARK_END = "<!-- harness:end -->";
var IMPORT = "@AGENTS.md\n";
var MAX_DEPTH = 6;
var lf = (s) => s.replace(/\r\n/g, "\n");
function owned(target, rel2, content, installed) {
  const current = readText(target, rel2);
  if (current === null) return { path: rel2, action: "create", content };
  if (current === lf(content)) return { path: rel2, action: "identical", content };
  const previous = installed.get(rel2);
  if (previous === sha256(current)) return { path: rel2, action: "update", content };
  const note = previous === void 0 ? "exists with different content; not overwritten" : `you changed it; the new version is in ${PROPOSALS}/${rel2} (compare: git diff --no-index ${rel2} ${PROPOSALS}/${rel2})`;
  return { path: rel2, action: "conflict", content, note, previous };
}
function nestedAgentsDirs(target, rel2 = "", depth = 0) {
  if (depth >= MAX_DEPTH) return [];
  const found = [];
  let entries = [];
  try {
    entries = readdirSync3(path8.join(target, rel2)).sort();
  } catch {
    return [];
  }
  for (const name of entries) {
    const sub = rel2 ? `${rel2}/${name}` : name;
    if (IGNORED_DIRS.has(name) || name.startsWith(".") || isLink(target, sub) || !isDir(target, sub)) continue;
    if (readText(target, `${sub}/AGENTS.md`) !== null) found.push(sub);
    found.push(...nestedAgentsDirs(target, sub, depth + 1));
  }
  return found;
}
function planInstall(target, opts) {
  const installed = installedHashes(target);
  const ops = [owned(target, ".harness/bin/harness.mjs", readFileSync5(opts.bundlePath, "utf8"), installed)];
  const all = listModules(opts.harnessRoot);
  for (const skill of SKILLS) {
    const skillDir = skillSource(opts.harnessRoot, skill);
    for (const file of readdirSync3(skillDir).sort()) {
      ops.push(owned(target, `.claude/skills/${skill}/${file}`, readFileSync5(path8.join(skillDir, file), "utf8"), installed));
    }
  }
  const guides = all.filter((m) => m.guide && opts.modules.includes(m.name)).map((m) => m.name);
  for (const module of guides) {
    const dir = guideSource(opts.harnessRoot, module);
    for (const file of readdirSync3(dir).sort()) {
      ops.push(owned(target, `${GUIDES}/${module}/${file}`, readFileSync5(path8.join(dir, file), "utf8"), installed));
    }
  }
  ops.push(owned(target, `${GUIDES}/index.md`, guideIndex(opts.harnessRoot, guides), installed));
  const render = { "claude-code": renderClaude, opencode: renderOpenCode };
  for (const m of all.filter((d) => opts.modules.includes(d.name))) {
    for (const name of m.agents) {
      const role = readRole(opts.harnessRoot, m.name, name);
      for (const agent of opts.agents) ops.push(owned(target, `${AGENT_DIRS[agent]}/${name}.md`, render[agent](role), installed));
    }
  }
  const produced = new Set(ops.map((op) => op.path.toLowerCase()));
  const dropped = new Set(all.filter((m) => !opts.modules.includes(m.name)).map((m) => m.name));
  for (const [rel2, hash] of installed) {
    const agentDir = Object.entries(AGENT_DIRS).find(([, dir]) => rel2.startsWith(`${dir}/`));
    const role = agentDir ? path8.posix.basename(rel2, ".md") : void 0;
    const roleModule = role !== void 0 ? all.find((m) => m.agents.includes(role))?.name : void 0;
    const agentFile = agentDir !== void 0 && (opts.agents.includes(agentDir[0]) || roleModule === void 0 || !opts.modules.includes(roleModule));
    if (produced.has(rel2.toLowerCase()) || !(rel2.startsWith(".claude/skills/") || rel2.startsWith(`${GUIDES}/`) || agentFile)) continue;
    const current = readText(target, rel2);
    if (current === null) continue;
    if (sha256(current) === hash) {
      ops.push({ path: rel2, action: "delete", content: "" });
      continue;
    }
    const module = role !== void 0 ? roleModule : /^(?:\.harness\/guides\/|\.claude\/skills\/harness-)([a-z0-9-]+)\//.exec(rel2)?.[1];
    const oldSkill = module !== void 0 && opts.modules.includes(module) && rel2.startsWith(`.claude/skills/harness-${module}/`);
    const note = module && dropped.has(module) ? `module ${module} was removed, but you changed this file; delete it by hand if you no longer need it` : oldSkill ? `module ${module} is now the guide ${GUIDES}/${module}/ (ADR 0014); your edited copy is still loaded as a skill and its references were removed: move your changes to the guide, then delete .claude/skills/harness-${module}/` : "the harness no longer installs this file, but you changed it; delete it by hand if you no longer need it";
    ops.push({ path: rel2, action: "conflict", content: "", orphan: true, note });
  }
  const block = `${MARK_START}
${lf(readFileSync5(path8.join(opts.harnessRoot, "core", "rules", "agents-block.md"), "utf8"))}${MARK_END}
`;
  const agents = readText(target, "AGENTS.md");
  if (agents === null) ops.push({ path: "AGENTS.md", action: "create", content: block });
  else if (agents === block) ops.push({ path: "AGENTS.md", action: "identical", content: block });
  else if (agents.includes(block)) ops.push({ path: "AGENTS.md", action: "kept", content: block });
  else if (agents.includes(MARK_START)) ops.push({ path: "AGENTS.md", action: "conflict", content: block, note: "has an older harness block; replace it with the one below" });
  else ops.push({ path: "AGENTS.md", action: "propose", content: block, note: "add this block to your AGENTS.md" });
  if (opts.agents.includes("claude-code")) {
    for (const dir of ["", ...nestedAgentsDirs(target)]) {
      const rel2 = dir ? `${dir}/CLAUDE.md` : "CLAUDE.md";
      const current = readText(target, rel2);
      if (current === null) ops.push({ path: rel2, action: "create", content: IMPORT });
      else if (current === IMPORT) ops.push({ path: rel2, action: "identical", content: IMPORT });
      else if (/^@AGENTS\.md\s*$/m.test(current)) ops.push({ path: rel2, action: "kept", content: current });
      else ops.push({ path: rel2, action: "propose", content: IMPORT, note: "add this line so Claude Code loads AGENTS.md" });
    }
    const wrapper = readFileSync5(path8.join(opts.harnessRoot, "core", "adapters", "claude-code", "wrapper.js"), "utf8").trim();
    ops.push(planClaudeSettings(target, wrapper));
  }
  if (opts.agents.includes("opencode")) {
    ops.push(owned(target, ".opencode/plugins/harness.js", lf(readFileSync5(path8.join(opts.harnessRoot, "core", "adapters", "opencode", "harness.js"), "utf8")), installed));
  }
  const gi = readText(target, ".gitignore", true);
  const next = upsertGitignore(gi);
  if (next === null) {
    ops.push({ path: ".gitignore", action: "conflict", content: upsertGitignore(null), note: "has a harness start marker with no end marker; fix it, then run init again" });
  } else {
    ops.push({ path: ".gitignore", action: gi === null ? "create" : gi === next ? "identical" : "update", content: next });
  }
  const script = lf(readFileSync5(path8.join(opts.harnessRoot, "core", "hooks", "pre-commit"), "utf8"));
  ops.push(planHook(target, script));
  for (const part of ownGitParts(target)) ops.push(planHook(target, script, part));
  return ops;
}
function applyInstall(target, ops, manifest) {
  const writes = ops.filter((op) => op.action === "create" || op.action === "update");
  const deletes = ops.filter((op) => op.action === "delete");
  for (const rel2 of [...writes.map((op) => op.path), ...deletes.map((op) => op.path), ".harness/manifest.json"]) assertNoLink(target, rel2);
  for (const op of writes) safeWrite(target, op.path, op.content, op.mode);
  for (const op of deletes) rmSync2(path8.join(target, op.path), { force: true });
  pruneEmpty(target, foldersToPrune(deletes.map((op) => op.path)).filter((dir) => deletes.some((op) => op.path.startsWith(`${dir}/`))));
  const kept = ops.filter((op) => op.action === "conflict" && op.previous !== void 0);
  for (const op of kept) {
    assertNoLink(target, `${PROPOSALS}/${op.path}`);
    safeWrite(target, `${PROPOSALS}/${op.path}`, op.content);
  }
  const recorded = (op) => op.path !== ".gitignore" && op.path !== SETTINGS && !op.path.startsWith(".git/") && !op.path.includes("/.git/");
  const planned = new Set(ops.map((op) => op.path));
  const files = [
    ...ops.filter((op) => (op.action === "create" || op.action === "identical" || op.action === "update") && recorded(op)).map((op) => ({ path: op.path, sha256: sha256(lf(op.content)) })),
    // The hash of what the harness last wrote, so the next init still sees the person's change
    ...kept.map((op) => ({ path: op.path, sha256: op.previous })),
    // Files an earlier init wrote that this one did not plan (an agent left out): still the harness's, so remove takes them
    ...[...installedHashes(target)].filter(([rel2]) => !planned.has(rel2) && readText(target, rel2) !== null).map(([rel2, hash]) => ({ path: rel2, sha256: hash }))
  ];
  const installedNow = installedHashes(target);
  const orphans = [
    ...ops.filter((op) => op.orphan && installedNow.has(op.path)).map((op) => ({ path: op.path, sha256: installedNow.get(op.path) })),
    ...previousOrphans(target).filter((o) => !planned.has(o.path) && readText(target, o.path) !== null)
  ];
  const hook = ops.find((op) => op.path === HOOK && (op.action === "create" || op.action === "identical"));
  const partHooks = ops.filter((op) => isPartHookPath(op.path) && (op.action === "create" || op.action === "identical")).map((op) => ({ path: op.path, sha256: sha256(lf(op.content)) }));
  const text2 = JSON.stringify({
    ...manifest,
    files,
    ...orphans.length ? { orphans } : {},
    ...hook ? { hook: { path: HOOK, sha256: sha256(lf(hook.content)) } } : {},
    ...partHooks.length ? { partHooks } : {}
  }, null, 2) + "\n";
  if (readText(target, ".harness/manifest.json") !== text2) safeWrite(target, ".harness/manifest.json", text2);
}

// tools/src/install/select.ts
function selectModules(prev, available, withList, withoutList) {
  const known = new Map(available.map((m) => [m.name, m]));
  const list = available.map((m) => m.name).join(", ") || "none";
  for (const name of [...withList, ...withoutList]) {
    if (!known.has(name)) throw new UsageError(`unknown module "${name}"; available: ${list}`);
  }
  const both = withList.filter((n) => withoutList.includes(n));
  if (both.length) throw new UsageError(`module ${both.join(", ")} is in both --with and --without`);
  const notes = [];
  const chosen = /* @__PURE__ */ new Set();
  if (prev === null) {
    for (const m of available) if (m.recommended) chosen.add(m.name);
  } else {
    for (const name of Array.isArray(prev.modules) ? prev.modules : []) {
      if (typeof name === "string" && known.has(name)) chosen.add(name);
      else notes.push(`unknown module ${JSON.stringify(name)} in the manifest; ignored`);
    }
    for (const m of available) {
      const agentFiles = m.agents.flatMap((a) => [`.claude/agents/${a}.md`, `.opencode/agents/${a}.md`]);
      if (prev.files.some((f) => f.startsWith(`.claude/skills/harness-${m.name}/`) || f.startsWith(`.harness/guides/${m.name}/`) || agentFiles.includes(f))) chosen.add(m.name);
    }
  }
  for (const n of withList) chosen.add(n);
  for (const n of withoutList) chosen.delete(n);
  return { modules: available.map((m) => m.name).filter((n) => chosen.has(n)), notes };
}

// tools/src/guard/agents.ts
import { statSync as statSync4 } from "node:fs";
import path9 from "node:path";
var SKIP = { skip: true };
var obj2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var str = (v) => typeof v === "string" ? v : void 0;
function isFile(p) {
  try {
    return statSync4(p).isFile();
  } catch {
    return false;
  }
}
function need(tool, input, keys) {
  if (!obj2(input)) return { error: `the ${tool} tool sent no input`, tool };
  const out2 = {};
  for (const k of keys) {
    const v = str(input[k]);
    if (v === void 0) return { error: `the ${tool} tool sent no ${k}`, tool };
    out2[k] = v;
  }
  return out2;
}
function searchOf(input, cwd, base) {
  const p = obj2(input) ? str(input.path) : void 0;
  if (!p) return SKIP;
  const abs = path9.resolve(cwd, p);
  return isFile(abs) ? { events: [{ tool: "read", path: abs, cwd, ...base }] } : SKIP;
}
function fromClaudeCode(raw, env) {
  if (!obj2(raw)) return { error: "the event is not a JSON object" };
  const cwd = str(raw.cwd);
  if (!cwd || !path9.isAbsolute(cwd)) return { error: "cwd must be an absolute path" };
  const root = env.CLAUDE_PROJECT_DIR && path9.isAbsolute(env.CLAUDE_PROJECT_DIR) ? { root: env.CLAUDE_PROJECT_DIR } : {};
  const input = raw.tool_input;
  const one = (tool, keys, make) => {
    const f = need(tool, input, keys);
    if ("error" in f) return f;
    return { events: [{ ...make(f), cwd, ...root }] };
  };
  switch (raw.tool_name) {
    case "Bash":
    case "Monitor":
      return one("shell", ["command"], (f) => ({ tool: "shell", shell: "posix", command: f.command }));
    case "PowerShell":
      return one("shell", ["command"], (f) => ({ tool: "shell", shell: "powershell", command: f.command }));
    case "Read":
      return one("read", ["file_path"], (f) => ({ tool: "read", path: f.file_path }));
    case "Write":
      return one("write", ["file_path", "content"], (f) => ({ tool: "write", path: f.file_path, content: f.content }));
    case "Edit":
      return one("edit", ["file_path", "new_string"], (f) => ({ tool: "edit", path: f.file_path, content: f.new_string }));
    case "NotebookEdit":
      return one("edit", ["notebook_path"], (f) => ({ tool: "edit", path: f.notebook_path, content: str(input.new_source) ?? "" }));
    case "Grep":
    case "Glob":
      return searchOf(input, cwd, root);
    default:
      return SKIP;
  }
}
function patchEvents(text2, cwd, root) {
  const out2 = [];
  let cur = null;
  for (const raw of text2.split(/\r?\n/)) {
    const line = raw.trimStart();
    const m = /^\*\*\*\s*(Add|Update|Delete)\s+File:\s*(.+)$/.exec(line);
    const move = /^\*\*\*\s*Move\s+to:\s*(.+)$/.exec(line);
    if (m) {
      cur = { tool: m[1] === "Delete" ? "write" : "edit", path: path9.resolve(cwd, m[2].trim()), content: "", cwd, root };
      out2.push(cur);
    } else if (move && cur) {
      const dest = { tool: "edit", path: path9.resolve(cwd, move[1].trim()), content: cur.content, cwd, root };
      cur.tool = "write";
      cur.content = "";
      out2.push(dest);
      cur = dest;
    } else if (line.startsWith("***")) {
      cur = null;
    } else if (cur && cur.tool === "edit" && raw.startsWith("+")) {
      cur.content += line.slice(1) + "\n";
    }
  }
  return out2;
}
function fromOpenCode(raw) {
  if (!obj2(raw)) return { error: "the event is not a JSON object" };
  const cwd = str(raw.cwd);
  if (!cwd || !path9.isAbsolute(cwd)) return { error: "cwd must be an absolute path" };
  const input = raw.input;
  const root = typeof raw.root === "string" && path9.isAbsolute(raw.root) ? raw.root : cwd;
  const at = (p) => path9.resolve(cwd, p);
  const one = (tool, keys, make) => {
    const f = need(tool, input, keys);
    if ("error" in f) return f;
    return { events: [{ ...make(f), cwd, root }] };
  };
  switch (raw.tool) {
    // OpenCode's shell was Git Bash on Windows (ADR 0007, point 7)
    case "shell":
    case "bash":
      return one("shell", ["command"], (f) => ({ tool: "shell", shell: "posix", command: f.command }));
    case "read":
      return one("read", ["path"], (f) => ({ tool: "read", path: at(f.path) }));
    case "write":
      return one("write", ["path", "content"], (f) => ({ tool: "write", path: at(f.path), content: f.content }));
    case "edit":
      return one("edit", ["path", "newString"], (f) => ({ tool: "edit", path: at(f.path), content: f.newString }));
    case "patch":
    case "apply_patch": {
      const text2 = obj2(input) ? str(input.patchText) ?? str(input.patch) ?? str(input.input) : void 0;
      const events = text2 ? patchEvents(text2, cwd, root) : [];
      return events.length ? { events } : { error: "the patch names no file", tool: "edit" };
    }
    case "grep":
    case "glob":
      return searchOf(input, cwd, { root });
    default:
      return SKIP;
  }
}
function toClaudeCode(v) {
  if (v.decision === "allow") return "";
  const reason = `harness: ${v.reason}${v.alternative ? ` \u2014 ${v.alternative}` : ""}`;
  return JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: v.decision, permissionDecisionReason: reason } });
}
var ADAPTERS = {
  "claude-code": { from: fromClaudeCode, answer: toClaudeCode },
  opencode: { from: (raw) => fromOpenCode(raw), answer: (v) => JSON.stringify(v) + "\n" }
};
var AGENTS = Object.keys(ADAPTERS);

// tools/src/commands/init.ts
var TESTED_WITH = { "claude-code": "2.1.318", opencode: "2.2.5" };
function parseAgents(value) {
  if (!value) return [...AGENTS];
  const list = value.split(",").map((s) => s.trim()).filter(Boolean);
  for (const a of list) if (!AGENTS.includes(a)) throw new UsageError(`unknown agent "${a}"; use ${AGENTS.join(" or ")}`);
  return AGENTS.filter((a) => list.includes(a));
}
var names = (value) => (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
var GREENFIELD = "greenfield";
var NOT_WORK = /* @__PURE__ */ new Set([".git", ".harness", ".claude", ".opencode", "AGENTS.md", "CLAUDE.md", ".gitignore", ".gitattributes"]);
function looksNew(root) {
  let entries;
  try {
    entries = readdirSync4(root);
  } catch {
    return false;
  }
  return entries.every((e) => NOT_WORK.has(e) || /^(readme|license|licence)(\.[^.]+)?$/i.test(e));
}
function initCommand(flags, io) {
  const agents = parseAgents(flags.agent);
  const bundlePath = fileURLToPath(import.meta.url);
  const harnessRoot = path10.dirname(path10.dirname(bundlePath));
  if (!bundlePath.endsWith(".mjs") || !existsSync3(path10.join(harnessRoot, "core", "skills", "harness-start", "SKILL.md"))) {
    throw new UsageError("run init with the built CLI of the harness repository (npm run build, then node dist/harness.mjs init)");
  }
  const m = readJson(flags.cwd, MANIFEST);
  const prev = m.ok && Array.isArray(m.value?.files) ? { modules: m.value.modules, files: m.value.files.map((f) => f?.path).filter(isInstallPath) } : null;
  const { modules, notes } = selectModules(prev, listModules(harnessRoot), [...names(flags.with), ...flags.new ? [GREENFIELD] : []], names(flags.without));
  if (!flags.new && !modules.includes(GREENFIELD) && looksNew(flags.cwd)) {
    notes.push("empty repository: harness init --new adds a guided start (guide greenfield)");
  }
  const ops = planInstall(flags.cwd, { agents, modules, harnessRoot, bundlePath });
  if (!flags.dryRun) {
    applyInstall(flags.cwd, ops, {
      schemaVersion: 1,
      harnessVersion: VERSION,
      agents,
      modules,
      testedWith: TESTED_WITH,
      gitignore: GITIGNORE_ENTRIES
    });
  }
  const pending = ops.filter((op) => op.action === "conflict" || op.action === "propose");
  if (flags.json) {
    io.out(JSON.stringify({ dryRun: flags.dryRun, modules, notes, ops: ops.map(({ path: path31, action, note }) => ({ path: path31, action, note })) }, null, 2) + "\n");
  } else {
    if (flags.dryRun) io.out("Dry run: nothing written.\n");
    for (const note of notes) io.out(`note: ${note}
`);
    io.out(`modules: ${modules.join(", ") || "none"}
`);
    for (const op of ops) io.out(`  ${op.action.padEnd(9)} ${op.path}${op.note ? `  (${op.note})` : ""}
`);
    for (const op of pending) if (op.previous === void 0 && !op.orphan) io.out(`
--- ${op.action} ${op.path} ---
${op.content}`);
    if (!flags.dryRun) io.out(`
Next: node .harness/bin/harness.mjs detect
`);
  }
  return pending.length ? 3 : 0;
}

// tools/src/commands/guard.ts
import { readFileSync as readFileSync8 } from "node:fs";

// tools/src/guard/types.ts
var DEFAULT_CONFIG = {
  protectedBranches: ["main", "master", "dev", "develop", "development"],
  // ADR 0005
  productionPatterns: [],
  extraSecretPaths: [],
  secretFileRead: "deny",
  mainPush: "ask"
};
var MAX_DEPTH2 = 8;
var OK = { decision: "allow", category: "ok", reason: "no rule applies" };
var RANK = { allow: 0, ask: 1, deny: 2 };
function strongest(vs) {
  return vs.reduce((best, v) => RANK[v.decision] > RANK[best.decision] ? v : best, OK);
}

// tools/src/guard/config.ts
var strings = (v) => Array.isArray(v) && v.every((s) => typeof s === "string");
function loadGuardConfig(root) {
  const read = readJson(root, ".harness/overrides.json");
  if (!read.ok) return read.reason === "missing" ? { config: DEFAULT_CONFIG } : { config: DEFAULT_CONFIG, warning: "guard config ignored: overrides.json is not valid JSON" };
  const g = read.value?.guard;
  if (g === void 0) return { config: DEFAULT_CONFIG };
  const bad = (why) => ({ config: DEFAULT_CONFIG, warning: `guard config ignored: ${why}` });
  if (typeof g !== "object" || g === null || Array.isArray(g)) return bad("guard must be an object");
  for (const k of ["protectedBranches", "productionPatterns", "extraSecretPaths"]) {
    if (g[k] !== void 0 && !strings(g[k])) return bad(`${k} must be a list of strings`);
  }
  if (g.secretFileRead !== void 0 && g.secretFileRead !== "deny" && g.secretFileRead !== "ask") return bad("secretFileRead must be deny or ask");
  if (g.mainPush !== void 0 && g.mainPush !== "deny" && g.mainPush !== "ask") return bad("mainPush must be ask or deny");
  for (const p of g.productionPatterns ?? []) {
    try {
      new RegExp(p);
    } catch {
      return bad(`productionPatterns has an invalid regex: ${p}`);
    }
  }
  const protectedBranches = [.../* @__PURE__ */ new Set([...DEFAULT_CONFIG.protectedBranches, ...g.protectedBranches ?? []])];
  return { config: { ...DEFAULT_CONFIG, ...g, protectedBranches } };
}

// tools/src/guard/event.ts
import path11 from "node:path";
var TOOLS = ["shell", "read", "write", "edit", "other"];
function parseEvent(text2) {
  let raw;
  try {
    raw = JSON.parse(text2);
  } catch {
    return { error: "the event is not valid JSON" };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { error: "the event is not a JSON object" };
  const tool = typeof raw.tool === "string" ? raw.tool : void 0;
  if (!tool || !TOOLS.includes(tool)) return { error: `unknown tool ${JSON.stringify(raw.tool)}`, tool };
  if (typeof raw.cwd !== "string" || !path11.isAbsolute(raw.cwd)) return { error: "cwd must be an absolute path", tool };
  const str2 = (k) => typeof raw[k] === "string" ? raw[k] : void 0;
  const bad = ["command", "path", "content", "root"].find((k) => raw[k] !== void 0 && raw[k] !== null && typeof raw[k] !== "string");
  if (bad) return { error: `${bad} must be a string`, tool };
  if (tool === "shell" && !str2("command")) return { error: "a shell event needs a command", tool };
  if ((tool === "read" || tool === "write" || tool === "edit") && !str2("path")) return { error: `a ${tool} event needs a path`, tool };
  if (raw.shell !== void 0 && raw.shell !== "posix" && raw.shell !== "powershell") return { error: "shell must be posix or powershell", tool };
  return {
    tool,
    shell: raw.shell,
    command: str2("command"),
    path: str2("path"),
    content: str2("content"),
    cwd: raw.cwd,
    root: typeof raw.root === "string" && path11.isAbsolute(raw.root) ? raw.root : void 0
  };
}

// tools/src/guard/judge.ts
import { existsSync as existsSync5 } from "node:fs";
import os2 from "node:os";
import path21 from "node:path";

// tools/src/guard/rules/destructive.ts
import { lstatSync as lstatSync2, readdirSync as readdirSync6 } from "node:fs";
import path15 from "node:path";

// tools/src/guard/paths.ts
import { realpathSync } from "node:fs";
import path12 from "node:path";
var foldCase = process.platform !== "linux";
var key = (p) => foldCase ? p.toLowerCase() : p;
function resolvePath(p, cwd, home) {
  let s = p;
  if (s === "~") s = home;
  else if (/^~[\\/]/.test(s)) s = path12.join(home, s.slice(2));
  if (process.platform === "win32") {
    const drive = /^\/([a-zA-Z])(\/|$)/.exec(s);
    if (drive) s = `${drive[1].toUpperCase()}:\\${s.slice(3)}`;
  }
  return path12.resolve(cwd, s);
}
function canonical(p) {
  const rest = [];
  for (let cur = path12.resolve(p); ; ) {
    try {
      return path12.join(realpathSync.native(cur), ...rest.reverse());
    } catch {
      const parent = path12.dirname(cur);
      if (parent === cur) return path12.resolve(p);
      rest.push(path12.basename(cur));
      cur = parent;
    }
  }
}
function sameFile(a, b) {
  return key(canonical(a)) === key(canonical(b));
}
function isInside(p, root) {
  return within2(canonical(p), canonical(root));
}
function within2(p, dir) {
  const rel2 = path12.relative(key(dir), key(p));
  return rel2 === "" || rel2 !== ".." && !rel2.startsWith(".." + path12.sep) && !path12.isAbsolute(rel2);
}
function extraRegex(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      re += glob[i + 2] === "/" ? "(?:.*/)?" : ".*";
      i += glob[i + 2] === "/" ? 2 : 1;
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, foldCase ? "i" : "");
}
function isSecretPath(p, extra, root, home) {
  if (secretName(p)) return true;
  const real = path12.isAbsolute(p) ? canonical(p) : p;
  if (real !== p && secretName(real)) return true;
  if (home && path12.basename(real).toLowerCase() === ".npmrc" && sameFile(path12.dirname(real), home)) return true;
  if (extra.length) {
    const norm = p.replace(/\\/g, "/");
    const rel2 = root && isInside(p, root) ? path12.relative(canonical(root), real).replace(/\\/g, "/") : norm;
    if (extra.some((g) => extraRegex(g.replace(/\\/g, "/")).test(rel2))) return true;
  }
  return false;
}
function secretName(p) {
  let parts = p.replace(/\\/g, "/").toLowerCase().split("/").filter(Boolean);
  if (process.platform === "win32") parts = parts.map((s, i) => i === 0 && /^[a-z]:$/.test(s) ? s : s.replace(/:.*$/, "").replace(/[. ]+$/, ""));
  const base = parts.at(-1) ?? "";
  if (/\.(example|sample|template|dist|pub)$/.test(base)) return false;
  if (/^\.env($|[.\-_])/.test(base) || base === ".envrc") return true;
  if (/\.(pem|key|p12|pfx|ppk)$/.test(base)) return true;
  if (/^id_(rsa|ed25519|ecdsa)/.test(base)) return true;
  const parent = parts.at(-2) ?? "";
  if (base === ".git-credentials" || base === "credentials.json") return true;
  if (parent === ".aws" && base === "credentials" || parent === ".docker" && base === "config.json") return true;
  if ((parent === "gh" || parent === "github cli") && base === "hosts.yml") return true;
  return parts.slice(0, -1).includes("secrets");
}

// tools/src/guard/shell/commands.ts
import path14 from "node:path";

// tools/src/guard/shell/expand.ts
import { existsSync as existsSync4, readdirSync as readdirSync5, readFileSync as readFileSync6, statSync as statSync5 } from "node:fs";
import path13 from "node:path";

// tools/src/guard/shell/lex.ts
var Unreadable = class extends Error {
};
var GLOB = "*?[]{}~\\";
var esc = (ch, dollar) => GLOB.includes(ch) || dollar && ch === "$" ? "\\" + ch : ch;
var escAll = (s, dollar) => [...s].map((ch) => esc(ch, dollar)).join("");
var unescapeBacktick = (s) => s.replace(/\\([`$\\])/g, "$1");
var deep = (depth) => {
  if (depth > MAX_DEPTH2) throw new Unreadable(`substitutions nested too deep (more than ${MAX_DEPTH2} levels)`);
};
function closeSingle(s, j, ps) {
  let k = s.indexOf("'", j);
  while (ps && k >= 0 && s[k + 1] === "'") k = s.indexOf("'", k + 2);
  if (k < 0) throw new Unreadable("unclosed single quote");
  return k;
}
function scanBacktick(s, j, depth) {
  deep(depth);
  for (; j < s.length; j++) {
    if (s[j] === "\\") j++;
    else if (s[j] === "`") return j;
  }
  throw new Unreadable("unclosed backtick");
}
function scanDouble(s, j, depth, ps) {
  while (j < s.length) {
    const c = s[j];
    if (!ps && c === "\\" || ps && c === "`") j += 2;
    else if (c === '"') {
      if (ps && s[j + 1] === '"') j += 2;
      else return j;
    } else if (c === "$" && s[j + 1] === "(") j = scanParen(s, j + 2, depth + 1, ps) + 1;
    else if (!ps && c === "`") j = scanBacktick(s, j + 1, depth + 1) + 1;
    else j++;
  }
  throw new Unreadable("unclosed double quote");
}
function scanParen(s, j, depth, ps) {
  deep(depth);
  let level = 0;
  while (j < s.length) {
    const c = s[j];
    if (!ps && c === "\\" || ps && c === "`") j += 2;
    else if (c === "'") j = closeSingle(s, j + 1, ps) + 1;
    else if (c === '"') j = scanDouble(s, j + 1, depth, ps) + 1;
    else if (!ps && c === "`") j = scanBacktick(s, j + 1, depth + 1) + 1;
    else if ((c === "$" || ps && c === "@") && s[j + 1] === "(") j = scanParen(s, j + 2, depth + 1, ps) + 1;
    else if (c === "(") {
      level++;
      j++;
    } else if (c === ")") {
      if (level === 0) return j;
      level--;
      j++;
    } else j++;
  }
  throw new Unreadable("unclosed $(");
}
function scanBrace(s, j) {
  let level = 0;
  while (j < s.length) {
    const c = s[j];
    if (c === "\\") j += 2;
    else if (c === "'") j = closeSingle(s, j + 1, false) + 1;
    else if (c === '"') j = scanDouble(s, j + 1, 1, false) + 1;
    else if (c === "`") j = scanBacktick(s, j + 1, 1) + 1;
    else if (c === "$" && s[j + 1] === "(") j = scanParen(s, j + 2, 1, false) + 1;
    else if (c === "{") {
      level++;
      j++;
    } else if (c === "}") {
      if (level === 0) return j;
      level--;
      j++;
    } else j++;
  }
  throw new Unreadable("unclosed ${");
}
function extractSubs(s, ps, quotesLiteral) {
  const subs = [];
  let j = 0;
  while (j < s.length) {
    const c = s[j];
    if (!ps && c === "\\" || ps && c === "`") j += 2;
    else if (!quotesLiteral && c === "'") j = closeSingle(s, j + 1, ps) + 1;
    else if ((c === "$" || ps && c === "@") && s[j + 1] === "(") {
      const e = scanParen(s, j + 2, 1, ps);
      subs.push(s.slice(j + 2, e));
      j = e + 1;
    } else if (!ps && c === "`") {
      const e = scanBacktick(s, j + 1, 1);
      subs.push(unescapeBacktick(s.slice(j + 1, e)));
      j = e + 1;
    } else j++;
  }
  return subs;
}
var PS_KEYWORDS = /* @__PURE__ */ new Set(["if", "elseif", "while", "until", "for", "foreach", "switch", "function", "filter", "param", "catch", "trap", "data", "workflow", "configuration"]);
var ANSI_C = { n: "\n", t: "	", r: "\r", "\\": "\\", "'": "'", '"': '"', a: "\x07", e: "\x1B" };
var Lexer = class {
  s;
  ps;
  i = 0;
  tokens = [];
  pending = [];
  constructor(s, shell) {
    this.s = s;
    this.ps = shell === "powershell";
  }
  isDelim(c) {
    return " 	\r\n;&|()<>".includes(c) || this.ps && (c === "{" || c === "}");
  }
  run() {
    const { s, ps } = this;
    while (this.i < s.length) {
      const c = s[this.i];
      const nx = s[this.i + 1];
      if (c === " " || c === "	" || c === "\r") this.i++;
      else if (c === "\n") {
        this.op("\n", 1);
        this.readHeredocs();
      } else if (ps && c === "<" && nx === "#") {
        const e = s.indexOf("#>", this.i + 2);
        if (e < 0) throw new Unreadable("unclosed block comment");
        this.i = e + 2;
      } else if (c === "#") {
        const e = s.indexOf("\n", this.i);
        this.i = e < 0 ? s.length : e;
      } else if (c === "&" && nx === "&") this.op("&&", 2);
      else if (c === "|" && nx === "|") this.op("||", 2);
      else if (!ps && c === ";" && nx === ";") this.op(";", 2);
      else if (!ps && c === "|" && nx === "&") this.op("|", 2);
      else if (ps && c === "(" && this.argumentAt()) {
        const glued = s[this.i - 1] === ":" ? this.tokens.pop() : void 0;
        const w = this.readWord(true);
        if (glued?.type === "word") {
          w.text = glued.text + w.text;
          w.pat = glued.pat + w.pat;
          w.subs.unshift(...glued.subs);
        }
        this.pushWord(w);
      } else if (c === ";" || c === "|" || c === "(" || c === ")") this.op(c, 1);
      else if (ps && (c === "{" || c === "}")) this.op(c === "{" ? "(" : ")", 1);
      else if (!ps && c === "&" && nx === ">") {
        this.i++;
        this.redirect("&");
      } else if (c === "&") {
        if (ps) this.tokens.push({ type: "word", text: "&", pat: "&", quoted: false, subs: [] });
        else this.tokens.push({ type: "op", text: "&" });
        this.i++;
      } else if (!ps && (c === "<" || c === ">") && nx === "(") {
        const e = scanParen(s, this.i + 2, 1, false);
        const raw = s.slice(this.i, e + 1);
        this.tokens.push({ type: "word", text: raw, pat: raw, quoted: false, subs: [s.slice(this.i + 2, e)] });
        this.i = e + 1;
      } else if (c === "<" || c === ">") this.redirect("");
      else {
        const w = this.readWord();
        const next = s[this.i];
        if ((next === "<" || next === ">") && !w.quoted && (/^\d+$/.test(w.text) || ps && w.text === "*")) this.redirect(w.text);
        else this.pushWord(w);
      }
    }
    return this.tokens;
  }
  pushWord(w) {
    this.tokens.push({ type: "word", text: w.text, pat: w.pat, quoted: w.quoted, subs: w.subs });
  }
  /**
   * PowerShell: whether a "(" here is a command's argument, like Remove-Item (Resolve-Path ~), and not a group
   * of commands or the condition of if, foreach, while and the like. An argument starts after a blank, or right
   * after a parameter's colon (-Path:(...)); a "(" glued to a word is a method call.
   */
  argumentAt() {
    const before = this.s[this.i - 1];
    let first = -1;
    for (let k = this.tokens.length - 1; k >= 0 && this.tokens[k].type !== "op"; k--) first = k;
    if (first < 0) return false;
    const head = this.tokens[first];
    if (head.type !== "word" || PS_KEYWORDS.has(head.text.toLowerCase()) || head.text.startsWith("$")) return false;
    const last = this.tokens[this.tokens.length - 1];
    if (before === " " || before === "	") return true;
    return last.type === "word" && last.text.endsWith(":") && last.text.startsWith("-");
  }
  op(text2, len) {
    this.tokens.push({ type: "op", text: text2 });
    this.i += len;
  }
  redirect(prefix) {
    const { s } = this;
    if (!this.ps && s.startsWith("<<", this.i) && s[this.i + 2] !== "<") return this.heredoc();
    const spelled = ["<<<", ">>", ">|", "<>"].find((o) => s.startsWith(o, this.i)) ?? s[this.i];
    const op = spelled === ">|" ? ">" : spelled;
    this.i += spelled.length;
    let dup = "";
    if (s[this.i] === "&" && op !== "<<<") {
      dup = "&";
      this.i++;
    }
    this.skipBlanks();
    const w = this.readWord();
    if (!w.any) throw new Unreadable("a redirection has no target");
    this.tokens.push({ type: "redir", op: prefix + op, target: dup + w.text, pat: dup + w.pat, subs: w.subs });
  }
  heredoc() {
    const strip = this.s[this.i + 2] === "-";
    this.i += strip ? 3 : 2;
    this.skipBlanks();
    const w = this.readWord();
    if (!w.any) throw new Unreadable("a heredoc has no delimiter");
    const tok = { type: "heredoc", body: "", quoted: w.quoted, subs: [] };
    this.tokens.push(tok);
    this.pending.push({ tok, delim: w.text, strip });
  }
  readHeredocs() {
    const { s } = this;
    for (const h of this.pending) {
      let body = "";
      while (this.i < s.length) {
        let e = s.indexOf("\n", this.i);
        if (e < 0) e = s.length;
        let line = s.slice(this.i, e).replace(/\r$/, "");
        if (h.strip) line = line.replace(/^\t+/, "");
        this.i = Math.min(e + 1, s.length);
        if (line === h.delim) break;
        body += line + "\n";
      }
      h.tok.body = body;
      if (!h.tok.quoted) h.tok.subs = extractSubs(body, false, true);
    }
    this.pending = [];
  }
  skipBlanks() {
    while (this.s[this.i] === " " || this.s[this.i] === "	") this.i++;
  }
  /** paren: the word starts with a PowerShell "(" in argument position, read as the $(...) it amounts to. */
  readWord(paren = false) {
    const { s, ps } = this;
    const w = { text: "", pat: "", quoted: false, subs: [], any: false };
    const lit = (str2, dollar) => {
      w.text += str2;
      w.pat += escAll(str2, dollar);
    };
    const raw = (str2) => {
      w.text += str2;
      w.pat += str2;
    };
    if (paren) {
      const e = scanParen(s, this.i + 1, 1, true);
      w.subs.push(s.slice(this.i + 1, e));
      raw("$" + s.slice(this.i, e + 1));
      w.any = true;
      this.i = e + 1;
    }
    while (this.i < s.length && !this.isDelim(s[this.i])) {
      const c = s[this.i];
      const nx = s[this.i + 1];
      w.any = true;
      if (ps && c === "$" && nx === "{") {
        let e = this.i + 2;
        while (e < s.length && s[e] !== "}") e += s[e] === "`" ? 2 : 1;
        if (e >= s.length) throw new Unreadable("unclosed ${");
        raw(s.slice(this.i, e + 1));
        this.i = e + 1;
      } else if (!ps && c === "\\" || ps && c === "`") {
        if (nx === "\n") this.i += 2;
        else if (nx === "\r" && s[this.i + 2] === "\n") this.i += 3;
        else if (nx === void 0) {
          lit(c, true);
          this.i++;
        } else {
          w.quoted = true;
          lit(nx, true);
          this.i += 2;
        }
      } else if (c === "'") {
        const e = closeSingle(s, this.i + 1, ps);
        const body = s.slice(this.i + 1, e);
        w.quoted = true;
        lit(ps ? body.replaceAll("''", "'") : body, true);
        this.i = e + 1;
      } else if (!ps && c === "$" && nx === "'") {
        let j = this.i + 2;
        let body = "";
        for (; j < s.length && s[j] !== "'"; j++) {
          if (s[j] === "\\" && j + 1 < s.length) body += ANSI_C[s[++j]] ?? "\\" + s[j];
          else body += s[j];
        }
        if (j >= s.length) throw new Unreadable("unclosed single quote");
        w.quoted = true;
        lit(body, true);
        this.i = j + 1;
      } else if (c === '"' || !ps && c === "$" && nx === '"') {
        if (c === "$") this.i++;
        w.quoted = true;
        this.readDouble(w, lit, raw);
      } else if (ps && c === "@" && (nx === "'" || nx === '"') && /^[ \t]*\r?\n/.test(s.slice(this.i + 2, this.i + 40))) {
        const end = s.indexOf("\n" + nx + "@", this.i + 2);
        if (end < 0) throw new Unreadable("unclosed here-string");
        const body = s.slice(s.indexOf("\n", this.i + 2) + 1, end).replace(/\r$/, "");
        w.quoted = true;
        lit(body, true);
        if (nx === '"') w.subs.push(...extractSubs(body, true, true));
        this.i = end + 3;
      } else if ((c === "$" || ps && c === "@") && nx === "(") {
        const e = scanParen(s, this.i + 2, 1, ps);
        w.subs.push(s.slice(this.i + 2, e));
        raw(s.slice(this.i, e + 1));
        this.i = e + 1;
      } else if (!ps && c === "`") {
        const e = scanBacktick(s, this.i + 1, 1);
        w.subs.push(unescapeBacktick(s.slice(this.i + 1, e)));
        raw(s.slice(this.i, e + 1));
        this.i = e + 1;
      } else if (!ps && c === "$" && nx === "{") {
        const e = scanBrace(s, this.i + 2);
        w.subs.push(...extractSubs(s.slice(this.i + 2, e), false, false));
        raw(s.slice(this.i, e + 1));
        this.i = e + 1;
      } else if (ps && c === "\\") {
        lit(c, false);
        this.i++;
      } else {
        raw(c);
        this.i++;
      }
    }
    return w;
  }
  readDouble(w, lit, raw) {
    const { s, ps } = this;
    let j = this.i + 1;
    for (; ; ) {
      if (j >= s.length) throw new Unreadable("unclosed double quote");
      const c = s[j];
      const nx = s[j + 1];
      if (c === '"' && ps && nx === '"') {
        lit('"', false);
        j += 2;
      } else if (c === '"') break;
      else if (!ps && c === "\\") {
        if (nx === "\n") j += 2;
        else if (nx !== void 0 && '$`"\\'.includes(nx)) {
          lit(nx, true);
          j += 2;
        } else {
          lit("\\", false);
          j++;
        }
      } else if (ps && c === "`") {
        if (nx === void 0) throw new Unreadable("unclosed double quote");
        lit(nx, true);
        j += 2;
      } else if (c === "$" && nx === "(") {
        const e = scanParen(s, j + 2, 1, ps);
        w.subs.push(s.slice(j + 2, e));
        raw(s.slice(j, e + 1));
        j = e + 1;
      } else if (!ps && c === "`") {
        const e = scanBacktick(s, j + 1, 1);
        w.subs.push(unescapeBacktick(s.slice(j + 1, e)));
        raw(s.slice(j, e + 1));
        j = e + 1;
      } else if (!ps && c === "$" && nx === "{") {
        const e = scanBrace(s, j + 2);
        w.subs.push(...extractSubs(s.slice(j + 2, e), false, false));
        raw(s.slice(j, e + 1));
        j = e + 1;
      } else if (ps && c === "$" && nx === "{") {
        let e = j + 2;
        while (e < s.length && s[e] !== "}") e += s[e] === "`" ? 2 : 1;
        if (e >= s.length) throw new Unreadable("unclosed ${");
        raw(s.slice(j, e + 1));
        j = e + 1;
      } else if (c === "$") {
        raw(c);
        j++;
      } else {
        lit(c, false);
        j++;
      }
    }
    this.i = j + 1;
  }
};
function lex(cmd, shell) {
  try {
    return new Lexer(cmd, shell).run();
  } catch (e) {
    if (e instanceof Unreadable) return { unreadable: e.message };
    throw e;
  }
}

// tools/src/guard/shell/expand.ts
var UNKNOWN = "\0unknown";
var BRANCH = "\0branch";
var GIT_FILES = "\0gitfiles";
var FOUND = "\0find";
var isKnown = (s) => !s.includes("\0");
var MAX_BRACES = 1024;
var MAX_GLOB = 4096;
var MAX_WORD = 4096;
var BRANCH_SUB = /^\s*git\s+(rev-parse\s+--abbrev-ref\s+HEAD|branch\s+--show-current|symbolic-ref\s+--short\s+HEAD)\s*(2>\s*\/dev\/null)?\s*$/;
function subValue(inner, scope) {
  if (BRANCH_SUB.test(inner)) return BRANCH;
  if (/^\s*pwd\s*$/.test(inner) && scope.cwd !== null) return scope.cwd;
  if (/^\s*git\s+rev-parse\s+--show-toplevel\s*$/.test(inner) && scope.cwd !== null) {
    const moved = ["GIT_DIR", "GIT_WORK_TREE", "GIT_CEILING_DIRECTORIES", "GIT_DISCOVERY_ACROSS_FILESYSTEM"].some((k) => scope.vars.has(k) || process.env[k] !== void 0);
    return moved ? UNKNOWN : topLevel(scope.cwd) ?? UNKNOWN;
  }
  return UNKNOWN;
}
function topLevel(dir) {
  for (let d = path13.resolve(dir); ; d = path13.dirname(d)) {
    const dotGit = path13.join(d, ".git");
    try {
      if (statSync5(dotGit).isDirectory() ? existsSync4(path13.join(dotGit, "HEAD")) : readFileSync6(dotGit, "utf8").startsWith("gitdir:")) return d;
    } catch {
    }
    if (path13.dirname(d) === d) return null;
  }
}
var unescape = (e) => e.replace(/\\([\s\S])/g, "$1");
function lookup(name, scope) {
  if (scope.ps) {
    const n = name.toLowerCase();
    if (n === "home" || n === "env:home" || n === "env:userprofile") return scope.vars.get(n) ?? scope.home;
    if (n === "null" || n === "true" || n === "false") return `$${n}`;
    return scope.vars.get(n);
  }
  if (name === "HOME") return scope.vars.get(name) ?? scope.home;
  if (name === "PWD") return scope.cwd ?? void 0;
  return scope.vars.get(name);
}
function globRegex(seg, starCrossesSlash, ignoreCase) {
  const any = starCrossesSlash ? "[\\s\\S]" : "[^/]";
  let re = "";
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i];
    if (c === "\\") re += (seg[++i] ?? "\\").replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
    else if (c === "*") re += any + "*";
    else if (c === "?") re += any;
    else if (c === "[" && seg.indexOf("]", i + 2) > 0) {
      const e = seg.indexOf("]", i + 2);
      let cls = seg.slice(i + 1, e).replace(/\\/g, "\\\\");
      if (cls[0] === "!" || cls[0] === "^") cls = "^" + cls.slice(1);
      re += `[${cls}]`;
      i = e;
    } else re += c.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, ignoreCase ? "i" : "");
}
function trim(v, op, pattern) {
  const re = globRegex(pattern, true, false);
  const n = v.length;
  if (op === "%") {
    for (let k = n; k >= 0; k--) if (re.test(v.slice(k))) return v.slice(0, k);
  }
  if (op === "%%") {
    for (let k = 0; k <= n; k++) if (re.test(v.slice(k))) return v.slice(0, k);
  }
  if (op === "#") {
    for (let k = 0; k <= n; k++) if (re.test(v.slice(0, k))) return v.slice(k);
  }
  if (op === "##") {
    for (let k = n; k >= 0; k--) if (re.test(v.slice(0, k))) return v.slice(k);
  }
  return v;
}
function param(inner, scope) {
  if (scope.ps) return lookup(inner, scope) ?? UNKNOWN;
  const m = /^([A-Za-z_][A-Za-z0-9_]*|[0-9]+|[@*#?$!-])([\s\S]*)$/.exec(inner);
  if (!m) return UNKNOWN;
  const [, name, rest] = m;
  const v = lookup(name, scope);
  if (rest === "") return v ?? UNKNOWN;
  const o = /^(:?[-=?+]|%%|%|##|#)([\s\S]*)$/.exec(rest);
  if (!o) return UNKNOWN;
  const [, op, raw] = o;
  const word = () => unescape(substitute(raw.replace(/^(["'])([\s\S]*)\1$/, "$2"), scope));
  if (v === void 0) return UNKNOWN;
  if (!isKnown(v)) return op[op.length - 1] === "+" ? word() : UNKNOWN;
  switch (op) {
    case ":-":
    case ":=": {
      if (v !== "") return v;
      const w = word();
      if (op === ":=") scope.vars.set(name, w);
      return w;
    }
    case "-":
    case "=":
    case ":?":
    case "?":
      return v;
    case ":+":
      return v === "" ? "" : word();
    case "+":
      return word();
    default:
      return trim(v, op, raw);
  }
}
function substitute(pat, scope) {
  const { ps } = scope;
  const value = (v) => escAll(v, false);
  let out2 = "";
  let i = 0;
  while (i < pat.length) {
    const c = pat[i];
    const nx = pat[i + 1];
    if (c === "\\") {
      out2 += pat.slice(i, i + 2);
      i += 2;
    } else if ((c === "$" || ps && c === "@") && nx === "(") {
      const e = scanParen(pat, i + 2, 1, ps);
      out2 += value(subValue(pat.slice(i + 2, e), scope));
      i = e + 1;
    } else if (!ps && c === "`") {
      const e = scanBacktick(pat, i + 1, 1);
      out2 += value(subValue(unescapeBacktick(pat.slice(i + 1, e)), scope));
      i = e + 1;
    } else if (c === "$" && nx === "{") {
      const e = scanBrace(pat, i + 2);
      out2 += value(param(pat.slice(i + 2, e), scope));
      i = e + 1;
    } else if (c === "$") {
      const m = (ps ? /^(env:)?[A-Za-z_][A-Za-z0-9_]*/i : /^([A-Za-z_][A-Za-z0-9_]*|[0-9@*#?$!-])/).exec(pat.slice(i + 1));
      if (m) {
        out2 += value(lookup(m[0], scope) ?? UNKNOWN);
        i += 1 + m[0].length;
      } else {
        out2 += c;
        i++;
      }
    } else if (c === "~" && i === 0 && (nx === void 0 || nx === "/" || pat.startsWith("\\\\", 1))) {
      out2 += value(scope.home);
      i++;
    } else {
      out2 += c;
      i++;
    }
  }
  return out2;
}
function hasGlob(e) {
  for (let i = 0; i < e.length; i++) {
    if (e[i] === "\\") i++;
    else if (e[i] === "*" || e[i] === "?" || e[i] === "[") return true;
  }
  return false;
}
function findBrace(s) {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\") {
      i++;
      continue;
    }
    if (s[i] !== "{") continue;
    let depth = 0;
    const cuts = [];
    for (let j = i + 1; j < s.length; j++) {
      const c = s[j];
      if (c === "\\") j++;
      else if (c === "{") depth++;
      else if (c === "," && depth === 0) cuts.push(j);
      else if (c === "}") {
        if (depth > 0) {
          depth--;
          continue;
        }
        if (!cuts.length) break;
        const alts = [];
        let from = i + 1;
        for (const k of [...cuts, j]) {
          alts.push(s.slice(from, k));
          from = k + 1;
        }
        return { start: i, end: j, alts };
      }
    }
  }
  return null;
}
function braceExpand(e) {
  const out2 = [];
  const rec = (s) => {
    const b = findBrace(s);
    if (!b) {
      out2.push(s);
      if (out2.length > MAX_BRACES) throw new Unreadable(`brace expansion gives more than ${MAX_BRACES} words`);
      return;
    }
    for (const alt of b.alts) rec(s.slice(0, b.start) + alt + s.slice(b.end + 1));
  };
  rec(e);
  return out2;
}
function isDir2(full) {
  try {
    return statSync5(full).isDirectory();
  } catch {
    return false;
  }
}
function globExpand(e, cwd, scope) {
  const winSep = scope.ps || process.platform === "win32";
  const segs = [];
  let seg = "";
  for (let i = 0; i < e.length; i++) {
    if (e[i] === "\\") {
      if (winSep && e[i + 1] === "\\") {
        segs.push(seg);
        seg = "";
      } else seg += e.slice(i, i + 2);
      i++;
    } else if (e[i] === "/") {
      segs.push(seg);
      seg = "";
    } else seg += e[i];
  }
  segs.push(seg);
  let rest = segs;
  let cur;
  if (segs[0] === "" && segs.length > 1) {
    cur = [{ fs: path13.resolve("/"), out: "/" }];
    rest = segs.slice(1);
  } else if (/^[A-Za-z]:$/.test(unescape(segs[0]))) {
    cur = [{ fs: unescape(segs[0]) + "/", out: unescape(segs[0]) + "/" }];
    rest = segs.slice(1);
  } else cur = [{ fs: cwd, out: "" }];
  const ignoreCase = process.platform !== "linux";
  for (let k = 0; k < rest.length; k++) {
    const s = rest[k];
    const last = k === rest.length - 1;
    if (s === "") continue;
    if (!hasGlob(s)) {
      const lit = unescape(s);
      cur = cur.map((x) => ({ fs: path13.join(x.fs, lit), out: x.out + lit + (last ? "" : "/") }));
      continue;
    }
    const re = globRegex(s, false, ignoreCase);
    const dot = unescape(s).startsWith(".");
    const next = [];
    for (const x of cur) {
      scope.check();
      let names2;
      try {
        names2 = readdirSync5(x.fs).sort();
      } catch {
        continue;
      }
      for (const name of names2) {
        if (!dot && name.startsWith(".") || !re.test(name)) continue;
        const full = path13.join(x.fs, name);
        if (!last && !isDir2(full)) continue;
        next.push({ fs: full, out: x.out + name + (last ? "" : "/") });
        if (next.length > MAX_GLOB) throw new Unreadable(`a glob matches more than ${MAX_GLOB} entries`);
      }
    }
    cur = next;
    if (!cur.length) return null;
  }
  return cur.map((x) => x.out);
}
function expandWord(w, scope) {
  const e = substitute(w.pat, scope);
  if (e.length > MAX_WORD && /[{*?[]/.test(e)) throw new Unreadable("a word is too long to expand");
  const parts = scope.ps ? [e] : braceExpand(e);
  const values = [];
  const globs = [];
  for (const p of parts) {
    if (isKnown(p) && hasGlob(p)) {
      globs.push(unescape(p));
      const abs = p.startsWith("/") || /^[A-Za-z]:/.test(unescape(p));
      const m = scope.cwd !== null || abs ? globExpand(p, scope.cwd ?? "/", scope) : null;
      if (m) {
        values.push(...m);
        continue;
      }
    }
    values.push(unescape(p));
  }
  return { values, globs };
}
function expandString(w, scope) {
  return unescape(substitute(w.pat, scope));
}

// tools/src/guard/shell/commands.ts
var MAX_COMMANDS = 5e3;
var MAX_LOOP = 256;
var KEYWORDS = /* @__PURE__ */ new Set(["if", "then", "elif", "else", "fi", "do", "done", "while", "until", "!", "{", "}", "function", "esac", "case"]);
var SEPARATORS = /* @__PURE__ */ new Set([";", "\n", "&&", "||", "|", "&", "(", ")"]);
var SHELLS = /* @__PURE__ */ new Set(["bash", "sh", "zsh", "dash", "ksh", "ash", "mksh"]);
var CD = /* @__PURE__ */ new Set(["cd", "chdir", "pushd", "popd", "set-location", "sl", "push-location", "pop-location"]);
var NPX = /* @__PURE__ */ new Set(["npx", "pnpx", "bunx"]);
var PREFIX_OPTS = {
  sudo: {
    value: "ughpCrtTURD",
    flag: "AbBEeHiKklLnNPSsVv",
    longValue: ["--user", "--group", "--host", "--prompt", "--role", "--type", "--other-user", "--close-from", "--command-timeout", "--chroot", "--chdir"],
    longFlag: ["--askpass", "--background", "--bell", "--preserve-env", "--edit", "--set-home", "--login", "--remove-timestamp", "--reset-timestamp", "--list", "--non-interactive", "--preserve-groups", "--stdin", "--shell", "--validate", "--version", "--help", "--no-update"]
  },
  doas: { value: "uC", flag: "ns", longValue: [], longFlag: [] },
  env: {
    value: "uCSPaLU",
    flag: "i0v",
    longValue: ["--unset", "--chdir", "--split-string", "--argv0"],
    longFlag: ["--ignore-environment", "--null", "--debug", "--list-signal-handling", "--block-signal", "--default-signal", "--ignore-signal"]
  },
  exec: { value: "a", flag: "cl", longValue: [], longFlag: [] },
  time: { value: "fo", flag: "pvaq", longValue: ["--format", "--output"], longFlag: ["--portability", "--verbose", "--append", "--quiet"] },
  nice: { value: "n", flag: "", longValue: ["--adjustment"], longFlag: [], digits: true },
  stdbuf: { value: "ioe", flag: "", longValue: ["--input", "--output", "--error"], longFlag: [] },
  timeout: { value: "sk", flag: "v", longValue: ["--signal", "--kill-after"], longFlag: ["--preserve-status", "--foreground", "--verbose"] },
  command: { value: "", flag: "p", longValue: [], longFlag: [] }
};
var isWord = (t) => t?.type === "word";
var isOp = (t, ...ops) => t?.type === "op" && ops.includes(t.text);
var cmdName = (s) => (s ?? "").replace(/^.*[\\/]/, "").toLowerCase().replace(/\.exe$/, "");
function resolveDir(cwd, target) {
  if (!isKnown(target)) return null;
  if (path14.isAbsolute(target) || /^[A-Za-z]:/.test(target)) return path14.resolve(target);
  return cwd === null ? null : path14.resolve(cwd, target);
}
var clone = (st) => ({ ...st, vars: new Map(st.vars), stack: [...st.stack] });
var Interpreter = class {
  commands = [];
  problems = [];
  check;
  constructor(check) {
    this.check = check;
  }
  push(c) {
    if (this.commands.length >= MAX_COMMANDS) throw new Unreadable(`more than ${MAX_COMMANDS} commands`);
    this.commands.push(c);
    return c;
  }
  parse(text2, shell, st, depth, dialect = null) {
    if (depth > MAX_DEPTH2) throw new Unreadable(`commands nested too deep (more than ${MAX_DEPTH2} levels)`);
    const r = lex(text2, shell);
    if (!Array.isArray(r)) {
      this.problems.push(r.unreadable);
      return;
    }
    const tokens = dialect === "cmd" ? r.map((t) => isWord(t) && t.text === "&" && !t.quoted ? { type: "op", text: ";" } : t) : r;
    this.exec(tokens, { ...st, ps: shell === "powershell", cmd: dialect === "cmd" }, depth);
  }
  exec(tokens, st, depth) {
    let cur = [];
    let producer = null;
    const flush = (sep) => {
      if (!cur.length) return null;
      const toks = cur;
      cur = [];
      if (st.ps || producer === null && sep !== "|" && sep !== "&") return this.simple(toks, st, depth, producer);
      const sub = clone(st);
      const c = this.simple(toks, sub, depth, producer);
      if (producer !== null && sep !== "|" && sep !== "&") {
        const moved = sub.cwd !== st.cwd || sub.oldpwd !== st.oldpwd || sub.stack.length !== st.stack.length || sub.stack.some((d, k) => d !== st.stack[k]);
        if (moved) {
          st.cwd = null;
          st.oldpwd = null;
          st.stack = st.stack.map(() => null);
        }
        for (const [k, v] of sub.vars) if (st.vars.get(k) !== v) st.vars.set(k, UNKNOWN);
      }
      return c;
    };
    let i = 0;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t.type === "op") {
        if (t.text === "(") {
          flush(";");
          const j = matchParen(tokens, i);
          this.exec(tokens.slice(i + 1, j), clone(st), depth);
          producer = null;
          i = j + 1;
        } else if (t.text === "|") {
          producer = flush("|");
          i++;
        } else {
          flush(t.text);
          producer = null;
          i++;
        }
      } else if (isWord(t) && !cur.length && !t.quoted && !st.ps && (KEYWORDS.has(t.text) || t.text === "for")) {
        i = t.text === "for" ? this.forLoop(tokens, i, st, depth) : i + 1;
      } else {
        cur.push(t);
        i++;
      }
    }
    flush(";");
  }
  /** for NAME [in WORDS]; do BODY; done — the body runs once per value; returns the index after done. */
  forLoop(tokens, i, st, depth) {
    let j = i + 1;
    const nameTok = tokens[j];
    if (!isWord(nameTok)) return j;
    j++;
    let values = null;
    while (isOp(tokens[j], "\n")) j++;
    const inTok = tokens[j];
    if (isWord(inTok) && inTok.text === "in") {
      j++;
      values = [];
      for (let w = tokens[j]; isWord(w); w = tokens[++j]) values.push(...expandWord(w, st).values);
    }
    while (isOp(tokens[j], ";", "\n")) j++;
    const doTok = tokens[j];
    if (!isWord(doTok) || doTok.text !== "do") return j;
    const start = j + 1;
    let level = 1;
    let atStart = true;
    let k = start;
    for (; k < tokens.length; k++) {
      const t = tokens[k];
      if (t.type === "op") {
        atStart = SEPARATORS.has(t.text);
        continue;
      }
      if (isWord(t) && atStart && !t.quoted) {
        if (t.text === "do") level++;
        else if (t.text === "done" && --level === 0) break;
      }
      atStart = isWord(t) && !t.quoted && KEYWORDS.has(t.text);
    }
    const body = tokens.slice(start, k);
    const list = values === null || values.length > MAX_LOOP ? [UNKNOWN] : values;
    for (const v of list) {
      this.check();
      st.vars.set(nameTok.text, v);
      this.exec(body, st, depth);
    }
    return k + 1;
  }
  /** One simple command: its substitutions, assignments, words, redirections and heredoc. */
  simple(toks, st, depth, producer) {
    this.check();
    for (const t of toks) {
      if (t.type !== "op") for (const s of t.subs) this.parse(s, st.ps ? "powershell" : "posix", clone(st), depth + 1);
    }
    let words = toks.filter(isWord);
    const env = {};
    if (st.ps) {
      const [v, eq, ...rest] = words;
      if (v && eq && v.text.startsWith("$") && eq.text === "=" && !eq.quoted) {
        const name = v.text.slice(1).toLowerCase();
        const value = rest.length === 1 && (rest[0].quoted || /^[$\d.@-]/.test(rest[0].text)) ? expandString(rest[0], st) : UNKNOWN;
        st.vars.set(name, value);
        if (name.startsWith("env:")) st.assigned.push(name.slice(4).toUpperCase());
        if (value !== UNKNOWN || !rest.length) return null;
        words = rest;
      }
    } else {
      let k = 0;
      if (words[0] && !words[0].quoted && ["export", "local", "declare", "readonly", "typeset"].includes(words[0].text)) {
        k = 1;
        while (words[k]?.text.startsWith("-")) k++;
        for (; k < words.length; k++) {
          const m = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(words[k].pat);
          if (m) st.vars.set(m[1], expandString({ pat: words[k].pat.slice(m[0].length) }, st));
          if (m) st.assigned.push(m[1].toUpperCase());
        }
        return null;
      }
      for (; k < words.length; k++) {
        const m = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(words[k].pat);
        if (!m) break;
        env[m[1]] = expandString({ pat: words[k].pat.slice(m[0].length) }, st);
      }
      if (k === words.length) {
        for (const [n, v] of Object.entries(env)) st.vars.set(n, v);
        st.assigned.push(...Object.keys(env).map((n) => n.toUpperCase()));
        if (!toks.some((t) => t.type === "redir" || t.type === "heredoc")) return null;
      }
      words = words.slice(k);
    }
    const argv = [];
    const globs = [];
    for (const w of words) {
      const x = expandWord(w, st);
      argv.push(...x.values);
      globs.push(...x.globs);
    }
    const redirects = [];
    let stdin;
    for (const t of toks) {
      if (t.type === "redir") {
        const target = expandString(t, st);
        redirects.push({ op: t.op, target });
        if (t.op === "<<<") stdin = target + "\n";
      } else if (t.type === "heredoc") stdin = t.body;
    }
    const base = { argv, cwd: st.cwd, redirects, env, assigned: [...st.assigned], globs, ...st.cmd ? { cmd: true } : {}, shell: st.ps ? "powershell" : "posix", ...stdin !== void 0 ? { stdin } : {} };
    if (producer) {
      base.piped = [...producer.argv, producer.stdin ?? "", producer.piped ?? ""].join(" ");
      base.pipedFrom = producer.argv;
    }
    return this.run(base, st, depth, producer);
  }
  /** Removes prefixes, follows cd, unwraps the commands that run other commands, and records the rest. */
  run(c, st, depth, producer) {
    let a = c.argv;
    let cwd = c.cwd;
    let called = false;
    const env = { ...c.env };
    for (let changed = true; changed && a.length; ) {
      changed = false;
      const name2 = cmdName(a[0]);
      const option = (i, spec, special = () => {
      }) => {
        const x = a[i];
        if (x.startsWith("--")) {
          const [n, ...v] = x.split("=");
          const all = [...spec.longValue, ...spec.longFlag];
          const hits = all.includes(n) ? [n] : all.filter((f) => f.startsWith(n));
          if (hits.length !== 1) {
            this.problems.push(`${name2} has an option the guard does not know: ${n}`);
            return i + 1;
          }
          const takes = spec.longValue.includes(hits[0]);
          if (takes) special(hits[0], v.length ? v.join("=") : a[i + 1]);
          return i + (takes && !v.length ? 2 : 1);
        }
        if (spec.digits && /^-\d+$/.test(x)) return i + 1;
        for (let j = 1; j < x.length; j++) {
          if (spec.value.includes(x[j])) {
            const glued = x.slice(j + 1);
            special(x[j], glued || a[i + 1]);
            return i + (glued ? 1 : 2);
          }
          if (!spec.flag.includes(x[j])) {
            this.problems.push(`${name2} has an option the guard does not know: -${x[j]}`);
            return i + 1;
          }
        }
        return i + 1;
      };
      const walkOpts = (from, spec, special) => {
        let i = from;
        while (i < a.length && a[i].startsWith("-") && a[i] !== "-") {
          if (a[i] === "--") return i + 1;
          i = option(i, spec, special);
        }
        return i;
      };
      const chdir = (letter, long) => (opt, value) => {
        if (opt === letter || opt === long) cwd = resolveDir(cwd, value ?? "");
      };
      let next = null;
      if (name2 === "sudo" || name2 === "doas") next = walkOpts(1, PREFIX_OPTS[name2], chdir("D", "--chdir"));
      else if (name2 === "nohup" || name2 === "builtin") next = 1;
      else if (name2 === "&" || st.ps && name2 === ".") {
        called = true;
        next = 1;
      } else if (name2 === "exec" || name2 === "time" || name2 === "nice" || name2 === "stdbuf") next = walkOpts(1, PREFIX_OPTS[name2]);
      else if (name2 === "timeout") next = walkOpts(1, PREFIX_OPTS.timeout) + 1;
      else if (name2 === "command" && a[1] !== "-v" && a[1] !== "-V") next = walkOpts(1, PREFIX_OPTS.command);
      else if (name2 === "env") {
        let i = 1;
        let split = null;
        while (i < a.length) {
          const x = a[i];
          if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(x)) {
            env[x.slice(0, x.indexOf("="))] = x.slice(x.indexOf("=") + 1);
            i++;
            continue;
          }
          if (x === "--") {
            i++;
            break;
          }
          if (!x.startsWith("-") || x === "-") break;
          i = option(i, PREFIX_OPTS.env, (opt, value) => {
            if (opt === "S" || opt === "--split-string") split = value ?? "";
            chdir("C", "--chdir")(opt, value);
          });
          if (split !== null) break;
        }
        if (split !== null) {
          if (/\\|\$\{/.test(split)) this.problems.push("env -S text with escapes or ${} the guard does not decode");
          else this.parse([split, ...a.slice(i).map((x) => `'${x.replaceAll("'", `'\\''`)}'`)].join(" "), "posix", { ...clone(st), cwd }, depth + 1);
          return null;
        }
        next = i;
      } else if (NPX.has(name2) || (name2 === "pnpm" || name2 === "yarn") && a[1] === "dlx") {
        let i = NPX.has(name2) ? 1 : 2;
        while (i < a.length && a[i].startsWith("-")) {
          if (a[i] === "-c" || a[i] === "--call") {
            this.parse(a[i + 1] ?? "", "posix", clone(st), depth + 1);
            return null;
          }
          i += a[i] === "-p" || a[i] === "--package" ? 2 : 1;
        }
        next = i;
      } else if (name2 === "doppler" && a[1] === "run") {
        let i = 2;
        for (; i < a.length; i++) {
          if (a[i] === "--") break;
          const inline = /^--command=([\s\S]*)$/.exec(a[i]);
          if (a[i] === "--command" || inline) {
            this.parse(inline ? inline[1] : a[i + 1] ?? "", "posix", clone(st), depth + 1);
            return null;
          }
        }
        next = i < a.length ? i + 1 : a.length;
      } else if (name2 === "xargs") {
        this.xargs(a, { ...c, env, cwd }, st, depth, producer);
        return null;
      }
      if (next !== null) {
        a = a.slice(next);
        changed = true;
      }
    }
    if (!a.length) return c.redirects.length ? this.push({ ...c, argv: [], env, cwd }) : null;
    if ((!st.ps || called) && !isKnown(a[0])) this.problems.push("runs a command whose name the guard cannot see");
    const name = cmdName(a[0]);
    const cmd = { ...c, argv: a, env, cwd, ...called ? { called } : {} };
    if (CD.has(name)) {
      this.cd(name, a.slice(1), st);
      return null;
    }
    if (name === "git") return this.push(gitDashC(cmd));
    if (SHELLS.has(name)) {
      const pushed = this.push(cmd);
      let i = 1;
      let withC = false;
      let readsStdin = false;
      for (; i < a.length; i++) {
        const x = a[i];
        if (x === "--") {
          i++;
          break;
        }
        if (x === "-" || !/^[-+]/.test(x)) break;
        if (x === "--rcfile" || x === "--init-file") i++;
        else if (/^[-+][A-Za-z]+$/.test(x)) {
          if (x[0] === "-") {
            withC ||= x.includes("c");
            readsStdin ||= x.includes("s");
          }
          i += (x.match(/[oO]/g) ?? []).length;
        }
      }
      const shellCwd = { ...clone(st), cwd: cmd.cwd };
      if (withC) this.parse(a[i] ?? "", "posix", shellCwd, depth + 1);
      else if (readsStdin || i >= a.length || a[i] === "-") this.fromStdin(pushed, shellCwd, depth, producer, "posix");
      return pushed;
    }
    if (name === "eval" || st.ps && (name === "invoke-expression" || name === "iex")) {
      const pushed = this.push(cmd);
      const text2 = a.slice(1).filter((x) => !/^-command$/i.test(x));
      if (!text2.every(isKnown)) this.problems.push(`${name} runs text the guard cannot see`);
      else this.parse(text2.join(" "), st.ps ? "powershell" : "posix", st, depth + 1);
      return pushed;
    }
    if (name === "pwsh" || name === "powershell") {
      const pushed = this.push(cmd);
      this.powershell(a, name, pushed, st, depth, producer);
      return pushed;
    }
    if (name === "cmd") {
      const pushed = this.push(cmd);
      const i = a.findIndex((x, k) => k > 0 && /^\/\/?[ckr]/i.test(x));
      if (i > 0) {
        const home = st.home.replaceAll(" ", "` ");
        const script = [a[i].replace(/^\/\/?[ckr]/i, ""), ...a.slice(i + 1)].join(" ").trim().replace(/%HOMEDRIVE%%HOMEPATH%|%(USERPROFILE|HOMEPATH|HOME)%/gi, () => home).replace(/%[^%\s]+%/g, UNKNOWN);
        this.parse(script, "powershell", clone(st), depth + 1, "cmd");
      }
      return pushed;
    }
    if (name === "find") {
      const pushed = this.push(cmd);
      for (let i = 1; i < a.length; i++) {
        if (!["-exec", "-execdir", "-ok", "-okdir"].includes(a[i])) continue;
        let j = i + 1;
        while (j < a.length && a[j] !== ";" && a[j] !== "+") j++;
        const inner = a.slice(i + 1, j).map((x) => x.replaceAll("{}", FOUND));
        this.run({ ...cmd, argv: inner, env: {}, globs: [], redirects: [] }, clone(st), depth + 1, null);
        i = j;
      }
      return pushed;
    }
    return this.push(cmd);
  }
  cd(name, args, st) {
    if (args[0] === "--") args = args.slice(1);
    const rest = args.filter((x) => !/^-[PLe@]$/.test(x) && !/^-(literal)?path$/i.test(x) && x.toLowerCase() !== "/d");
    if (name === "popd" || name === "pop-location") {
      st.oldpwd = st.cwd;
      st.cwd = st.stack.length ? st.stack.pop() : null;
      return;
    }
    const target = rest[0];
    const odd = !st.ps && rest.some((x) => x.startsWith("-") && x !== "-");
    const next = odd ? null : target === void 0 ? st.home : target === "-" ? st.oldpwd : resolveDir(st.cwd, target);
    if (name === "pushd" || name === "push-location") st.stack.push(st.cwd);
    st.oldpwd = st.cwd;
    st.cwd = next;
  }
  /** A shell that reads its commands from stdin: a heredoc, a here-string or a pipe from echo/printf/cat. */
  fromStdin(c, st, depth, producer, shell) {
    if (c.stdin !== void 0) {
      c.heredocToShell = c.stdin;
      this.parse(c.stdin, shell, clone(st), depth + 1);
    } else if (producer) {
      const text2 = literalOutput(producer);
      if (text2 === null) this.problems.push("a shell reads commands from a pipe the guard cannot see");
      else this.parse(text2, shell, clone(st), depth + 1);
    }
  }
  powershell(a, name, c, st, depth, producer) {
    const prefixOf = (flag, full, min) => flag.length >= min && full.startsWith(flag);
    for (let i = 1; i < a.length; i++) {
      if (!a[i].startsWith("-")) {
        if (name === "powershell") this.parse(a.slice(i).join(" "), "powershell", clone(st), depth + 1);
        return;
      }
      const colon = /^(-[A-Za-z]+):([\s\S]*)$/.exec(a[i]);
      const f = (colon ? colon[1] : a[i]).toLowerCase();
      const value = colon ? colon[2] : a[i + 1];
      const after = colon ? [colon[2], ...a.slice(i + 1)] : a.slice(i + 1);
      if (f === "-cwa" || prefixOf(f, "-commandwithargs", 9)) {
        this.parse(value ?? "", "powershell", clone(st), depth + 1);
        return;
      }
      if (prefixOf(f, "-command", 2)) {
        const script = after.join(" ");
        if (script === "-" || script === "") this.fromStdin(c, st, depth, producer, "powershell");
        else this.parse(script, "powershell", clone(st), depth + 1);
        return;
      }
      if (prefixOf(f, "-encodedcommand", 2) || f === "-ec") {
        this.parse(Buffer.from(value ?? "", "base64").toString("utf16le"), "powershell", clone(st), depth + 1);
        return;
      }
      if (prefixOf(f, "-file", 2)) return;
      const takesValue = ["-executionpolicy", "-ep", "-workingdirectory", "-wd", "-configurationname", "-outputformat", "-of", "-inputformat", "-if", "-windowstyle"].includes(f);
      if (takesValue && !colon) i++;
    }
  }
  /** xargs: the command runs with what the pipe produced (literal words, ls entries, find matches) or an unknown marker. */
  xargs(a, c, st, depth, producer) {
    const withValue = ["-n", "-L", "-P", "-s", "-d", "-E", "-a", "--max-args", "--max-lines", "--max-procs", "--delimiter", "--arg-file", "--max-chars", "--eof"];
    let repl = null;
    let fromFile = false;
    let i = 1;
    while (i < a.length && a[i].startsWith("-")) {
      const f = a[i];
      if (f === "--") {
        i++;
        break;
      }
      if (f === "-I") {
        repl = a[i + 1] ?? "{}";
        i += 2;
        continue;
      }
      if (f.startsWith("-I")) repl = f.slice(2);
      else if (f === "-i" || f.startsWith("--replace")) repl = f.includes("=") ? f.slice(f.indexOf("=") + 1) : "{}";
      if (f === "-a" || f.startsWith("--arg-file")) fromFile = true;
      i += withValue.includes(f) ? 2 : 1;
    }
    const cmd = a.length > i ? a.slice(i) : ["echo"];
    const values = fromFile ? [UNKNOWN] : this.produced(producer, cmd, st);
    const runWith = (argv) => this.run({ ...c, argv, globs: [] }, st, depth + 1, null);
    if (repl === null) runWith([...cmd, ...values]);
    else for (const v of values.length ? values : [UNKNOWN]) runWith(cmd.map((x) => x.replaceAll(repl, v)));
  }
  produced(p, cmd, st) {
    if (!p) return [UNKNOWN];
    const name = cmdName(p.argv[0]);
    const args = p.argv.slice(1);
    if (name === "ls") {
      const flags = args.filter((x) => x.startsWith("-")).join("");
      const paths2 = args.filter((x) => !x.startsWith("-"));
      if (paths2.length) return flags.includes("d") ? paths2 : [UNKNOWN];
      if (p.cwd === null) return [UNKNOWN];
      const scope = { ...st, cwd: p.cwd };
      const all = [...globExpand("*", p.cwd, scope) ?? [], .../[aA]/.test(flags) ? (globExpand(".*", p.cwd, scope) ?? []).filter((x) => x !== "." && x !== "..") : []];
      return all;
    }
    if (name === "git" && p.argv[1] === "ls-files") return [GIT_FILES];
    if (name === "find") {
      const { pre, starts, expr } = splitFind(p.argv);
      const exec = ["-exec", ...cmd, "{}", "+"];
      const prints = expr.some((x) => x === "-print" || x === "-print0");
      const body = prints ? expr.flatMap((x) => x === "-print" || x === "-print0" ? exec : [x]) : expr.length ? ["(", ...expr, ")", ...exec] : exec;
      this.push({ ...p, argv: [p.argv[0], ...pre, ...starts, ...body] });
      return [FOUND];
    }
    const text2 = literalOutput(p);
    return text2 === null ? [UNKNOWN] : text2.split(/\s+/).filter(Boolean);
  }
};
function splitFind(argv) {
  let i = 1;
  while (i < argv.length && /^-([HLP]|O\d*|D)$/.test(argv[i])) i += argv[i] === "-D" ? 2 : 1;
  const pre = argv.slice(1, i);
  let j = i;
  while (j < argv.length && !(argv[j].startsWith("-") && argv[j].length > 1) && argv[j] !== "(" && argv[j] !== "!") j++;
  return { pre, starts: argv.slice(i, j), expr: argv.slice(j) };
}
function gitDashC(c) {
  const a = c.argv;
  const out2 = [a[0]];
  let cwd = c.cwd;
  let i = 1;
  while (i < a.length && a[i].startsWith("-")) {
    if (a[i] === "-C" && i + 1 < a.length) {
      cwd = resolveDir(cwd, a[i + 1]);
      i += 2;
    } else if (["-c", "--git-dir", "--work-tree", "--namespace"].includes(a[i]) && i + 1 < a.length) {
      out2.push(a[i], a[i + 1]);
      i += 2;
    } else out2.push(a[i++]);
  }
  return { ...c, argv: [...out2, ...a.slice(i)], cwd };
}
function literalOutput(p) {
  if (!p.argv.every(isKnown)) return null;
  const name = cmdName(p.argv[0]);
  if (name === "echo") {
    let args = p.argv.slice(1);
    while (args[0] && /^-[neE]+$/.test(args[0])) args = args.slice(1);
    if (args.some((x) => x.includes("\\"))) return null;
    return args.join(" ") + "\n";
  }
  if (name === "printf") {
    const fmt = p.argv[1] ?? "";
    const rest = p.argv.slice(2);
    if (/\\(?![ntr\\])|\\$/.test(fmt)) return null;
    const directives = fmt.match(/%[-0-9.]*[A-Za-z%]/g) ?? [];
    if (directives.some((d) => d !== "%%" && !/^%[-0-9.]*[sd]$/.test(d))) return null;
    const n = directives.filter((d) => d !== "%%").length;
    if (n > 0 && rest.length > n) return null;
    const decoded = fmt.replace(/\\([ntr\\])/g, (_, ch) => ({ n: "\n", t: "	", r: "\r", "\\": "\\" })[ch]);
    return decoded.replace(/%%|%[-0-9.]*[sd]/g, (d) => d === "%%" ? "%" : rest.shift() ?? "");
  }
  if (name === "cat" && p.argv.length === 1 && p.stdin !== void 0) return p.stdin;
  return null;
}
function matchParen(tokens, i) {
  let level = 0;
  for (let j = i; j < tokens.length; j++) {
    if (isOp(tokens[j], "(")) level++;
    else if (isOp(tokens[j], ")") && --level === 0) return j;
  }
  return tokens.length;
}
function simpleCommands(cmd, cwd, shell, opts) {
  const it = new Interpreter(opts.check ?? (() => {
  }));
  const st = { vars: /* @__PURE__ */ new Map(), cwd, home: opts.home, ps: shell === "powershell", check: it.check, oldpwd: null, assigned: [], stack: [] };
  try {
    it.parse(cmd, shell, st, opts.depth ?? 0);
  } catch (e) {
    if (!(e instanceof Unreadable)) throw e;
    it.problems.push(e.message);
  }
  return it.problems.length ? { commands: it.commands, unreadable: it.problems[0] } : { commands: it.commands };
}

// tools/src/guard/rules/destructive.ts
var HEAVY = /* @__PURE__ */ new Set(["node_modules", ".venv", "venv", "target", "dist", "build", ".next", ".nuxt", ".turbo", ".cache", "__pycache__", ".gradle", "coverage"]);
var MAX_SCAN = 2e4;
var PS_REMOVE = /* @__PURE__ */ new Set(["remove-item", "ri", "rm", "del", "erase", "rd", "rmdir"]);
var CMD_REMOVE = /* @__PURE__ */ new Set(["rd", "rmdir", "del", "erase"]);
var PS_VALUE = ["path", "literalpath", "filter", "include", "exclude", "credential", "stream"];
function psDeletion(name, args) {
  let recursive = false;
  const targets = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (CMD_REMOVE.has(name) && /^\/[a-z](:.*)?$/i.test(a)) {
      if (/^\/s$/i.test(a)) recursive = true;
      continue;
    }
    if (!a.startsWith("-") || a.length < 2) {
      targets.push(...a.split(","));
      continue;
    }
    const [n, v] = a.slice(1).toLowerCase().split(/:(.*)/s);
    const on = v === void 0 || !/^\$?false$/.test(v);
    if ("recurse".startsWith(n)) recursive = on;
    else if ("whatif".startsWith(n) && n.length >= 2) {
      if (v === void 0 || /^(\$true|true|1)$/.test(v)) return null;
    } else {
      const param2 = PS_VALUE.find((p) => p.startsWith(n) && n.length >= 2) ?? (n === "lp" ? "literalpath" : void 0);
      const value = v ?? (param2 ? args[++i] : void 0);
      if ((param2 === "path" || param2 === "literalpath") && value !== void 0) targets.push(...value.split(","));
    }
  }
  return { recursive, targets };
}
function deletion(c) {
  const name = cmdName(c.argv[0] ?? "");
  const args = c.argv.slice(1);
  if (name === "rimraf") return { recursive: true, targets: args.filter((a) => !a.startsWith("-")) };
  if (c.shell === "powershell" && PS_REMOVE.has(name)) return psDeletion(name, args);
  if (name !== "rm" && name !== "unlink") return null;
  const d = { recursive: false, targets: [] };
  let options = true;
  for (const a of args) {
    if (options && a === "--") options = false;
    else if (options && a.startsWith("--")) {
      if (a.length >= 3 && "--recursive".startsWith(a)) d.recursive = true;
      if (a.length >= 4 && "--no-preserve-root".startsWith(a)) d.noPreserveRoot = true;
    } else if (options && /^-./.test(a)) {
      if (/[rR]/.test(a)) d.recursive = true;
    } else d.targets.push(a);
  }
  return d;
}
var fold = (s) => process.platform === "linux" ? s : s.toLowerCase();
function gitPlace(real) {
  const parts = real.split(/[\\/]/).map(fold);
  const i = parts.indexOf(".git");
  if (i < 0) return null;
  const rest = parts.slice(i + 1);
  if (rest[0] === "rebase-merge" || rest[0] === "rebase-apply" || rest[0] === "worktrees" && rest.length >= 2) return "exempt";
  if (rest.length && rest.at(-1).endsWith(".lock")) return "exempt";
  return "protected";
}
function gitBelow(dir, check) {
  let found = null;
  let seen = 0;
  const queue = [dir];
  while (queue.length) {
    check();
    const current = queue.pop();
    let entries;
    try {
      entries = readdirSync6(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (++seen > MAX_SCAN) return "unknown";
      if (fold(e.name) === ".git") {
        if (e.isDirectory()) return "dir";
        found = "file";
      } else if (e.isDirectory() && !HEAVY.has(e.name)) queue.push(path15.join(current, e.name));
    }
  }
  return found;
}
function isDir3(p) {
  try {
    return lstatSync2(p).isDirectory();
  } catch {
    return false;
  }
}
var KEEP_GIT = "use git itself (git reset, git restore, git worktree remove) instead of deleting its data";
var NARROW = "delete the specific files or folders inside it instead";
var anchors = /* @__PURE__ */ new WeakMap();
function rootLike(real, ctx) {
  let a = anchors.get(ctx);
  if (!a) anchors.set(ctx, a = { root: canonical(ctx.root), home: canonical(ctx.home) });
  if (path15.dirname(real) === real) return "a filesystem root";
  const same = (x) => within2(x, real) && within2(real, x);
  if (same(a.root)) return "the project root";
  if (same(a.home)) return "the home folder";
  if (within2(a.root, real)) return "a folder that holds the project";
  if (within2(a.home, real)) return "a folder that holds the home folder";
  return null;
}
function protection(real, recursive, ctx) {
  const git2 = gitPlace(real);
  if (git2 === "exempt") return null;
  if (git2 === "protected" && (recursive || !isDir3(real))) return { decision: "deny", why: "git's data (.git)", alternative: KEEP_GIT };
  if (!recursive) return null;
  const root = rootLike(real, ctx);
  if (root) return { decision: "deny", why: root, alternative: NARROW };
  if (HEAVY.has(path15.basename(real)) || !isDir3(real)) return null;
  const below = gitBelow(real, ctx.check);
  if (below === "dir") return { decision: "deny", why: "a folder that holds a git repository", alternative: "delete what you need inside it, outside its .git" };
  if (below === "file") return { decision: "ask", why: "a folder that holds a git worktree or submodule", alternative: "use git worktree remove (or git submodule deinit) so git's records stay right" };
  if (below === "unknown") return { decision: "ask", why: "a folder too big to check for a repository inside", alternative: NARROW };
  return null;
}
function verdict(p, what) {
  return { decision: p.decision, category: "destructive", reason: `this would delete ${what}: ${p.why}`, alternative: p.alternative };
}
var DRIVE_ROOT = /^([a-z]:|\/[a-z])[\\/]*$/i;
var absolute = (t) => /^([\\/~]|[a-z]:)/i.test(t);
function targetVerdict(t, d, c, ctx) {
  if (t.includes(FOUND) || t.includes(GIT_FILES)) return null;
  if (!isKnown(t)) {
    if (t.split(/[\\/]/).some((s) => fold(s) === ".git")) return verdict({ decision: "deny", why: "git's data (.git)", alternative: KEEP_GIT }, "a path inside .git");
    return d.recursive ? { decision: "ask", category: "destructive", reason: "a recursive delete of a path the guard cannot see", alternative: "write the path out literally" } : null;
  }
  if (d.recursive && DRIVE_ROOT.test(t)) return verdict({ decision: "deny", why: "a drive root", alternative: NARROW }, t);
  if (c.cwd === null && !absolute(t)) {
    return d.recursive ? { decision: "ask", category: "unreadable", reason: "a recursive delete after a cd the guard cannot follow", alternative: "use an absolute path, or run the cd as its own command" } : null;
  }
  const real = canonical(resolvePath(t, c.cwd ?? ctx.event.cwd, ctx.home));
  const p = protection(real, d.recursive, ctx);
  return p && verdict(p, t);
}
function globVerdict(g, c, ctx) {
  const last = g.split(/[\\/]/).at(-1);
  if (!/^\*+$/.test(last) || !isKnown(g)) return null;
  const dir = g.slice(0, g.length - last.length) || ".";
  if (c.cwd === null && !absolute(dir)) return null;
  const real = canonical(resolvePath(dir, c.cwd ?? ctx.event.cwd, ctx.home));
  const why = gitPlace(real) === "protected" ? "git's data (.git)" : DRIVE_ROOT.test(dir) ? "a drive root" : rootLike(real, ctx);
  return why ? verdict({ decision: "deny", why, alternative: NARROW }, `everything in ${dir}`) : null;
}
function gitClean(a) {
  let i = 1;
  while (i < a.length && a[i].startsWith("-")) i += ["-c", "--git-dir", "--work-tree", "--namespace"].includes(a[i]) ? 2 : 1;
  if (a[i] !== "clean") return null;
  let force = 0;
  let ignored = false;
  for (let k = i + 1; k < a.length; k++) {
    const o = a[k];
    if (o === "--") break;
    if (o === "--force") force++;
    else if (o === "--dry-run") return null;
    else if (o === "--exclude") k++;
    else if (/^-[^-]/.test(o)) {
      for (let j = 1; j < o.length; j++) {
        const ch = o[j];
        if (ch === "e") {
          if (j === o.length - 1) k++;
          break;
        }
        if (ch === "n") return null;
        if (ch === "f") force++;
        if (ch === "x" || ch === "X") ignored = true;
      }
    }
  }
  if (force >= 2) return { decision: "deny", category: "destructive", reason: "git clean with -f twice also deletes nested repositories", alternative: "run git clean -n first, then clean with a single -f" };
  if (ignored) return { decision: "ask", category: "destructive", reason: "git clean -x deletes ignored files too, such as .env and local data", alternative: "run git clean -n -x first to see what would go" };
  return null;
}
var REMOTE = /^(rsync:\/\/|[^/\\:]*@[^/\\:]+:|[^/\\:]{2,}:)/;
var RSYNC_VALUE = /* @__PURE__ */ new Set([
  "-e",
  "-f",
  "-T",
  "-B",
  "-M",
  "-@",
  "--rsh",
  "--max-alloc",
  "--copy-as",
  "--early-input",
  "--zc",
  "--zl",
  "--cc",
  "--stderr",
  "--filter",
  "--exclude",
  "--include",
  "--exclude-from",
  "--include-from",
  "--files-from",
  "--rsync-path",
  "--log-file",
  "--log-file-format",
  "--partial-dir",
  "--temp-dir",
  "--compare-dest",
  "--copy-dest",
  "--link-dest",
  "--backup-dir",
  "--suffix",
  "--chmod",
  "--chown",
  "--usermap",
  "--groupmap",
  "--timeout",
  "--contimeout",
  "--port",
  "--password-file",
  "--bwlimit",
  "--block-size",
  "--max-size",
  "--min-size",
  "--max-delete",
  "--modify-window",
  "--out-format",
  "--iconv",
  "--info",
  "--debug",
  "--remote-option",
  "--sockopts",
  "--address",
  "--protocol",
  "--checksum-choice",
  "--compress-choice",
  "--compress-level",
  "--skip-compress",
  "--checksum-seed",
  "--outbuf",
  "--stop-after",
  "--stop-at",
  "--write-batch",
  "--only-write-batch",
  "--read-batch"
]);
var RSYNC_SWITCH = /* @__PURE__ */ new Set([
  "--archive",
  "--verbose",
  "--quiet",
  "--compress",
  "--recursive",
  "--relative",
  "--links",
  "--copy-links",
  "--safe-links",
  "--hard-links",
  "--perms",
  "--executability",
  "--acls",
  "--xattrs",
  "--owner",
  "--group",
  "--devices",
  "--specials",
  "--times",
  "--atimes",
  "--crtimes",
  "--omit-dir-times",
  "--checksum",
  "--update",
  "--inplace",
  "--append",
  "--dirs",
  "--mkpath",
  "--existing",
  "--ignore-existing",
  "--remove-source-files",
  "--force",
  "--partial",
  "--progress",
  "--human-readable",
  "--stats",
  "--itemize-changes",
  "--dry-run",
  "--whole-file",
  "--sparse",
  "--one-file-system",
  "--numeric-ids",
  "--ignore-times",
  "--size-only",
  "--prune-empty-dirs",
  "--backup",
  "--cvs-exclude",
  "--delay-updates",
  "--no-motd",
  "--protect-args",
  "--secluded-args",
  "--ipv4",
  "--ipv6",
  "--8-bit-output",
  "--fuzzy"
]);
function rsync(c, ctx) {
  const args = c.argv.slice(1);
  if (!args.some((a) => /^--del(ete)?([-=]|$)/.test(a))) return null;
  const paths2 = [];
  let unsure = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") {
      paths2.push(...args.slice(i + 1));
      break;
    }
    if (!a.startsWith("-") || a === "-") paths2.push(a);
    else if (RSYNC_VALUE.has(a) || /^-[^-]/.test(a) && a.length > 2 && RSYNC_VALUE.has(`-${a.at(-1)}`)) i++;
    else if (a.startsWith("--") && !a.includes("=") && !RSYNC_SWITCH.has(a) && !/^--(no-|del)/.test(a)) unsure = true;
  }
  const dest = paths2.at(-1);
  if (dest === void 0 || paths2.length < 2) return null;
  const ask3 = { decision: "ask", category: "destructive", reason: `rsync --delete removes from ${dest} whatever the source lacks`, alternative: "run it with --dry-run first" };
  if (REMOTE.test(dest)) return unsure ? ask3 : null;
  if (!isKnown(dest) || c.cwd === null && !absolute(dest)) return ask3;
  const real = canonical(resolvePath(dest, c.cwd ?? ctx.event.cwd, ctx.home));
  const why = DRIVE_ROOT.test(dest) ? "a drive root" : rootLike(real, ctx);
  return why ? verdict({ decision: "deny", why, alternative: "sync into a dedicated folder" }, `files in ${dest}`) : ask3;
}
function always(name, args) {
  const deny = (what) => ({ decision: "deny", category: "destructive", reason: `${what} erases a whole disk or partition`, alternative: "do this by hand, outside the agent" });
  if (name.startsWith("mkfs")) return deny(name);
  if (name === "format" && args.some((a) => /^[a-z]:$/i.test(a))) return deny("format");
  if (name === "dd" && args.some((a) => /^of=\/dev\/(?!(null|zero|stdout|stderr)$)/.test(a))) return deny("dd onto a device");
  return null;
}
var PS_LIST = /* @__PURE__ */ new Set(["get-childitem", "gci", "ls", "dir"]);
var PS_ITEM = /* @__PURE__ */ new Set(["get-item", "gi"]);
function pipedVerdicts(from, d, c, ctx) {
  const name = cmdName(from[0]);
  const paths2 = [];
  let listsDeep = false;
  for (let i = 1; i < from.length; i++) {
    const a = from[i];
    if (!a.startsWith("-")) paths2.push(a);
    else if (/^-(path|literalpath|lp)$/i.test(a) && from[i + 1] !== void 0) paths2.push(from[++i]);
    else if (/^-r(e(c(u(r(se?)?)?)?)?)?$/i.test(a)) listsDeep = true;
  }
  if (PS_LIST.has(name)) {
    const deep2 = { ...d, recursive: d.recursive || listsDeep };
    if (!deep2.recursive) return [];
    return (paths2.length ? paths2 : ["."]).flatMap((p) => {
      if (/[*?]/.test(p)) return [];
      const v = globVerdict(`${p.replace(/[\\/]+$/, "")}/*`, c, ctx);
      return v ? [v] : [];
    });
  }
  if (PS_ITEM.has(name)) return paths2.flatMap((p) => targetVerdict(p, d, c, ctx) ?? []);
  if (from.length === 1 && /^([~.]|[a-z]:|[\\/])|[\\/]/i.test(from[0])) return [targetVerdict(from[0], d, c, ctx)].flatMap((v) => v ?? []);
  return d.recursive ? [{ decision: "ask", category: "destructive", reason: "a recursive delete of what the pipeline sends, which the guard cannot see", alternative: "name the paths to delete" }] : [];
}
function commandVerdicts(c, ctx) {
  const name = cmdName(c.argv[0] ?? "");
  const out2 = [];
  const push2 = (v) => v && out2.push(v);
  push2(always(name, c.argv.slice(1)));
  if (name === "git") push2(gitClean(c.argv));
  if (name === "rsync") push2(rsync(c, ctx));
  const d = deletion(c);
  if (!d) return out2;
  if (d.noPreserveRoot) out2.push({ decision: "deny", category: "destructive", reason: "--no-preserve-root lets rm delete the filesystem root", alternative: NARROW });
  for (const t of d.targets) push2(targetVerdict(t, d, c, ctx));
  if (d.recursive) for (const g of c.globs) push2(globVerdict(g, c, ctx));
  if (!d.targets.length && c.pipedFrom && c.shell === "powershell" && PS_REMOVE.has(name)) out2.push(...pipedVerdicts(c.pipedFrom, d, c, ctx));
  return out2;
}
function destructiveRule(ctx) {
  if (ctx.event.tool !== "shell") return [];
  return ctx.commands.flatMap((c) => commandVerdicts(c, ctx));
}

// tools/src/guard/rules/find.ts
import { lstatSync as lstatSync3, readdirSync as readdirSync7 } from "node:fs";
import path16 from "node:path";
var Unsupported = class extends Error {
};
var MAX_ENTRIES = 2e4;
var UNKNOWN_1 = /* @__PURE__ */ new Set(["-size", "-mtime", "-mmin", "-atime", "-amin", "-ctime", "-cmin", "-newer", "-anewer", "-cnewer", "-user", "-group", "-uid", "-gid", "-perm", "-links", "-inum", "-samefile", "-used", "-fstype", "-lname", "-ilname", "-regex", "-iregex", "-context", "-xtype"]);
var UNKNOWN_0 = /* @__PURE__ */ new Set(["-readable", "-writable", "-executable", "-nouser", "-nogroup"]);
var OPTIONS = /* @__PURE__ */ new Set(["-depth", "-d", "-xdev", "-mount", "-noleaf", "-follow", "-ignore_readdir_race", "-noignore_readdir_race", "-daystart", "-warn", "-nowarn", "-print", "-print0", "-ls", "-quit"]);
var OUTPUT_1 = /* @__PURE__ */ new Set(["-fls", "-fprint", "-fprint0", "-printf", "-regextype"]);
var always2 = (v) => ({ k: "test", t: () => v });
function isEmpty(e) {
  try {
    if (e.type === "d") return readdirSync7(e.real).length === 0 ? 2 : 0;
    if (e.type === "f") return lstatSync3(e.real).size === 0 ? 2 : 0;
  } catch {
    return 1;
  }
  return 0;
}
function parse(expr) {
  let i = 0;
  let mindepth = 0;
  let maxdepth = Infinity;
  let deletes = false;
  const next = () => {
    if (i >= expr.length) throw new Unsupported("the find expression ends early");
    return expr[i++];
  };
  const comma = () => {
    let l = or();
    while (expr[i] === ",") {
      i++;
      l = { k: "comma", l, r: or() };
    }
    return l;
  };
  const or = () => {
    let l = and();
    while (expr[i] === "-o" || expr[i] === "-or") {
      i++;
      l = { k: "or", l, r: and() };
    }
    return l;
  };
  const and = () => {
    let l = unary();
    for (; ; ) {
      const t = expr[i];
      if (t === void 0 || t === ")" || t === "," || t === "-o" || t === "-or") return l;
      if (t === "-a" || t === "-and") i++;
      l = { k: "and", l, r: unary() };
    }
  };
  const unary = () => {
    const t = next();
    if (t === "!" || t === "-not") return { k: "not", e: unary() };
    if (t === "(") {
      const e = comma();
      if (next() !== ")") throw new Unsupported("unbalanced parentheses");
      return e;
    }
    return primary(t);
  };
  const primary = (t) => {
    if (t === "-name" || t === "-iname") {
      const re = globRegex(next(), false, t === "-iname");
      return { k: "test", t: (e) => re.test(e.name) ? 2 : 0 };
    }
    if (["-path", "-wholename", "-ipath", "-iwholename"].includes(t)) {
      const re = globRegex(next(), true, t.startsWith("-i"));
      return { k: "test", t: (e) => re.test(e.printed) ? 2 : 0 };
    }
    if (t === "-type") {
      const kinds = next().split(",");
      return { k: "test", t: (e) => kinds.includes(e.type) ? 2 : 0 };
    }
    if (t === "-empty") return { k: "test", t: isEmpty };
    if (t === "-true") return always2(2);
    if (t === "-false") return always2(0);
    if (t === "-prune") return { k: "prune" };
    if (t === "-delete") {
      deletes = true;
      return { k: "delete", tree: false, value: 2 };
    }
    if (/^-(exec|ok)(dir)?$/.test(t)) {
      const inner = [];
      for (let w = next(); w !== ";" && w !== "+"; w = next()) inner.push(w);
      const end = expr[i - 1];
      const value = end === "+" && !t.startsWith("-ok") ? 2 : 1;
      const d = deletion({ argv: inner, cwd: null, redirects: [], env: {}, assigned: [], globs: [], shell: "posix" });
      if (!d || !d.targets.some((x) => x.includes("{}"))) return always2(value);
      deletes = true;
      return { k: "delete", tree: d.recursive, value };
    }
    if (t === "-maxdepth" || t === "-mindepth") {
      const n = Number(next());
      if (!Number.isInteger(n) || n < 0) throw new Unsupported(`${t} needs a number`);
      if (t === "-maxdepth") maxdepth = n;
      else mindepth = n;
      return always2(2);
    }
    if (OPTIONS.has(t)) return always2(2);
    if (OUTPUT_1.has(t)) {
      next();
      return always2(2);
    }
    if (t === "-fprintf") {
      next();
      next();
      return always2(2);
    }
    if (UNKNOWN_1.has(t) || /^-newer[aBcmt]{2}$/.test(t)) {
      next();
      return always2(1);
    }
    if (UNKNOWN_0.has(t)) return always2(1);
    throw new Unsupported(`find ${t} is not something the guard can evaluate`);
  };
  if (!expr.length) return { node: null, mindepth, maxdepth, deletes };
  const node = comma();
  if (i < expr.length) throw new Unsupported(`unexpected ${expr[i]} in the find expression`);
  return { node, mindepth, maxdepth, deletes };
}
function evaluate(n, e, sure, fx) {
  switch (n.k) {
    case "and": {
      const l = evaluate(n.l, e, sure, fx);
      if (l === 0) return 0;
      return Math.min(l, evaluate(n.r, e, sure && l === 2, fx));
    }
    case "or": {
      const l = evaluate(n.l, e, sure, fx);
      if (l === 2) return 2;
      return Math.max(l, evaluate(n.r, e, sure && l === 0, fx));
    }
    case "comma":
      evaluate(n.l, e, sure, fx);
      return evaluate(n.r, e, sure, fx);
    case "not":
      return 2 - evaluate(n.e, e, sure, fx);
    case "test":
      return n.t(e);
    case "prune":
      if (sure) fx.prune = true;
      return 2;
    case "delete":
      fx.hits.push({ tree: n.tree, sure });
      return n.value;
  }
}
var fold2 = (s) => process.platform === "linux" ? s : s.toLowerCase();
var ask2 = (reason) => ({ decision: "ask", category: "destructive", reason, alternative: "exclude .git with -prune, or narrow the find expression" });
function typeOf(p) {
  try {
    const s = lstatSync3(p);
    return s.isDirectory() ? "d" : s.isFile() ? "f" : s.isSymbolicLink() ? "l" : "o";
  } catch {
    return null;
  }
}
function hitVerdict(e, tree, sure, ctx) {
  let recursive = tree;
  if (!tree && e.type === "d") {
    if (isEmpty(e) === 2) return null;
    recursive = true;
  }
  const p = protection(e.real, recursive, ctx);
  if (!p) return null;
  if (p.decision === "deny" && sure) return { decision: "deny", category: "destructive", reason: `find would delete ${e.printed}: ${p.why}`, alternative: p.alternative };
  return ask2(`find might delete ${e.printed} (${p.why}); the guard cannot evaluate every test`);
}
function walk(start, real, tree, min, max, ctx) {
  const type = typeOf(real);
  if (!type) return null;
  const printed = start.length > 1 ? start.replace(/\/+$/, "") || "/" : start;
  const stack = [{ real, printed, name: path16.basename(printed) || printed, depth: 0, type }];
  let worst = null;
  let seen = 0;
  while (stack.length) {
    ctx.check();
    const e = stack.pop();
    const git2 = gitPlace(e.real);
    let pruned = false;
    if (e.depth >= min && (e.type === "d" || git2 !== null)) {
      const fx = { prune: false, hits: [] };
      evaluate(tree, e, true, fx);
      pruned = fx.prune;
      for (const h of fx.hits) {
        const v = hitVerdict(e, h.tree, h.sure, ctx);
        if (v?.decision === "deny") return v;
        worst ??= v;
      }
    }
    if (e.type !== "d" || e.depth >= max || pruned || e.depth > 0 && git2 === null && HEAVY.has(e.name)) continue;
    let entries;
    try {
      entries = readdirSync7(e.real, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const d of entries) {
      const inGit = git2 !== null || fold2(d.name) === ".git";
      if (!d.isDirectory() && !inGit) continue;
      if (++seen > MAX_ENTRIES) return ask2("find walks too many entries for the guard to check what it would delete");
      const kind = d.isDirectory() ? "d" : d.isFile() ? "f" : d.isSymbolicLink() ? "l" : "o";
      stack.push({ real: path16.join(e.real, d.name), printed: e.printed === "/" ? `/${d.name}` : `${e.printed}/${d.name}`, name: d.name, depth: e.depth + 1, type: kind });
    }
  }
  return worst;
}
function findVerdict(c, ctx) {
  if (c.shell !== "posix" || c.argv[0] === void 0 || path16.basename(c.argv[0]).replace(/\.exe$/i, "") !== "find") return null;
  const { pre, starts, expr } = splitFind(c.argv);
  let parsed;
  try {
    parsed = parse(expr);
  } catch (e) {
    if (!(e instanceof Unsupported)) throw e;
    return expr.some((x) => x === "-delete" || /^-(exec|ok)(dir)?$/.test(x)) ? ask2(e.message) : null;
  }
  if (!parsed.deletes || !parsed.node) return null;
  if (pre.includes("-L") || expr.includes("-follow")) return ask2("find follows links while it deletes; the guard does not walk through them");
  let worst = null;
  for (const s of starts.length ? starts : ["."]) {
    if (!isKnown(s) || c.cwd === null && !/^([\\/~]|[a-z]:)/i.test(s)) return ask2("find deletes under a path the guard cannot see");
    const real = canonical(resolvePath(s, c.cwd ?? ctx.event.cwd, ctx.home));
    const v = walk(s, real, parsed.node, parsed.mindepth, parsed.maxdepth, ctx);
    if (v?.decision === "deny") return v;
    worst ??= v;
  }
  return worst;
}
function findRule(ctx) {
  if (ctx.event.tool !== "shell") return [];
  return ctx.commands.flatMap((c) => findVerdict(c, ctx) ?? []);
}

// tools/src/guard/rules/git.ts
import { spawnSync as spawnSync3 } from "node:child_process";
import { readFileSync as readFileSync7, statSync as statSync6 } from "node:fs";
import path18 from "node:path";

// tools/src/guard/secrets.ts
var PATTERNS2 = [
  { kind: "private-key", re: /-----BEGIN [A-Z ]{0,40}PRIVATE KEY-----/g },
  { kind: "aws", re: /AKIA[0-9A-Z]{16}/g },
  { kind: "github", re: /gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{60,255}/g },
  { kind: "anthropic", re: /sk-ant-[A-Za-z0-9_-]{20,255}/g },
  { kind: "openai", re: /sk-(?:proj-)?[A-Za-z0-9_-]{20,255}/g },
  { kind: "doppler", re: /dp\.(?:pt|st|sa|ct)\.(?:[a-z0-9_-]{1,64}\.)?[A-Za-z0-9]{20,255}/g },
  { kind: "slack", re: /xox[baprs]-[A-Za-z0-9-]{10,255}/g },
  { kind: "google", re: /AIza[0-9A-Za-z_-]{35}/g },
  { kind: "shopify", re: /shp(?:at|ca|pa|ss)_[a-fA-F0-9]{32}/g },
  { kind: "mongodb", re: /mongodb(?:\+srv)?:\/\/[^:\s/@]{1,256}:([^@\s]{1,256})@([^/\s:?#]{1,256})/g }
];
function hasDullRun(s) {
  for (let i = 0; i + 8 <= s.length; i++) {
    const seen = /* @__PURE__ */ new Set();
    let j = i;
    for (; j < s.length; j++) {
      seen.add(s[j]);
      if (seen.size > 2) break;
    }
    if (j - i >= 8) return true;
    if (j === s.length) return false;
  }
  return false;
}
function isPlaceholder(token) {
  return /EXAMPLE|example|your-|x{4}/i.test(token) || hasDullRun(token);
}
var wrapped = (line, start, end) => line[start - 1] === "<" && line[end] === ">";
function findCredential(text2) {
  const lines = text2.split("\n");
  for (let n = 0; n < lines.length; n++) {
    const line = lines[n];
    for (const { kind, re } of PATTERNS2) {
      re.lastIndex = 0;
      for (let m = re.exec(line); m; m = re.exec(line)) {
        if (kind === "openai" && m[0].startsWith("sk-ant-")) continue;
        if (kind === "mongodb") {
          const [, password, host] = m;
          if (/^(localhost|127\.0\.0\.1)$/i.test(host) || /^[A-Za-z]+$/.test(password) || isPlaceholder(password)) continue;
          return { kind, line: n + 1 };
        }
        if (isPlaceholder(m[0]) || wrapped(line, m.index, m.index + m[0].length)) continue;
        return { kind, line: n + 1 };
      }
    }
  }
  return null;
}
function addedLines(diff) {
  return diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).map((l) => l.slice(1)).join("\n");
}

// tools/src/guard/rules/scope.ts
import os from "node:os";
var COPIERS = /* @__PURE__ */ new Set(["cp", "mv", "copy", "move", "copy-item", "cpi", "move-item", "mi"]);
var PS_WRITERS = /* @__PURE__ */ new Set(["set-content", "add-content", "out-file", "new-item", "sc", "ac", "ni"]);
var NULL_DEVICE = /^(\/dev\/(null|stdout|stderr|tty)|nul|\$null)$/i;
function verdict2(abs, root) {
  return {
    decision: "ask",
    category: "out-of-scope",
    reason: `${abs} is outside the project (${root})`,
    alternative: "work inside the project or the temp folder, or confirm this path"
  };
}
function psParam(args, names2) {
  for (let i = 0; i < args.length; i++) {
    const m = /^-([a-z]+)(?::([\s\S]*))?$/i.exec(args[i]);
    if (m && m[1].length >= 2 && names2.some((n) => n.startsWith(m[1].toLowerCase()))) return m[2] ?? args[i + 1];
  }
  return void 0;
}
function positional(c) {
  const out2 = [];
  const ps = c.shell === "powershell";
  for (let i = 1; i < c.argv.length; i++) {
    const a = c.argv[i];
    if (a.startsWith("-") && a.length > 1) {
      if (ps && !a.includes(":") && i + 1 < c.argv.length && !c.argv[i + 1].startsWith("-")) i++;
      continue;
    }
    out2.push(a);
  }
  return out2;
}
function created(c) {
  const out2 = c.redirects.filter((r) => r.op.includes(">") && !/^&(\d+|-)$/.test(r.target)).map((r) => r.target.replace(/^&/, ""));
  const name = cmdName(c.argv[0] ?? "");
  const args = c.argv.slice(1);
  if (COPIERS.has(name)) {
    const t = args.indexOf("-t");
    const dest = c.shell === "powershell" ? psParam(args, ["destination"]) : t >= 0 ? args[t + 1] : args.find((a) => a.startsWith("--target-directory="))?.slice(19);
    const paths2 = positional(c);
    if (dest !== void 0) out2.push(dest);
    else if (paths2.length >= 2) out2.push(paths2.at(-1));
  } else if (name === "tee" || name === "touch") out2.push(...args.filter((a) => !a.startsWith("-")));
  else if (PS_WRITERS.has(name) && (c.shell === "powershell" || name.includes("-"))) {
    const p = psParam(args, ["path", "filepath", "literalpath"]) ?? positional(c)[0];
    if (p !== void 0) out2.push(p);
  }
  return out2;
}
function written(c) {
  const out2 = created(c);
  const name = cmdName(c.argv[0] ?? "");
  out2.push(...deletion(c)?.targets ?? []);
  if (name === "find" && c.shell === "posix") {
    const { starts, expr } = splitFind(c.argv);
    const deletes = expr.includes("-delete") || expr.some((x, i) => /^-(exec|ok)(dir)?$/.test(x) && deletion({ ...c, argv: expr.slice(i + 1) }) !== null);
    if (deletes) out2.push(...starts.length ? starts : ["."]);
  }
  return out2;
}
var UNSEEN = {
  decision: "ask",
  category: "out-of-scope",
  reason: "this writes or deletes at a path the guard cannot see",
  alternative: "write the path out literally, inside the project or the temp folder"
};
function outside(p, cwd, ctx) {
  if (p.startsWith(FOUND) || NULL_DEVICE.test(p)) return null;
  const seen = p.replaceAll(BRANCH, "branch").replaceAll(GIT_FILES, "x").replaceAll(FOUND, "x");
  if (!isKnown(seen)) return UNSEEN;
  if (cwd === null && !/^([\\/~]|[a-z]:)/i.test(seen)) return UNSEEN;
  const abs = resolvePath(seen, cwd ?? ctx.event.cwd, ctx.home);
  return isInside(abs, ctx.root) || isInside(abs, os.tmpdir()) ? null : abs;
}
function scopeRule(ctx) {
  const { event } = ctx;
  const judged = (r) => r === null ? [] : typeof r === "string" ? [verdict2(r, ctx.root)] : [r];
  if (event.tool === "write" || event.tool === "edit") return event.path === void 0 ? [] : judged(outside(event.path, event.cwd, ctx));
  if (event.tool !== "shell") return [];
  return ctx.commands.flatMap((c) => written(c).flatMap((p) => judged(outside(p, c.cwd, ctx))));
}

// tools/src/guard/rules/share.ts
import path17 from "node:path";
var NOT_FULL = "no harness verify --full passed on this commit";
function fullVerified(ctx) {
  const head = ctx.wait ? ctx.wait(() => headOf(ctx.root)) : headOf(ctx.root);
  if (head === null) return null;
  return readState(ctx.root).full?.head === head;
}
function opensPullRequest(argv) {
  if (!argv.length || !/^gh(\.exe)?$/i.test(path17.basename(argv[0]))) return false;
  const i = argv.indexOf("pr");
  return i > 0 && (argv[i + 1] === "create" || argv[i + 1] === "new");
}
function shareRule(ctx) {
  if (ctx.event.tool !== "shell") return [];
  if (!ctx.commands.some((c) => c.cwd !== null && opensPullRequest(c.argv))) return [];
  if (fullVerified(ctx) !== false) return [];
  return [{ decision: "ask", category: "share", reason: NOT_FULL, alternative: "run harness verify --full first, or approve to open it anyway" }];
}

// tools/src/guard/rules/git.ts
var GIT_MS = 3e3;
function gitMs() {
  const v = Number(process.env.HARNESS_GUARD_GIT_TIMEOUT);
  return Number.isInteger(v) && v >= 1 && v <= 6e4 ? v : GIT_MS;
}
var MAX_FILE = 1 << 20;
var NULL_PATH = process.platform === "win32" ? "NUL" : "/dev/null";
var HARDEN = ["-c", "core.fsmonitor=false", "-c", `core.hooksPath=${NULL_PATH}`, "-c", "diff.external=", "-c", "core.quotepath=off"];
var HIDDEN_ENV = /* @__PURE__ */ new Set([
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_COMMON_DIR",
  "GIT_NAMESPACE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_CEILING_DIRECTORIES",
  "GIT_DISCOVERY_ACROSS_FILESYSTEM",
  "BASH_ENV",
  "ENV",
  "HOME",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "XDG_CONFIG_HOME"
]);
var HIDDEN_NAME = String.raw`(?:GIT_(?:DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|NAMESPACE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CEILING_DIRECTORIES|DISCOVERY_ACROSS_FILESYSTEM|CONFIG\w*)|BASH_ENV|HOME|USERPROFILE|HOMEDRIVE|HOMEPATH|XDG_CONFIG_HOME)`;
var PLAIN_READ = new RegExp(String.raw`\$(?:\{(?:env:)?${HIDDEN_NAME}\}|(?:env:)?${HIDDEN_NAME})(?![\w:]|\s*[-+*/]?=)`, "gi");
var MENTION = new RegExp(String.raw`(?<!\w)${HIDDEN_NAME}(?!\w)`);
var ENV_DRIVE = new RegExp(String.raw`env:\\?(?:${HIDDEN_NAME}(?!\w)|(?![A-Za-z_]))`, "i");
var CMD_SET = new RegExp(String.raw`\bset\s+["']?${HIDDEN_NAME}\s*=`, "i");
var DECLARES = /\b(?:export|declare|typeset|readonly|local|read|unset|mapfile|readarray)\b([^;&|\n]*)|\bprintf\s+-v\s*(\S+)/g;
function setsGitEnv(text2) {
  const rest = text2.replace(/\$(?=["'])/g, "").replace(/["'\\`]/g, "").replace(PLAIN_READ, "");
  if (MENTION.test(rest) || ENV_DRIVE.test(rest) || CMD_SET.test(rest) || /SetEnvironmentVariable/i.test(rest)) return true;
  for (const m of rest.matchAll(DECLARES)) {
    const names2 = m[2] !== void 0 ? [m[2]] : m[1].trim().split(/\s+/).filter((w) => w && !w.startsWith("-"));
    if (names2.some((w) => /[$`]/.test(w.split("=")[0]))) return true;
  }
  return false;
}
var POSIX_SHELLS = /* @__PURE__ */ new Set(["sh", "bash", "zsh", "dash", "ksh", "mksh"]);
var CMD_BUILTINS = /* @__PURE__ */ new Set([
  "echo",
  "set",
  "cd",
  "chdir",
  "dir",
  "type",
  "copy",
  "move",
  "del",
  "erase",
  "ren",
  "rename",
  "md",
  "mkdir",
  "rd",
  "rmdir",
  "pushd",
  "popd",
  "cls",
  "ver",
  "vol",
  "title",
  "exit",
  "rem",
  "goto",
  "start",
  "setlocal",
  "endlocal",
  "mklink",
  "color"
]);
function runsScriptHere(c) {
  const n = cmdName(c.argv[0]);
  const native = /\.(exe|com)$/i.test(c.argv[0] ?? "");
  if (n === "call" || /\.(bat|cmd)$/.test(n)) return true;
  if (c.cmd && !native && (/[\\/]/.test(c.argv[0] ?? "") || n !== "git" && !CMD_BUILTINS.has(n))) return true;
  if ("BASH_ENV" in c.env || "ENV" in c.env) return true;
  if (POSIX_SHELLS.has(n) && c.argv.some((a) => /^--(rcfile|init-file|login)$/.test(a) || /^-[a-z]*[il][a-z]*$/.test(a))) return true;
  if (n === "zsh") {
    const end = c.argv.findIndex((a, i) => i > 0 && !a.startsWith("-"));
    const opts = c.argv.slice(1, end < 0 ? void 0 : end);
    if (!opts.some((a) => a === "--no-rcs" || /^-[a-z]*f[a-z]*$/.test(a))) return true;
  }
  if (c.shell === "powershell") {
    return /\.psm?1$/.test(n) || ["import-module", "ipmo", "using"].includes(n) || !native && (c.called === true || /[\\/]/.test(c.argv[0] ?? ""));
  }
  return n === "source" || n === ".";
}
var HARMLESS_KEY = /^(user|color|advice|pager|gpg|credential|http|i18n|help|init)\.|^commit\.gpgsign$|^core\.(quotepath|pager|editor|longpaths|autocrlf|safecrlf)$/i;
function parseGit(c, lineHides) {
  const a = c.argv;
  if (cmdName(a[0] ?? "") !== "git") return null;
  const names2 = [...Object.keys(c.env).map((k) => k.toUpperCase()), ...c.assigned];
  const hidden = lineHides || names2.some((k) => HIDDEN_ENV.has(k) || k.startsWith("GIT_CONFIG"));
  const g = { sub: "", args: [], pushRefspecs: false, redirected: hidden, cwd: c.cwd };
  let i = 1;
  while (i < a.length && a[i].startsWith("-")) {
    const o = a[i];
    if (o === "-c") {
      const kv = a[i + 1] ?? "";
      const [k, v = "true"] = kv.split(/=(.*)/s);
      if (/^push\.default$/i.test(k)) g.pushDefault = v.toLowerCase();
      else if (/^remote\..*\.(push|mirror)$/i.test(k)) g.pushRefspecs = true;
      else if (!HARMLESS_KEY.test(k)) g.redirected = true;
      i += 2;
      continue;
    }
    if (/^--(git-dir|work-tree|namespace|config-env)(=|$)/.test(o)) {
      g.redirected = true;
      if (!o.includes("=")) i++;
    } else if (o === "--exec-path") i++;
    i++;
  }
  g.sub = a[i] ?? "";
  g.args = a.slice(i + 1);
  return g;
}
var CONFIG_KEYS = "^(filter\\..*\\.(clean|smudge|process)|push\\.default|remote\\..*\\.(push|mirror)|branch\\..*\\.merge)$";
var configCache = /* @__PURE__ */ new WeakMap();
function call(ctx, cwd, args, input) {
  const spawn2 = () => spawnSync3("git", args, {
    cwd,
    input,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
    timeout: gitMs(),
    windowsHide: true,
    maxBuffer: 64 << 20
  });
  const r = ctx.wait ? ctx.wait(spawn2) : spawn2();
  const failed = r.error !== void 0 || r.status === null;
  const raw = r.stdout ?? Buffer.alloc(0);
  return { ok: !failed && r.status === 0, status: r.status, out: raw.toString("utf8"), raw, failed };
}
function configOf(cwd, ctx) {
  let cache = configCache.get(ctx);
  if (!cache) configCache.set(ctx, cache = /* @__PURE__ */ new Map());
  let c = cache.get(cwd);
  if (!c) {
    const r = call(ctx, cwd, [...HARDEN, "config", "--get-regexp", CONFIG_KEYS]);
    const lines = r.out.split("\n").map((l) => l.trim()).filter(Boolean);
    const names2 = new Set(lines.map((l) => /^filter\.(.+)\.(clean|smudge|process) /i.exec(l + " ")?.[1]).filter((x) => !!x));
    const filters = [...names2].flatMap((n) => ["-c", `filter.${n}.clean=`, "-c", `filter.${n}.smudge=`, "-c", `filter.${n}.process=`, "-c", `filter.${n}.required=false`]);
    c = { filters, lines: lines.filter((l) => !/^filter\./i.test(l)), failed: r.failed };
    cache.set(cwd, c);
  }
  return c;
}
function run(g, args, ctx, input) {
  if (g.cwd === null || g.redirected) return { ok: false, status: null, out: "", raw: Buffer.alloc(0), failed: true };
  ctx.check();
  const { filters } = configOf(g.cwd, ctx);
  const r = call(ctx, g.cwd, [...HARDEN, ...filters, ...args], input);
  ctx.check();
  return r;
}
var unread = (what) => ({
  decision: "ask",
  category: "unreadable",
  reason: `the guard could not ask git ${what}`,
  alternative: "run the command from inside the repository, with plain paths"
});
function topOf(g, st, ctx) {
  if (g.cwd === null || g.redirected) return null;
  if (!st.tops.has(g.cwd)) {
    const r = run(g, ["rev-parse", "--show-toplevel"], ctx);
    st.tops.set(g.cwd, r.ok ? canonical(r.out.trim()) : null);
    if (r.failed) st.gitDown.add(g.cwd);
  }
  return st.tops.get(g.cwd);
}
function currentBranch(g, st, ctx) {
  const top = topOf(g, st, ctx);
  if (top === null) return UNKNOWN;
  const moved = st.branches.get(top);
  if (moved !== void 0) return moved;
  if (st.movedSomewhere) return UNKNOWN;
  const r = run(g, ["symbolic-ref", "--short", "-q", "HEAD"], ctx);
  if (r.ok) return r.out.trim() || UNKNOWN;
  return r.status === 1 ? "HEAD" : UNKNOWN;
}
function moveTo(g) {
  const made = [];
  const pos = [];
  let track = false;
  let detach = false;
  const create = g.sub === "checkout" ? ["-b", "-B", "--orphan"] : ["-c", "-C", "--create", "--force-create", "--orphan"];
  for (let i = 0; i < g.args.length; i++) {
    const a = g.args[i];
    if (a === "--") {
      if (g.sub === "checkout") return made[0];
      break;
    }
    if (create.includes(a)) made.push(g.args[++i] ?? UNKNOWN);
    else if (/^-[bBcC]./.test(a) && create.includes(a.slice(0, 2))) made.push(a.slice(2));
    else if (/^--(orphan|create|force-create)=/.test(a)) made.push(a.slice(a.indexOf("=") + 1));
    else if (a === "-t" || a.startsWith("--track")) track = true;
    else if (a === "--detach" || a === "-d") detach = true;
    else if (!a.startsWith("-")) pos.push(a);
  }
  if (made.length) return made[0];
  if (detach) return "HEAD";
  if (pos.length !== 1) return g.sub === "switch" && pos.length ? pos[0] : void 0;
  if (pos[0] === "-") return UNKNOWN;
  return track ? pos[0].replace(/^[^/]+\//, "") : pos[0];
}
function branchName(dst) {
  const n = dst.replace(/^refs\/heads\//, "").replace(/^heads\//, "");
  return n.startsWith("refs/") || n.startsWith("tags/") ? null : n;
}
function protectedName(n, ctx) {
  if (n === "HEAD") return "no";
  const list = ctx.config.protectedBranches;
  if (isKnown(n) && !n.includes("*")) return list.includes(n) ? "yes" : "no";
  const re = new RegExp(`^${n.split(/\0[a-z]+|\*/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);
  return list.some((b) => re.test(b)) ? "maybe" : "no";
}
var PUSH_LONG = [
  "all",
  "branches",
  "prune",
  "mirror",
  "dry-run",
  "porcelain",
  "delete",
  "tags",
  "follow-tags",
  "signed",
  "atomic",
  "push-option",
  "receive-pack",
  "exec",
  "force",
  "force-with-lease",
  "force-if-includes",
  "repo",
  "set-upstream",
  "thin",
  "quiet",
  "verbose",
  "progress",
  "recurse-submodules",
  "verify",
  "ipv4",
  "ipv6"
];
var PUSH_VALUE = /* @__PURE__ */ new Set(["push-option", "receive-pack", "exec", "repo"]);
function longOption(word) {
  let n = word.slice(2).split("=")[0];
  const negated = n.startsWith("no-") && !PUSH_LONG.some((o) => o.startsWith(n));
  if (negated) n = n.slice(3);
  if (PUSH_LONG.includes(n)) return { name: n, negated };
  const hits = PUSH_LONG.filter((o) => o.startsWith(n));
  return { name: hits.length === 1 ? hits[0] : null, negated };
}
function push(g, st, ctx) {
  let force = false;
  let del = false;
  let all = false;
  let mirror = false;
  let tags = false;
  let prune = false;
  let unknownOption = "";
  const pos = [];
  for (let i = 0; i < g.args.length; i++) {
    const a = g.args[i];
    if (a === "--") {
      pos.push(...g.args.slice(i + 1));
      break;
    }
    if (a.startsWith("--")) {
      const { name, negated } = longOption(a);
      const on = !negated;
      if (name === null) unknownOption ||= a;
      else if (name === "force" || name === "force-with-lease") force = on;
      else if (name === "delete") del = on;
      else if (name === "all" || name === "branches") all = on;
      else if (name === "mirror") mirror = on;
      else if (name === "tags") tags = on;
      else if (name === "prune") prune = on;
      else if (name === "dry-run" && on) return [];
      else if (PUSH_VALUE.has(name) && !a.includes("=") && on) i++;
    } else if (/^-./.test(a)) {
      for (let k = 1; k < a.length; k++) {
        const ch = a[k];
        if (ch === "f") force = true;
        else if (ch === "d") del = true;
        else if (ch === "n") return [];
        else if (ch === "o") {
          if (k === a.length - 1) i++;
          break;
        }
      }
    } else pos.push(a);
  }
  const out2 = [];
  const history = (decision, reason) => ({
    decision,
    category: "history",
    reason,
    alternative: decision === "deny" ? "open a pull request, or push to a branch of your own" : "confirm that rewriting or deleting it on the remote is intended"
  });
  if (unknownOption) out2.push(history("ask", `git push ${unknownOption} is an option the guard does not know`));
  if (mirror) return [history("deny", "git push --mirror overwrites and deletes every branch on the remote")];
  if (prune) out2.push(history("ask", "git push --prune deletes remote branches that have no local copy"));
  const everyBranch = (why = "this pushes every branch, protected ones included") => force ? history("deny", "a forced push of every branch rewrites the protected ones too") : { decision: "ask", category: "main-branch", reason: why, alternative: "push the branch you mean by name" };
  let specs = pos.slice(1);
  if (all) return [...out2, everyBranch()];
  let current;
  const branch = () => current ??= currentBranch(g, st, ctx);
  if (!specs.length) {
    if (tags) return out2;
    if (st.configChanged) return [...out2, everyBranch("git config changed earlier on this line, so the guard cannot tell what this push sends")];
    if (g.pushDefault === "matching" || g.pushRefspecs) return [...out2, everyBranch()];
    const cfg = g.cwd === null || g.redirected ? { failed: true, lines: [] } : configOf(g.cwd, ctx);
    if (cfg.failed) return [...out2, unread("how this repository pushes")];
    const lines = cfg.lines;
    const value = (re) => lines.find((l) => re.test(l.split(" ")[0]))?.split(" ").slice(1).join(" ");
    if (lines.some((l) => /^remote\..*\.mirror true$/i.test(l))) return [...out2, history(force ? "deny" : "ask", "a remote here is configured as a mirror: a push overwrites and deletes branches")];
    if (lines.some((l) => /^remote\..*\.push /i.test(l))) return [...out2, everyBranch("this repository's remote.*.push decides what a plain git push sends")];
    const mode = g.pushDefault ?? value(/^push\.default$/i)?.toLowerCase();
    if (mode === "matching") return [...out2, everyBranch()];
    if (mode === "upstream" || mode === "tracking") {
      const b = branch();
      const merge = isKnown(b) ? value(new RegExp(`^branch\\.${b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.merge$`)) : void 0;
      specs = [merge ? `HEAD:${merge}` : "HEAD"];
    } else specs = ["HEAD"];
  }
  for (const spec of specs) {
    let s = spec;
    let f = force;
    if (s.startsWith("+")) {
      f = true;
      s = s.slice(1);
    }
    if (s === ":") {
      out2.push(everyBranch());
      continue;
    }
    const colon = s.indexOf(":");
    const src = colon >= 0 ? s.slice(0, colon) : s;
    let dst = colon >= 0 ? s.slice(colon + 1) : s;
    const deletes = del || colon >= 0 && src === "";
    if (dst === "HEAD" || dst === "@") dst = branch();
    if (dst.includes(BRANCH)) dst = dst.replaceAll(BRANCH, branch());
    const name = dst === "" ? null : branchName(dst);
    if (name === null) continue;
    const p = protectedName(name, ctx);
    const shown3 = isKnown(name) ? name : "a branch the guard cannot see";
    if (deletes) out2.push(history(p === "yes" ? "deny" : "ask", `this deletes ${shown3} on the remote${p === "yes" ? ", a protected branch" : ""}`));
    else if (f) out2.push(history(p === "yes" ? "deny" : "ask", `a forced push rewrites the history of ${shown3}${p === "yes" ? ", a protected branch" : ""}`));
    else if (p !== "no") {
      const decision = p === "yes" ? ctx.config.mainPush : "ask";
      const unverified = p === "yes" && decision === "ask" && fullVerified(ctx) === false ? `; ${NOT_FULL}` : "";
      out2.push({
        decision,
        category: "main-branch",
        reason: (p === "yes" ? `this pushes straight to ${name}, a protected branch` : `this may push to a protected branch (${shown3})`) + unverified,
        alternative: "push a branch of your own and open a pull request"
      });
    }
  }
  return out2;
}
function perFile(diff, reverse = false) {
  const out2 = [];
  for (const chunk of diff.split(/^(?=diff --git )/m)) {
    const m = (reverse ? /^--- (?:a\/)?(.*)$/m : /^\+\+\+ (?:b\/)?(.*)$/m).exec(chunk);
    if (!m || m[1] === "/dev/null") continue;
    const lines = reverse ? chunk.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---")).map((l) => "+" + l.slice(1)).join("\n") : chunk;
    out2.push({ file: m[1].replace(/\t.*$/, ""), added: addedLines(lines) });
  }
  return out2;
}
function credentialVerdict(what, file, text2) {
  const found = findCredential(text2);
  if (!found) return null;
  return {
    decision: "deny",
    category: "secret-content",
    reason: `${what} would add what looks like a ${found.kind} credential to ${file} (added line ${found.line})`,
    alternative: "keep the value in the secret manager or an ignored .env and refer to it by name"
  };
}
function secretVerdict(what, abs, ctx) {
  if (!isSecretPath(abs, ctx.config.extraSecretPaths, ctx.root, ctx.home)) return null;
  return {
    decision: "deny",
    category: "secret-file",
    reason: `${what} would put the secret file ${path18.relative(ctx.root, abs) || abs} in the repository`,
    alternative: "add it to .gitignore and keep the names without values in .env.example"
  };
}
var unseen = (what, file) => ({
  decision: "ask",
  category: "secret-content",
  reason: `${what} takes ${file}, written earlier on this line with content the guard cannot see`,
  alternative: "write the file first, then stage it in a separate command"
});
function readText2(abs) {
  try {
    if (statSync6(abs).size > MAX_FILE) return null;
    const text2 = readFileSync7(abs, "utf8");
    return text2.includes("\0") ? null : text2;
  } catch {
    return null;
  }
}
function indexBlobs(g, files, ctx) {
  const r = run(g, ["cat-file", "--batch"], ctx, files.map((f) => `:${f}
`).join(""));
  if (r.failed) return null;
  const out2 = /* @__PURE__ */ new Map();
  let at = 0;
  for (const f of files) {
    const nl = r.raw.indexOf(10, at);
    if (nl < 0) return null;
    const head = r.raw.subarray(at, nl).toString("utf8");
    at = nl + 1;
    const m = /^\S+ blob (\d+)$/.exec(head);
    if (!m) continue;
    const size = Number(m[1]);
    out2.set(f, r.raw.subarray(at, at + size).toString("utf8"));
    at += size + 1;
  }
  return out2;
}
function newLines(before, after) {
  const left = /* @__PURE__ */ new Map();
  for (const l of before.split("\n")) left.set(l, (left.get(l) ?? 0) + 1);
  return after.split("\n").filter((l) => {
    const n = left.get(l) ?? 0;
    if (n > 0) left.set(l, n - 1);
    return n === 0;
  }).join("\n");
}
function judgeWorktree(what, g, top, files, ctx) {
  const out2 = [];
  for (const f of files) {
    const v = secretVerdict(what, path18.join(top, f), ctx);
    if (v) out2.push(v);
  }
  if (out2.length || !files.length) return out2;
  const index = indexBlobs(g, files, ctx);
  if (!index) return [unread("what the index holds")];
  for (const f of files) {
    const text2 = readText2(path18.join(top, f));
    if (text2 === null) continue;
    const v = credentialVerdict(what, f, newLines(index.get(f) ?? "", text2));
    if (v) return [v];
  }
  return out2;
}
var ADD_SKIP = /^(--patch|--interactive|--edit|--dry-run|--refresh)$|^-[^-]*[pien]/;
var rel = (top, abs) => path18.relative(top, canonical(abs)).replaceAll("\\", "/");
function add(g, st, ctx) {
  if (g.args.some((a) => ADD_SKIP.test(a))) return [];
  if (g.redirected || g.cwd === null || g.args.some((a) => !isKnown(a))) return [unread("what git add would stage")];
  const dash = g.args.indexOf("--");
  const specs = g.args.filter((a, i) => dash >= 0 ? i > dash : !a.startsWith("-"));
  const top = topOf(g, st, ctx);
  if (top === null && st.gitDown.has(g.cwd)) return [unread("what git add would stage")];
  if (top === null) return specs.flatMap((s) => secretVerdict("git add", resolvePath(s, g.cwd, ctx.home), ctx) ?? []);
  const dry = run(g, ["add", "--dry-run", "--ignore-missing", ...g.args], ctx);
  if (dry.failed) return [unread("what git add would stage")];
  const files = [...dry.out.matchAll(/^add '(.*)'$/gm)].map((m) => m[1]);
  const everything = g.args.some((a) => a === "-A" || a === "--all" || /^-[^-]*A/.test(a));
  const untrackedToo = everything || !g.args.some((a) => a === "-u" || a === "--update" || /^-[^-]*u/.test(a));
  const covered = st.written.filter((w) => untrackedToo && isInside(w.abs, top) && (specs.length ? specs.some((s) => isInside(w.abs, resolvePath(s, g.cwd, ctx.home))) : everything));
  const later = [];
  if (covered.length) {
    const fromCwd = covered.map((w) => path18.relative(g.cwd, w.abs).replaceAll("\\", "/"));
    let ignored = /* @__PURE__ */ new Set();
    if (!g.args.some((a) => a === "--force" || /^-[^-]*f/.test(a))) {
      const ig = run(g, ["check-ignore", "--", ...fromCwd], ctx);
      if (ig.failed || ig.status !== 0 && ig.status !== 1) return [unread("which files .gitignore leaves out")];
      ignored = new Set(ig.out.split("\n").map((l) => l.trim()).filter(Boolean));
    }
    later.push(...covered.filter((_, i) => !ignored.has(fromCwd[i])));
  }
  const names2 = [.../* @__PURE__ */ new Set([...files, ...later.map((w) => rel(top, w.abs))])];
  const out2 = judgeWorktree("git add", g, top, names2, ctx);
  if (out2.some((v) => v.decision === "deny")) return out2;
  const blind = later.find((w) => !w.visible);
  return blind ? [...out2, unseen("git add", rel(top, blind.abs))] : out2;
}
var COMMIT_VALUE = /* @__PURE__ */ new Set(["-m", "-F", "-c", "-C", "-t", "--message", "--file", "--author", "--date", "--template", "--reuse-message", "--reedit-message", "--fixup", "--squash", "--cleanup", "--trailer", "--pathspec-from-file"]);
function commit(g, st, ctx) {
  let all = false;
  let paths2 = false;
  for (let i = 0; i < g.args.length; i++) {
    const a = g.args[i];
    if (a === "--") {
      paths2 ||= i < g.args.length - 1;
      break;
    }
    if (a === "--dry-run") return [];
    if (a === "--all" || a === "--include" || a === "--only") all = true;
    else if (a.startsWith("--pathspec-from-file")) {
      paths2 = true;
      if (!a.includes("=")) i++;
    } else if (a.startsWith("--")) {
      if (COMMIT_VALUE.has(a)) i++;
    } else if (/^-./.test(a)) {
      for (let k = 1; k < a.length; k++) {
        if (a[k] === "a" || a[k] === "i" || a[k] === "o") all = true;
        if (COMMIT_VALUE.has(`-${a[k]}`)) {
          if (k === a.length - 1) i++;
          break;
        }
      }
    } else paths2 = true;
  }
  if (g.redirected || g.cwd === null) return [unread("what git commit would record")];
  const top = topOf(g, st, ctx);
  if (top === null) return st.gitDown.has(g.cwd) ? [unread("what git commit would record")] : [];
  const out2 = [];
  const names2 = run(g, ["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMRT"], ctx);
  const diff = run(g, ["diff", "--cached", "-U0", "--text", "--no-color", "--no-ext-diff", "--no-textconv", "--diff-filter=ACMRT"], ctx);
  if (names2.failed || diff.failed) return [unread("what git commit would record")];
  for (const f of names2.out.split("\0").filter(Boolean)) {
    const v = secretVerdict("git commit", path18.join(top, f), ctx);
    if (v) out2.push(v);
  }
  for (const c of perFile(diff.out)) {
    const v = credentialVerdict("git commit", c.file, c.added);
    if (v) out2.push(v);
  }
  if (!(all || paths2)) return out2;
  const tracked = run(g, ["ls-files", "-z"], ctx);
  if (tracked.failed) return [unread("which files are tracked")];
  const known = tracked.out.split("\0").filter(Boolean);
  const index = indexBlobs(g, known, ctx);
  if (!index) return [unread("what the index holds")];
  for (const f of known) {
    ctx.check();
    const text2 = readText2(path18.join(top, f));
    if (text2 === null || text2 === index.get(f)) continue;
    const v = secretVerdict("git commit", path18.join(top, f), ctx) ?? credentialVerdict("git commit", f, newLines(index.get(f) ?? "", text2));
    if (v) out2.push(v);
  }
  const knownSet = new Set(known);
  for (const w of st.written) {
    if (!isInside(w.abs, top)) continue;
    const r = rel(top, w.abs);
    if (!knownSet.has(r) && !paths2) continue;
    const v = secretVerdict("git commit", w.abs, ctx) ?? (w.visible ? null : unseen("git commit", r));
    if (v) out2.push(v);
  }
  return out2;
}
function unquote2(s) {
  if (!s.startsWith('"')) return s;
  const bytes = [];
  const named = { a: 7, b: 8, f: 12, n: 10, r: 13, t: 9, v: 11, '"': 34, "\\": 92 };
  for (let i = 1; i < s.length && s[i] !== '"'; i++) {
    if (s[i] !== "\\") {
      bytes.push(...Buffer.from(s[i], "utf8"));
      continue;
    }
    const o = /^[0-7]{3}/.exec(s.slice(i + 1));
    if (o) {
      bytes.push(parseInt(o[0], 8));
      i += 3;
    } else bytes.push(named[s[++i]] ?? s.charCodeAt(i));
  }
  return Buffer.from(bytes).toString("utf8");
}
function headerTarget(h) {
  if (h.endsWith('"')) {
    const start = h.lastIndexOf(' "');
    return start < 0 ? null : unquote2(h.slice(start + 1)).replace(/^b\//, "");
  }
  const at = h.lastIndexOf(" b/");
  return at < 0 ? null : h.slice(at + 3);
}
function apply(g, c, ctx) {
  const reverse = g.args.some((a) => a === "-R" || a === "--reverse");
  if (g.sub === "apply" && g.args.some((a) => /^--(check|stat|numstat|summary)$/.test(a)) && !g.args.includes("--apply")) return [];
  const patches = g.args.filter((a) => !a.startsWith("-") || a === "-");
  const texts = [];
  if (!patches.length || patches.includes("-")) {
    if (c.stdin === void 0) return [unread("what the patch on stdin adds")];
    texts.push(c.stdin);
  }
  for (const p of patches.filter((x) => x !== "-")) {
    if (!isKnown(p) || g.cwd === null) return [unread(`what the patch ${p} adds`)];
    const text2 = readText2(resolvePath(p, g.cwd, ctx.home));
    if (text2 === null) return [unread(`what the patch ${p} adds`)];
    texts.push(text2);
  }
  const what = `git ${g.sub}`;
  for (const text2 of texts) {
    if (/^GIT binary patch$/m.test(text2)) return [{ ...unread("what a binary patch adds"), category: "secret-content" }];
    const targets = [
      ...[...text2.matchAll(/^diff --git (.*)$/gm)].map((m) => headerTarget(m[1])),
      ...[...text2.matchAll(/^(?:rename|copy) to (.*)$/gm)].map((m) => unquote2(m[1])),
      ...[...text2.matchAll(/^\+\+\+ (.*)$/gm)].map((m) => unquote2(m[1].replace(/\t[^"]*$/, "")).replace(/^b\//, ""))
    ].filter((t) => t !== null && t !== "/dev/null");
    for (const t of targets) {
      const v = secretVerdict(what, path18.join(ctx.root, t), ctx);
      if (v) return [v];
    }
    for (const ch of perFile(text2, reverse)) {
      const v = credentialVerdict(what, ch.file, ch.added);
      if (v) return [v];
    }
  }
  return [];
}
var VISIBLE = /* @__PURE__ */ new Set(["echo", "printf", "write-output", "touch", "new-item", "ni", "set-content", "add-content", "out-file", "sc", "ac"]);
function visibleWrite(c) {
  const name = cmdName(c.argv[0] ?? "");
  const known = [...c.argv.slice(1), c.stdin ?? "", c.piped ?? ""].every(isKnown);
  if (VISIBLE.has(name)) return known;
  if (name === "cat" || name === "tee") return known && (c.stdin !== void 0 || /^(echo|printf)\s/.test(c.piped ?? ""));
  return false;
}
var GIT_CONFIG_READ = /^(--get|--get-all|--get-regexp|--list|-l|--show-origin|--show-scope|--name-only|get|list)$/;
function skipsHook(c) {
  if (cmdName(c.argv[0]) !== "git") return false;
  const a = c.argv;
  for (let i = 1; i < a.length; i++) {
    if (a[i] === "-c" && /^core\.hookspath=/i.test(a[i + 1] ?? "")) return true;
    if (/^--config-env=core\.hookspath=/i.test(a[i])) return true;
  }
  const g = parseGit(c, false);
  if (!g) return false;
  if (g.sub === "push") return g.args.includes("--no-verify");
  if (g.sub === "commit") {
    for (let i = 0; i < g.args.length; i++) {
      const x = g.args[i];
      if (x === "--") break;
      if (x === "--no-verify") return true;
      if (x.startsWith("--")) {
        if (COMMIT_VALUE.has(x)) i++;
      } else if (/^-./.test(x)) {
        for (let k = 1; k < x.length; k++) {
          if (x[k] === "n") return true;
          if (COMMIT_VALUE.has(`-${x[k]}`)) {
            if (k === x.length - 1) i++;
            break;
          }
        }
      }
    }
    return false;
  }
  if (g.sub === "config") return g.args.some((x) => /^core\.hookspath$/i.test(x)) && !g.args.some((x) => GIT_CONFIG_READ.test(x));
  return false;
}
function gitRule(ctx) {
  if (ctx.event.tool !== "shell") return [];
  const st = { branches: /* @__PURE__ */ new Map(), movedSomewhere: false, configChanged: false, written: [], tops: /* @__PURE__ */ new Map(), gitDown: /* @__PURE__ */ new Set() };
  const out2 = [];
  const lineHides = setsGitEnv(ctx.event.command ?? "") || ctx.commands.some(runsScriptHere);
  for (const c of ctx.commands) {
    const g = parseGit(c, lineHides);
    if (g) {
      if (g.sub === "push") out2.push(...push(g, st, ctx));
      else if (g.sub === "add" || g.sub === "stage") out2.push(...add(g, st, ctx));
      else if (g.sub === "commit") out2.push(...commit(g, st, ctx));
      else if (g.sub === "apply" || g.sub === "am") out2.push(...apply(g, c, ctx));
      else if (g.sub === "config" && !g.args.some((a) => GIT_CONFIG_READ.test(a)) && g.args.filter((a) => !a.startsWith("-")).length !== 1) st.configChanged = true;
      else if (g.sub === "checkout" || g.sub === "switch") {
        const to = moveTo(g);
        const top = to === void 0 ? null : topOf(g, st, ctx);
        if (to !== void 0 && top !== null) st.branches.set(top, to);
        else if (to !== void 0) st.movedSomewhere = true;
      }
    }
    if (c.cwd !== null) {
      const visible = visibleWrite(c);
      for (const p of created(c)) if (isKnown(p)) st.written.push({ abs: resolvePath(p, c.cwd, ctx.home), visible });
    }
  }
  return out2;
}

// tools/src/guard/rules/guard-config.ts
import path20 from "node:path";

// tools/src/guard/rules/secret-file.ts
import { readdirSync as readdirSync8 } from "node:fs";
import path19 from "node:path";
var READERS = /* @__PURE__ */ new Set([
  "cat",
  "less",
  "more",
  "head",
  "tail",
  "type",
  "gc",
  "get-content",
  "base64",
  "xxd",
  "od",
  "hexdump",
  "strings",
  "grep",
  "egrep",
  "fgrep",
  "rg",
  "select-string",
  "sls",
  "source",
  ".",
  "bat",
  "nl",
  "tac",
  "sort",
  "uniq",
  "cut",
  "awk",
  "sed",
  "diff",
  "jq",
  "dd",
  "findstr"
]);
var COPIERS2 = /* @__PURE__ */ new Set(["cp", "mv", "scp", "rsync", "copy", "copy-item", "cpi", "move", "move-item", "mi", "ln", "link", "mklink"]);
var WRITERS = /* @__PURE__ */ new Set(["tee", "set-content", "sc", "add-content", "ac", "out-file", "new-item", "ni"]);
var PATTERN_FIRST = /* @__PURE__ */ new Set(["grep", "egrep", "fgrep", "rg", "findstr"]);
var INTERPRETER = /^(python|py|pypy|node|nodejs|deno|bun|perl|ruby|php)[\d.]*$/;
var RUNNERS = /* @__PURE__ */ new Set(["uv", "poetry", "pipenv", "pdm", "hatch", "rye"]);
var SENDERS = /* @__PURE__ */ new Set(["curl", "wget", "invoke-webrequest", "iwr", "invoke-restmethod", "irm"]);
var MAX_MENTIONS = 300;
function interpreterAt(c) {
  if (INTERPRETER.test(cmdName(c.argv[0]))) return 0;
  if (RUNNERS.has(cmdName(c.argv[0])) && c.argv[1] === "run" && INTERPRETER.test(cmdName(c.argv[2]))) return 2;
  return -1;
}
function mentionedPaths(c) {
  const at = interpreterAt(c);
  if (at < 0) return [];
  const text2 = [...c.argv.slice(at + 1), c.stdin ?? ""].join("\n");
  const words = new Set((text2.match(/[\w.~/\\:+-]+/g) ?? []).filter((w) => /[./\\]/.test(w) && w.length <= 260));
  return words.size > MAX_MENTIONS ? null : [...words];
}
function sentFiles(c) {
  if (!SENDERS.has(cmdName(c.argv[0]))) return [];
  const a = c.argv;
  const out2 = [];
  for (let i = 1; i < a.length; i++) {
    const x = a[i];
    const long = /^--(upload-file|post-file|body-file|config)(?:=([\s\S]*))?$/.exec(x);
    const short = /^-([TK])([\s\S]*)$/.exec(x);
    const inFile = /^-inf(?:i(?:le?)?)?(?::([\s\S]*))?$/i.exec(x);
    if (long) out2.push(long[2] ?? a[i + 1] ?? "");
    else if (short) out2.push(short[2] || (a[i + 1] ?? ""));
    else if (inFile) out2.push(inFile[1] ?? a[i + 1] ?? "");
    const data = /(?:^|=|^-[a-zA-Z]*[dF])@([^;,]+)|=<([^;,]+)/.exec(x);
    if (data) out2.push(data[1] ?? data[2]);
  }
  return out2;
}
function shown2(ctx, abs) {
  return isInside(abs, ctx.root) ? path19.relative(ctx.root, abs) || "." : abs;
}
function readVerdict(ctx, abs) {
  return {
    decision: ctx.config.secretFileRead,
    category: "secret-file",
    reason: `${shown2(ctx, abs)} is a secret file; reading or copying it would expose its values`,
    alternative: "use .env.example, or run the command that needs it without printing it"
  };
}
function writeVerdict(ctx, abs) {
  return {
    decision: "deny",
    category: "secret-file",
    reason: `${shown2(ctx, abs)} is a secret file; the agent does not write secret values`,
    alternative: "put the names without values in .env.example and set the real values outside the agent"
  };
}
function fileArgs(c, name) {
  const words = [];
  let patternSkipped = !PATTERN_FIRST.has(name) || c.argv.some((x) => /^(-e|-f|--regexp|--file)(=|$)/.test(x) || /^-e./.test(x));
  for (const x of c.argv.slice(1)) {
    if (x.startsWith("-")) {
      const v = /^-[^=:]*[=:]([\s\S]+)$/.exec(x);
      if (v) words.push({ arg: v[1] });
      continue;
    }
    if (!patternSkipped) {
      patternSkipped = true;
      continue;
    }
    const kv = /^([a-z]+)=([\s\S]*)$/.exec(x);
    words.push(kv ? { arg: kv[2], key: kv[1] } : { arg: x });
  }
  return words.map((w, i) => ({ ...w, last: i === words.length - 1 }));
}
var SEARCH_VALUE = /* @__PURE__ */ new Set(["-e", "-f", "-m", "-A", "-B", "-C", "-d", "-D", "-g", "-t", "-T", "-j", "-M", "-E", "--exclude", "--exclude-dir", "--include", "--glob", "--iglob", "--type", "--regexp", "--file"]);
var WALK_LIMIT = 2e4;
function recursiveSearch(c) {
  const name = cmdName(c.argv[0]);
  const a = c.argv;
  const flags = a.slice(1).filter((x) => x.startsWith("-"));
  let hidden = true;
  if (["grep", "egrep", "fgrep"].includes(name)) {
    const recursive = flags.some((x) => /^-[a-zA-Z]*[rR]/.test(x) || /^--(recursive|dereference-recursive|directories=recurse)$/.test(x)) || a.some((x, i) => x === "-d" && a[i + 1] === "recurse");
    if (!recursive) return null;
  } else if (name === "rg") {
    hidden = flags.some((x) => x === "--hidden" || /^-[a-zA-Z]*(\.|uu)/.test(x));
    if (!hidden && !flags.some((x) => x === "--no-ignore" || /^-[a-zA-Z]*u/.test(x))) return null;
  } else return null;
  const positional2 = [];
  const excluded = { files: [], dirs: [], paths: [] };
  let patternGiven = a.some((x) => /^(--regexp|--file)(=|$)/.test(x) || /^-[a-zA-Z]*[ef]/.test(x));
  for (let i = 1; i < a.length; i++) {
    const x = a[i];
    const [opt, glued] = x.startsWith("--") && x.includes("=") ? [x.slice(0, x.indexOf("=")), x.slice(x.indexOf("=") + 1)] : [x, void 0];
    if (x.startsWith("-") && x !== "-") {
      const value = glued ?? (SEARCH_VALUE.has(opt) ? a[++i] : void 0);
      if (value === void 0) continue;
      if (opt === "--exclude") excluded.files.push(globRegex(value, true, false));
      if (opt === "--exclude-dir") excluded.dirs.push(globRegex(value, true, false));
      if ((opt === "-g" || opt === "--glob" || opt === "--iglob") && value.startsWith("!")) excluded.paths.push(globRegex(value.slice(1).replace(/^\*\*\//, ""), true, opt === "--iglob"));
      continue;
    }
    if (!patternGiven) patternGiven = true;
    else positional2.push(x);
  }
  return { dirs: positional2.length ? positional2 : ["."], hidden, excluded };
}
function secretsBelow(dir, hidden, excluded, ctx) {
  const queue = [dir];
  let seen = 0;
  const left = (name, rel2, isDir4) => (isDir4 ? excluded.dirs : excluded.files).some((re) => re.test(name)) || excluded.paths.some((re) => re.test(name) || re.test(rel2.replaceAll("\\", "/")));
  while (queue.length) {
    const current = queue.shift();
    let entries;
    try {
      entries = readdirSync8(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (++seen > WALK_LIMIT) return null;
      if (seen % 500 === 0) ctx.check();
      if (!hidden && e.name.startsWith(".")) continue;
      const full = path19.join(current, e.name);
      if (left(e.name, path19.relative(dir, full), e.isDirectory())) continue;
      if (e.isDirectory()) {
        if (e.name !== ".git" && !HEAVY.has(e.name)) queue.push(full);
      } else if (isSecretPath(full, ctx.config.extraSecretPaths, ctx.root, ctx.home)) return full;
    }
  }
  return null;
}
function shellVerdicts(ctx, c) {
  const out2 = [];
  const cwd = c.cwd ?? ctx.event.cwd;
  const secret = (p) => {
    const abs = resolvePath(p, cwd, ctx.home);
    return isSecretPath(abs, ctx.config.extraSecretPaths, ctx.root, ctx.home) ? abs : null;
  };
  for (const r of c.redirects) {
    if (/^&(\d+|-)$/.test(r.target)) continue;
    const abs = secret(r.target.replace(/^&/, ""));
    if (abs) out2.push(r.op.includes(">") ? writeVerdict(ctx, abs) : readVerdict(ctx, abs));
  }
  for (const p of sentFiles(c)) {
    const abs = secret(p);
    if (abs) out2.push(readVerdict(ctx, abs));
  }
  const search = recursiveSearch(c);
  for (const d of search?.dirs ?? []) {
    if (!isKnown(d)) continue;
    const found = secretsBelow(resolvePath(d, cwd, ctx.home), search.hidden, search.excluded, ctx);
    if (found) {
      out2.push({
        decision: ctx.config.secretFileRead,
        category: "secret-file",
        reason: `this search would go through ${shown2(ctx, found)}, a secret file, and print its values`,
        alternative: "leave it out: --exclude='.env*' for grep, -g '!.env*' for rg"
      });
    }
  }
  const named = mentionedPaths(c);
  if (named === null) out2.push({ decision: "ask", category: "secret-file", reason: "the script names too many paths for the guard to check for secret files" });
  for (const p of named ?? []) {
    const abs = secret(p);
    if (abs) out2.push({ decision: "ask", category: "secret-file", reason: `the script names ${shown2(ctx, abs)}, a secret file; it may read it`, alternative: "use .env.example, or load the values without printing them" });
  }
  const name = cmdName(c.argv[0]);
  const sub = name === "git" ? c.argv.findIndex((x, i) => i > 0 && !x.startsWith("-") && c.argv[i - 1] !== "-c") : -1;
  if (sub > 0 && ["show", "cat-file"].includes(c.argv[sub])) {
    for (const x of c.argv.slice(sub + 1)) {
      const m = /^(?:[^-:][^:]*)?:(?:[0-3]:)?([\s\S]+)$/.exec(x);
      const abs = m ? secret(m[1]) : null;
      if (abs) out2.push(readVerdict(ctx, abs));
    }
  }
  const editsInPlace = name === "sed" && c.argv.some((x) => /^-[a-zA-Z]*i/.test(x) || x.startsWith("--in-place"));
  if (!READERS.has(name) && !COPIERS2.has(name) && !WRITERS.has(name)) return out2;
  for (const { arg, last, key: key2 } of fileArgs(c, name)) {
    const abs = secret(arg);
    if (!abs) continue;
    const writes = WRITERS.has(name) || editsInPlace || COPIERS2.has(name) && last || name === "dd" && key2 === "of";
    out2.push(writes ? writeVerdict(ctx, abs) : readVerdict(ctx, abs));
  }
  return out2;
}
function secretFileRule(ctx) {
  const { event } = ctx;
  if (event.tool === "shell") return ctx.commands.flatMap((c) => shellVerdicts(ctx, c));
  if (event.path === void 0) return [];
  const abs = resolvePath(event.path, event.cwd, ctx.home);
  if (!isSecretPath(abs, ctx.config.extraSecretPaths, ctx.root, ctx.home)) return [];
  if (event.tool === "read") return [readVerdict(ctx, abs)];
  if (event.tool === "write" || event.tool === "edit") return [writeVerdict(ctx, abs)];
  return [];
}

// tools/src/guard/rules/guard-config.ts
var READERS2 = /* @__PURE__ */ new Set([
  "cat",
  "less",
  "more",
  "head",
  "tail",
  "type",
  "gc",
  "get-content",
  "grep",
  "egrep",
  "fgrep",
  "rg",
  "select-string",
  "sls",
  "bat",
  "nl",
  "wc",
  "diff",
  "jq",
  "ls",
  "dir",
  "gci",
  "get-childitem",
  "get-item",
  "gi",
  "stat",
  "file",
  "test-path"
]);
var GIT_READS = /* @__PURE__ */ new Set(["add", "stage", "diff", "log", "show", "status", "blame", "ls-files", "grep", "commit"]);
var MOVERS = /* @__PURE__ */ new Set(["mv", "move", "move-item", "mi", "ren", "rename", "rename-item", "rni"]);
var INLINE = /^(-[a-zA-Z]*[ecpEr][\s\S]*|--(eval|print|command)(=[\s\S]*)?)$/;
var valueOf = (w) => /^-{1,2}[\w-]+[=:]([\s\S]+)$/.exec(w)?.[1] ?? /^[a-z]+=([\s\S]+)$/.exec(w)?.[1] ?? w;
var SKIP2 = {
  decision: "ask",
  category: "guard-config",
  reason: "this skips the pre-commit hook that checks for secrets",
  alternative: "fix what the hook reports instead of skipping it"
};
function guardConfigRule(ctx) {
  const hookFile = path20.join(ctx.root, ".git", "hooks", "pre-commit");
  const wiring = [
    path20.join(ctx.root, ".claude", "settings.json"),
    path20.join(ctx.root, ".claude", "settings.local.json"),
    path20.join(ctx.root, ".opencode", "plugins", "harness.js"),
    path20.join(ctx.root, "opencode.json"),
    path20.join(ctx.root, "opencode.jsonc")
  ];
  const guarded = [path20.join(ctx.root, ".harness", "overrides.json"), path20.join(ctx.root, ".harness", "bin"), hookFile, ...wiring];
  const resolve = (p, cwd) => isKnown(p) && !p.startsWith(FOUND) && (cwd !== null || path20.isAbsolute(p)) ? resolvePath(p, cwd ?? ctx.event.cwd, ctx.home) : null;
  const hit = (abs, whole) => abs !== null && guarded.some((g) => isInside(abs, g) || whole && g !== hookFile && isInside(g, abs));
  const named = (abs) => abs !== null && (abs.includes("~") ? hit(abs, false) : guarded.some((g) => within2(abs, g)));
  const verdict5 = (abs) => isInside(abs, hookFile) ? { ...SKIP2, reason: "this changes the pre-commit hook that checks for secrets" } : wiring.some((w) => isInside(abs, w)) ? {
    decision: "ask",
    category: "guard-config",
    reason: `${path20.relative(ctx.root, abs)} connects the guard to the agent; a change there can turn the guard off`,
    alternative: "ask the person to make this change, or confirm it"
  } : {
    decision: "ask",
    category: "guard-config",
    reason: `${path20.relative(ctx.root, abs) || abs} is the guard's own configuration or program; the person changes it`,
    alternative: "ask the person to make this change, or confirm it"
  };
  const { event } = ctx;
  if (event.tool === "write" || event.tool === "edit") {
    const abs = event.path === void 0 ? null : resolve(event.path, event.cwd);
    return hit(abs, false) ? [verdict5(abs)] : [];
  }
  if (event.tool !== "shell") return [];
  const runsGuard = (c) => {
    const at = interpreterAt(c);
    if (at < 0) return false;
    const args = c.argv.slice(at + 1);
    const script = args.find((x) => !x.startsWith("-"));
    return !args.some((x) => INLINE.test(x)) && script !== void 0 && hit(resolve(script, c.cwd), false);
  };
  const out2 = [];
  for (const c of ctx.commands) {
    if (skipsHook(c)) out2.push(SKIP2);
    const name = cmdName(c.argv[0]);
    const sub = c.argv.slice(1).find((x) => !x.startsWith("-"));
    const reads = READERS2.has(name) || name === "git" && GIT_READS.has(sub ?? "") || runsGuard(c);
    const into = c.redirects.filter((r) => r.op.includes(">")).map((r) => r.target);
    const words = reads ? [] : [...c.argv.slice(1).map(valueOf), ...mentionedPaths(c) ?? []];
    const over = [...deletion(c)?.targets ?? [], ...MOVERS.has(name) ? c.argv.slice(1).filter((x) => !x.startsWith("-")) : []];
    for (const p of new Set(words)) {
      const abs = resolve(p, c.cwd);
      if (named(abs)) out2.push(verdict5(abs));
    }
    for (const [list, whole] of [[new Set(into), false], [new Set(over), true]]) {
      for (const p of list) {
        ctx.check();
        const abs = resolve(p, c.cwd);
        if (hit(abs, whole)) out2.push(verdict5(abs));
      }
    }
  }
  return out2;
}

// tools/src/guard/rules/production.ts
var CLIENTS = /* @__PURE__ */ new Set(["psql", "mysql", "mariadb", "mongosh", "mongo", "redis-cli"]);
var MAX_TEXT = 1e4;
function touchesData(argv) {
  const name = cmdName(argv[0] ?? "");
  if (CLIENTS.has(name)) return true;
  if (name === "prisma") return argv[1] === "migrate" || argv[1] === "db" && argv[2] === "push";
  if (name === "knex") return argv[1]?.startsWith("migrate") ?? false;
  return false;
}
function verdict3(c, ctx) {
  if (!touchesData(c.argv)) return null;
  const text2 = [...Object.entries(c.env).map(([k, v]) => `${k}=${v}`), ...c.argv].join(" ").slice(0, MAX_TEXT);
  for (const p of ctx.config.productionPatterns) {
    let re;
    try {
      re = new RegExp(p);
    } catch {
      continue;
    }
    if (re.test(text2)) {
      return {
        decision: "ask",
        category: "production",
        reason: `${cmdName(c.argv[0])} looks aimed at production (matches ${p})`,
        alternative: "run it against a local or staging database, or confirm this is intended"
      };
    }
  }
  return null;
}
function productionRule(ctx) {
  if (ctx.event.tool !== "shell" || !ctx.config.productionPatterns.length) return [];
  return ctx.commands.flatMap((c) => verdict3(c, ctx) ?? []);
}

// tools/src/guard/rules/secret-content.ts
var WRITERS2 = /* @__PURE__ */ new Set(["tee", "set-content", "sc", "add-content", "ac", "out-file", "new-item", "ni"]);
var SCRIPTED = /* @__PURE__ */ new Set(["python", "python3", "py", "node", "deno", "bun", "perl", "ruby", "php", "sed", "awk", "gawk"]);
function verdict4(kind, line, where) {
  return {
    decision: "deny",
    category: "secret-content",
    reason: `${where} would hold what looks like a ${kind} credential (line ${line})`,
    alternative: "keep the value in the secret manager or an ignored .env and refer to it by name"
  };
}
function writesFile(c) {
  const name = cmdName(c.argv[0]);
  return WRITERS2.has(name) || SCRIPTED.has(name) || c.redirects.some((r) => r.op.includes(">") && !/^&(\d+|-)$/.test(r.target));
}
function secretContentRule(ctx) {
  const { event } = ctx;
  if (event.tool === "write" || event.tool === "edit") {
    const found = findCredential(event.content ?? "");
    return found ? [verdict4(found.kind, found.line, "the text to write")] : [];
  }
  if (event.tool !== "shell") return [];
  const out2 = [];
  for (const c of ctx.commands) {
    if (!writesFile(c)) continue;
    const found = findCredential([c.argv.slice(1).join(" "), c.stdin ?? "", c.piped ?? ""].join("\n"));
    if (found) out2.push(verdict4(found.kind, found.line, "the file this command writes"));
  }
  return out2;
}

// tools/src/guard/judge.ts
var MAX_COMMAND = 1e5;
var ANALYSIS_MS = 2e3;
var GIT_TOTAL_MS = 5e3;
var OverBudget = class extends Error {
};
var Budget = class {
  deadline;
  waited = 0;
  gitTotal;
  constructor(deadline = Date.now() + ANALYSIS_MS, gitTotal = GIT_TOTAL_MS) {
    this.deadline = deadline;
    this.gitTotal = gitTotal;
  }
  check() {
    if (Date.now() > this.deadline) throw new OverBudget("analysis took too long");
  }
  wait(fn) {
    const start = Date.now();
    try {
      return fn();
    } finally {
      const spent = Date.now() - start;
      this.deadline += spent;
      this.waited += spent;
      if (this.waited > this.gitTotal) throw new OverBudget("git took too long to answer");
    }
  }
};
function looksDestructive(text2) {
  for (const segment of text2.split(/[\n;|&]/)) {
    const words = segment.toLowerCase().split(/[\s()`{}'"$]+/).filter(Boolean).map((w) => w.startsWith("-") || w.startsWith("+") || /^\/[a-z]$/.test(w) ? w : w.replace(/^.*[\\/]/, "").replace(/\.exe$/, ""));
    let verb = "";
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (w.startsWith("mkfs") || w === "format" && /^[a-z]:/.test(words[i + 1] ?? "")) return true;
      if (w === "rm") verb = "rm";
      else if (w === "remove-item") verb = "remove-item";
      else if (w === "rd" || w === "rmdir" || w === "del" || w === "erase") verb = "rd";
      else if (verb === "rd" && w === "/s") return true;
      else if (w === "git" && (words[i + 1] === "push" || words[i + 1] === "clean")) verb = words[++i];
      else if (verb === "rm" && /^-[a-z]*r/.test(w)) return true;
      else if (verb === "remove-item" && w.startsWith("-recurse")) return true;
      else if (verb === "push" && (w === "--force" || w.startsWith("--force-") || w === "-f" || w.startsWith("+"))) return true;
      else if (verb === "clean" && /^-[a-z]*f[a-z]*f/.test(w)) return true;
    }
  }
  return false;
}
function unreadable(text2, why) {
  const destructive = looksDestructive(text2.slice(0, 2 * MAX_COMMAND));
  return {
    decision: destructive ? "deny" : "ask",
    category: "unreadable",
    reason: `${why}${destructive ? "; it also looks destructive" : ""}`,
    alternative: "split it into smaller, plain commands the guard can read"
  };
}
function projectRoot(event) {
  if (event.root) return event.root;
  for (let dir = event.cwd; ; dir = path21.dirname(dir)) {
    if (existsSync5(path21.join(dir, ".git")) || existsSync5(path21.join(dir, ".harness"))) return dir;
    if (path21.dirname(dir) === dir) return event.cwd;
  }
}
var RULES = [secretFileRule, secretContentRule, destructiveRule, findRule, scopeRule, guardConfigRule, productionRule, gitRule, shareRule];
function judge(event, config, budget = new Budget(), home = os2.homedir()) {
  if (event.command !== void 0 && event.command.length > MAX_COMMAND) return unreadable(event.command, "the command is over the size cap");
  try {
    budget.check();
    const found = [OK];
    let commands2 = [];
    const root = projectRoot(event);
    if (event.tool === "shell" && event.command !== void 0) {
      const parsed = simpleCommands(event.command, event.cwd, event.shell ?? "posix", { home, check: () => budget.check() });
      commands2 = parsed.commands;
      if (parsed.unreadable) found.push(unreadable(event.command, `the guard could not read part of the command: ${parsed.unreadable}`));
    }
    const ctx = { event, config, root, home, commands: commands2, check: () => budget.check(), wait: (fn) => budget.wait(fn) };
    for (const rule of RULES) {
      budget.check();
      found.push(...rule(ctx));
    }
    return strongest(found);
  } catch (e) {
    if (e instanceof OverBudget) return unreadable(event.command ?? "", e.message);
    throw e;
  }
}

// tools/src/commands/guard.ts
var FAIL_OPEN_TOOLS = /* @__PURE__ */ new Set(["read", "other"]);
function readStdin() {
  try {
    return readFileSync8(0, "utf8");
  } catch {
    return "";
  }
}
function unreadable2(error, tool) {
  if (tool && FAIL_OPEN_TOOLS.has(tool)) return { decision: "allow", category: "unreadable", reason: `warning: ${error}; allowed because the tool cannot change files` };
  return { decision: "deny", category: "unreadable", reason: `the guard could not read the event: ${error}`, alternative: "run harness doctor to check the adapter" };
}
function judgeOne(event) {
  if (process.env.HARNESS_GUARD_TEST_CRASH === "1") throw new Error("simulated crash");
  const { config, warning } = loadGuardConfig(projectRoot(event));
  const v = judge(event, config);
  return warning ? { ...v, reason: `${v.reason} (${warning})` } : v;
}
function decide(input) {
  const event = parseEvent(input);
  return "error" in event ? unreadable2(event.error, event.tool) : judgeOne(event);
}
function decideNative(agent, input) {
  let raw;
  try {
    raw = JSON.parse(input);
  } catch {
    return unreadable2("the event is not valid JSON");
  }
  const n = ADAPTERS[agent].from(raw, process.env);
  if ("skip" in n) return OK;
  if ("error" in n) return unreadable2(n.error, n.tool);
  return strongest(n.events.map(judgeOne));
}
function guardCommand(flags, io) {
  const agent = flags.agent;
  if (agent !== void 0 && !AGENTS.includes(agent)) throw new UsageError(`unknown agent "${agent}"; use ${AGENTS.join(" or ")}`);
  let v;
  try {
    v = agent ? decideNative(agent, readStdin()) : decide(readStdin());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    v = { decision: "deny", category: "unreadable", reason: `the guard failed: ${msg.split("\n")[0]}; run harness doctor`, alternative: "run harness doctor and retry" };
  }
  if (agent) {
    io.out(ADAPTERS[agent].answer(v));
    return 0;
  }
  io.out(JSON.stringify(v) + "\n");
  return v.decision === "deny" ? 2 : 0;
}

// tools/src/hook/gitleaks.ts
import { spawnSync as spawnSync4 } from "node:child_process";
var GITLEAKS_MS = 6e4;
var FOUND_EXIT = 99;
function findGitleaks() {
  const r = spawnSync4("gitleaks", ["version"], { timeout: 5e3, windowsHide: true, stdio: "ignore" });
  return r.status === 0 ? ["gitleaks"] : null;
}
function runGitleaks(argv, cwd) {
  const [cmd, ...pre] = argv;
  const r = spawnSync4(cmd, [...pre, "git", "--pre-commit", "--staged", "--redact", "--no-banner", "--log-level", "warn", "--exit-code", String(FOUND_EXIT)], {
    cwd,
    timeout: GITLEAKS_MS,
    windowsHide: true,
    stdio: ["ignore", "inherit", "inherit"]
  });
  if (r.status === FOUND_EXIT) return { found: true };
  if (r.status === 0) return { found: false };
  const why = r.error ? r.error.message : r.signal ? `stopped by ${r.signal}` : r.status === 1 ? "exit code 1 (older than 8.19, or an invalid .gitleaks.toml)" : `exit code ${r.status}`;
  return { found: false, note: `gitleaks could not run: ${why}` };
}

// tools/src/hook/pre-commit.ts
import { spawnSync as spawnSync6 } from "node:child_process";
import { existsSync as existsSync6 } from "node:fs";
import os3 from "node:os";
import path22 from "node:path";

// tools/src/hook/patterns.ts
import { spawnSync as spawnSync5 } from "node:child_process";
var JS = ["js", "jsx", "ts", "tsx", "mjs", "cjs", "mts", "cts", "vue", "svelte", "astro"];
var PY = ["py"];
var PATTERNS3 = [
  { langs: JS, re: /\.(inner|outer)HTML\s*=(?!=)|\binsertAdjacentHTML\s*\(|\bdocument\.write(ln)?\s*\(/, why: "HTML built from text: set textContent, or escape what comes from outside" },
  { langs: JS, re: /\bdangerouslySet(InnerHTML)\b|\bv-html\s*=|\{@html\b/, why: "raw HTML in a template: sanitize it first or render it as text" },
  { langs: [...JS, ...PY, "php", "rb"], re: /(^|[^\w.$])eval\s*\(|\bnew\s+Function\s*\(/, why: "eval runs text as code: parse the data instead" },
  { langs: JS, re: /\bexec(Sync)?\s*\(\s*(`[^`]*\$\{|[^,)]*\+)/, why: "a shell command built from text: use execFile or spawn with a list of arguments" },
  { langs: JS, re: /\bshell\s*:\s*true\b/, why: "shell: true lets text from outside become commands: pass a list of arguments" },
  { langs: JS, re: /\brejectUnauthorized\s*:\s*false\b|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0/, why: "TLS certificate checks turned off" },
  { langs: PY, re: /\b(c?pickle|marshal|dill|shelve)\.(loads?|open)\s*\(/, why: "unpickling runs code: never on data from outside; use JSON" },
  { langs: PY, re: /\byaml\.(load|load_all|unsafe_load)\s*\((?![^)]*SafeLoader)/, why: "yaml.load can build any object: use yaml.safe_load" },
  { langs: PY, re: /\btorch\.load\s*\((?![^)]*weights_only\s*=\s*True)/, why: "torch.load unpickles: pass weights_only=True" },
  { langs: PY, re: /\bshell\s*=\s*True\b|\bos\.(system|popen)\s*\(/, why: "a command run through the shell: use subprocess with a list and no shell" },
  { langs: PY, re: /\bverify\s*=\s*False\b/, why: "TLS certificate checks turned off" },
  { langs: [...PY, ...JS, "php", "rb", "go", "java", "kt", "cs"], re: /\b(execute|executemany|query|raw|exec_query|find_by_sql)\s*\(\s*(f["']|`[^`]*\$\{|["'][^"']*["']\s*(\+|%(?!s?["']))|["'][^"']*["']\s*\.\s*format\s*\()/i, why: "SQL built from text: pass the values as query parameters" },
  { langs: ["go"], re: /\bInsecureSkipVerify\s*:\s*true\b/, why: "TLS certificate checks turned off" },
  { langs: ["php"], re: /\bunserialize\s*\(/, why: "unserialize on data from outside can run code: use json_decode" },
  { langs: ["rb"], re: /\bMarshal\.load\s*\(|\bYAML\.load\s*\(/, why: "deserializing data from outside can run code: use JSON or YAML.safe_load" },
  { langs: ["java", "kt"], re: /\bnew\s+ObjectInputStream\s*\(/, why: "Java deserialization of data from outside can run code: use a data format such as JSON" }
];
var SKIP3 = [/(^|\/)(tests?|__tests__|spec|specs|fixtures?|testdata|e2e|vendor|node_modules|dist|build)\//i, /\.(test|spec)\.[^/]+$/i, /(^|\/)test_[^/]*\.py$/i, /\.min\.[^/]+$/i];
var MAX_LINE = 2e3;
var MAX_SHOWN = 8;
function ext(file) {
  const m = /\.([^./]+)$/.exec(file);
  return m ? m[1].toLowerCase() : "";
}
function scanAdded(lines) {
  const out2 = [];
  for (const a of lines) {
    if (a.text.length > MAX_LINE || SKIP3.some((s) => s.test(a.file))) continue;
    const e = ext(a.file);
    const hit = PATTERNS3.find((p) => p.langs.includes(e) && p.re.test(a.text));
    if (hit) out2.push({ ...a, why: hit.why });
  }
  return out2;
}
function addedLines2(root) {
  const r = spawnSync5("git", ["-c", "core.fsmonitor=false", "-c", "core.quotepath=off", "diff", "--cached", "-U0", "--no-color", "--no-ext-diff", "--no-textconv", "--diff-filter=ACMR"], { cwd: root, encoding: "utf8", windowsHide: true, timeout: 3e4, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) return [];
  const out2 = [];
  let file = "";
  let line = 0;
  for (const raw of r.stdout.split("\n")) {
    if (raw.startsWith("+++ ")) {
      file = raw.startsWith("+++ b/") ? raw.slice(6) : "";
      continue;
    }
    const hunk = /^@@ -\S+ \+(\d+)/.exec(raw);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (raw.startsWith("+") && file) out2.push({ file, line: line++, text: raw.slice(1).replace(/\r$/, "") });
  }
  return out2;
}
function scanStaged(root) {
  return scanAdded(addedLines2(root));
}
function warnings(found) {
  const lines = found.slice(0, MAX_SHOWN).map((f) => `harness: warning: ${f.file}:${f.line} ${f.why}`);
  if (found.length > MAX_SHOWN) lines.push(`harness: warning: and ${found.length - MAX_SHOWN} more risky lines in the staged changes`);
  return lines;
}

// tools/src/hook/pre-commit.ts
var HOOK_ANALYSIS_MS = 1e4;
var HOOK_GIT_MS = 3e4;
function report(v) {
  if (v.decision !== "allow" && v.category === "unreadable") {
    return { code: 1, lines: [`harness: the commit could not be checked (${v.reason}); split it into smaller commits, or commit with --no-verify at your own risk`] };
  }
  if (v.decision === "deny") return { code: 1, lines: [`harness: ${v.reason}${v.alternative ? ` \u2014 ${v.alternative}` : ""}`] };
  if (v.decision === "ask") return { code: 0, lines: [`harness: warning: ${v.reason}`] };
  return { code: 0, lines: [] };
}
function riskyWarnings(root) {
  try {
    return warnings(scanStaged(root));
  } catch {
    return ["harness: warning: the risky-pattern check could not run"];
  }
}
var MANIFEST2 = ".harness/manifest.json";
function configRoot(top) {
  if (existsSync6(path22.join(top, MANIFEST2))) return top;
  const parent = path22.dirname(top);
  return parent !== top && existsSync6(path22.join(parent, MANIFEST2)) ? parent : top;
}
function preCommit(cwd, opts) {
  try {
    const top = spawnSync6("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", windowsHide: true });
    if (top.status !== 0) return { code: 1, lines: ["harness: not inside a git repository, so the commit cannot be checked"] };
    const root = top.stdout.trim();
    const verdict5 = judge({ tool: "shell", shell: "posix", command: "git commit", cwd: root, root }, loadGuardConfig(configRoot(root)).config, new Budget(Date.now() + HOOK_ANALYSIS_MS, HOOK_GIT_MS), opts.home ?? os3.homedir());
    const out2 = report(verdict5);
    if (out2.code === 1) return out2;
    out2.lines.push(...riskyWarnings(root));
    if (!opts.gitleaks) return out2;
    const leaks = runGitleaks(opts.gitleaks, root);
    if (leaks.found) return { code: 1, lines: [...out2.lines, "harness: gitleaks found a secret in the staged changes; remove it, or add it to .gitleaksignore if it is a false positive"] };
    if (leaks.note) return { code: 0, lines: [...out2.lines, `harness: warning: ${leaks.note}`] };
    return out2;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { code: 1, lines: [`harness: the hook failed: ${msg.split("\n")[0]}; run harness doctor`] };
  }
}

// tools/src/commands/hook.ts
function hookCommand(flags, io) {
  if (flags.args[0] !== "pre-commit") throw new UsageError("usage: harness hook pre-commit");
  const r = preCommit(flags.cwd, { gitleaks: findGitleaks() });
  for (const line of r.lines) io.err(line + "\n");
  return r.code;
}

// tools/src/commands/doctor.ts
import { spawnSync as spawnSync7 } from "node:child_process";

// tools/src/context/map.ts
import path23 from "node:path";
var plain = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
var COLUMNS = { area: ["area"], code: ["code", "codigo"], adr: ["adr"] };
var LINK = /\[[^\]]*\]\(([^)]*)\)/g;
function cells(line) {
  const t = line.trim();
  if (!t.startsWith("|")) return null;
  return t.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}
var skipped = (p) => p === "" || p === "-" || /^[a-z][a-z0-9+.-]*:\/\//i.test(p) || /[*?[{]/.test(p);
function paths(cell, dir, adr) {
  const out2 = [];
  for (const [, raw] of cell.matchAll(LINK)) {
    const target = toPosix(raw.trim().split(/\s+/)[0] ?? "").replace(/#.*$/, "");
    if (skipped(target)) continue;
    out2.push(/^\/|^[A-Za-z]:/.test(target) ? target : path23.posix.join(dir, target));
  }
  for (const raw of cell.replace(LINK, "").split(",")) {
    const p = toPosix(raw.trim().replaceAll("`", ""));
    if (skipped(p) || adr && !p.includes("/") && !p.endsWith(".md")) continue;
    out2.push(p);
  }
  return out2;
}
function existsWithCase(root, rel2) {
  const parts = path23.posix.normalize(rel2).split("/").filter((s) => s !== "" && s !== ".");
  return parts.every((_, i) => existsExact(root, parts.slice(0, i + 1).join("/")));
}
function mapProblems(root, dir) {
  const base = dir.replace(/\/+$/, "");
  const file = `${base}/map.md`;
  const text2 = readText(root, file);
  if (text2 === null) return [];
  const lines = text2.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    const head = cells(lines[i]);
    if (!head) continue;
    const at = (names2) => head.findIndex((h) => names2.includes(plain(h)));
    const col = { area: at(COLUMNS.area), code: at(COLUMNS.code), adr: at(COLUMNS.adr) };
    if (col.area < 0 || col.code < 0 || col.adr < 0) continue;
    const problems = [];
    for (const line of lines.slice(i + 2)) {
      const row = cells(line);
      if (!row) break;
      const area = row[col.area] ?? "";
      for (const [c, adr] of [[col.code, false], [col.adr, true]]) {
        for (const p of paths(row[c] ?? "", base, adr)) {
          if (!isInsideRelative(p)) problems.push(`${file}: area "${area}" points outside the project (${p}) \u2014 use a path inside the repository`);
          else if (!existsWithCase(root, p)) problems.push(`${file}: area "${area}" lists ${p}, which does not exist \u2014 fix the path or remove it from the map`);
        }
      }
    }
    return problems;
  }
  return [`${file} has no Area | Code | ADR table \u2014 see the map template in .harness/guides/context`];
}

// tools/src/memory/learnings.ts
import { readdirSync as readdirSync9 } from "node:fs";
import path24 from "node:path";
var LEARNINGS = ".harness/proposals/learnings";
var STALE_DAYS = 30;
var DAY_MS = 864e5;
function dateOf(name) {
  const m = /^(\d{4})-(\d{2})-(\d{2})-.+\.md$/.exec(name);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d ? t : null;
}
function staleLearnings(root, now = Date.now()) {
  let names2;
  try {
    names2 = readdirSync9(path24.join(root, LEARNINGS));
  } catch {
    return 0;
  }
  return names2.filter((n) => {
    const t = dateOf(n);
    return t !== null && Math.floor((now - t) / DAY_MS) > STALE_DAYS;
  }).length;
}

// tools/src/commands/doctor.ts
var BUNDLE3 = ".harness/bin/harness.mjs";
var MIN_NODE = [22, 18];
var BRIEF_MAP_LINES = 5;
function nodeTooOld(version) {
  const [major, minor] = version.split(".").map(Number);
  return major < MIN_NODE[0] || major === MIN_NODE[0] && minor < MIN_NODE[1];
}
function opencodeVersion() {
  const r = spawnSync7("opencode", ["--version"], { encoding: "utf8", timeout: 5e3, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
  if (r.status !== 0) return null;
  return /(\d+\.\d+\.\d+)/.exec(r.stdout)?.[1] ?? null;
}
function checks(root, brief) {
  const problems = [];
  if (nodeTooOld(process.versions.node)) problems.push(`Node ${process.versions.node} is older than ${MIN_NODE.join(".")} \u2014 install Node ${MIN_NODE.join(".")} or later`);
  const m = readJson(root, ".harness/manifest.json");
  if (!m.ok || !Array.isArray(m.value?.files)) {
    problems.push(".harness/manifest.json is missing or unreadable \u2014 run harness init again from the harness repository");
    return problems;
  }
  for (const name of Array.isArray(m.value.modules) ? m.value.modules : []) {
    const known = typeof name === "string" && MODULE_NAME.test(name) && (BUILT_MODULES === null || BUILT_MODULES.includes(name));
    if (!known) problems.push(`unknown module ${JSON.stringify(name)} in the manifest \u2014 run harness init again from the harness repository`);
  }
  const files = [...m.value.files].sort((a, b) => a.path === BUNDLE3 ? -1 : b.path === BUNDLE3 ? 1 : 0);
  for (const f of files) {
    const text2 = readText(root, f.path);
    if (text2 === null) problems.push(`${f.path} is missing \u2014 run harness init again`);
    else if (sha256(text2) !== f.sha256) problems.push(`${f.path} differs from the installed copy \u2014 review the change, or run harness init again`);
  }
  const agents = Array.isArray(m.value.agents) ? m.value.agents : [];
  if (agents.includes("claude-code")) {
    const s = readJson(root, SETTINGS);
    const settings = s.ok ? s.value : null;
    if (!s.ok && s.reason === "invalid") problems.push(`${SETTINGS} is not valid JSON, so Claude Code runs no harness hook \u2014 fix the file, then run harness init again`);
    else if (!hasHarnessHook(settings, "PreToolUse")) problems.push(`${SETTINGS} does not run the guard \u2014 run harness init again`);
    if (s.ok && !hasHarnessHook(settings, "SessionStart")) problems.push(`${SETTINGS} does not run harness doctor at session start \u2014 run harness init again`);
    if (s.ok && !hasHarnessHook(settings, "Stop")) problems.push(`${SETTINGS} does not run harness stop at turn end \u2014 run harness init again`);
  }
  if (agents.includes("opencode") && !brief) {
    const v = opencodeVersion();
    if (v?.startsWith("1.")) problems.push(`OpenCode ${v} is V1, which the harness plugin does not support yet \u2014 use OpenCode V2 (ADR 0007)`);
  }
  const hook = hookRuns(root);
  if (!hook.ok) problems.push(`the pre-commit hook does not run the harness check \u2014 run harness init again, or add the line it proposes to ${hook.file}`);
  for (const part of ownGitParts(root)) {
    const h = hookRuns(root, part);
    if (!h.ok) problems.push(`commits in part ${part} do not run the harness check \u2014 run harness init again, or add the line it proposes to ${h.file}`);
  }
  problems.push(...staleParts(root, () => detectProfile(root)));
  const ctx = contextDir(root);
  if (!ctx.ok) problems.push(ctx.reason);
  else {
    const map = mapProblems(root, ctx.dir);
    const shown3 = brief && map.length > BRIEF_MAP_LINES ? map.slice(0, BRIEF_MAP_LINES) : map;
    problems.push(...shown3);
    if (shown3.length < map.length) problems.push(`and ${map.length - shown3.length} more map problems \u2014 run harness doctor to see them all`);
  }
  const stale = staleLearnings(root);
  if (stale === 1) problems.push(`1 learning proposal older than ${STALE_DAYS} days in ${LEARNINGS}/ \u2014 review it: accept it as a rule or an ADR, or delete it`);
  else if (stale > 1) problems.push(`${stale} learning proposals older than ${STALE_DAYS} days in ${LEARNINGS}/ \u2014 review them: accept each as a rule or an ADR, or delete it`);
  return problems;
}
function doctorCommand(flags, io) {
  const problems = checks(flags.cwd, flags.brief);
  for (const p of problems) io.out(`harness: ${p}
`);
  if (!problems.length && !flags.brief) io.out("harness doctor: all checks pass\n");
  return problems.length && !flags.brief ? 3 : 0;
}

// tools/src/install/remove.ts
import { readdirSync as readdirSync10, rmSync as rmSync3 } from "node:fs";
import path25 from "node:path";
var AGENTS_START = "<!-- harness:start -->";
var AGENTS_END = "<!-- harness:end -->";
var LEARNINGS2 = `${PROPOSALS}/learnings`;
var PERSON = [".harness/overrides.json", ".harness/task.md", ".harness/handoffs", LEARNINGS2];
var FOLDERS = [".harness/bin", PROPOSALS, ".harness", ".claude/skills", ".claude", ".opencode/plugins", ".opencode"];
function withoutAgentsBlock(text2) {
  const start = text2.indexOf(AGENTS_START);
  const end = start === -1 ? -1 : text2.indexOf(AGENTS_END, start);
  if (start === -1 || end === -1) return text2;
  const out2 = text2.slice(0, start) + text2.slice(end + AGENTS_END.length).replace(/^\r?\n/, "");
  return out2.trim() === "" ? null : out2;
}
function planRemove(target) {
  const m = readJson(target, MANIFEST);
  if (!m.ok || !Array.isArray(m.value?.files)) return null;
  const ops = [];
  const orphans = Array.isArray(m.value.orphans) ? m.value.orphans : [];
  for (const f of [...m.value.files, ...orphans]) {
    if (!isInstallPath(f?.path)) {
      ops.push({ path: String(f?.path), action: "manual", note: "the manifest lists it, but init never writes there; left alone" });
      continue;
    }
    if (f.path === "AGENTS.md") continue;
    const text2 = readText(target, f.path);
    if (text2 === null) continue;
    if (sha256(text2) === f.sha256) ops.push({ path: f.path, action: "delete" });
    else ops.push({ path: f.path, action: "kept", note: "you changed it; delete it by hand if you no longer need it" });
  }
  const agents = readText(target, "AGENTS.md", true);
  if (agents !== null) {
    const next = withoutAgentsBlock(agents);
    if (next === null) ops.push({ path: "AGENTS.md", action: "delete" });
    else if (next !== agents) ops.push({ path: "AGENTS.md", action: "rewrite", content: next });
  }
  const gi = readText(target, ".gitignore", true);
  if (gi !== null) {
    const next = removeGitignoreBlock(gi);
    if (next === null) ops.push({ path: ".gitignore", action: "delete" });
    else if (next !== gi) ops.push({ path: ".gitignore", action: "rewrite", content: next });
  }
  const s = readJson(target, SETTINGS);
  if (s.ok && typeof s.value === "object" && s.value !== null && !Array.isArray(s.value)) {
    const next = removeHarnessHooks(s.value);
    if (JSON.stringify(next) !== JSON.stringify(s.value)) {
      ops.push(Object.keys(next).length ? { path: SETTINGS, action: "rewrite", content: settingsText(next) } : { path: SETTINGS, action: "delete" });
    }
  } else if (!s.ok && s.reason === "invalid") {
    ops.push({ path: SETTINGS, action: "manual", note: "not valid JSON; remove the harness hooks (harness.mjs guard and doctor) by hand" });
  }
  const recordedHooks = /* @__PURE__ */ new Map();
  if (m.value.hook?.path === HOOK && typeof m.value.hook?.sha256 === "string") recordedHooks.set(HOOK, m.value.hook.sha256);
  const parts = ownGitParts(target);
  for (const h of Array.isArray(m.value.partHooks) ? m.value.partHooks : []) {
    if (isPartHookPath(h?.path) && parts.includes(h.path.split("/")[0]) && typeof h?.sha256 === "string") recordedHooks.set(h.path, h.sha256);
    else if (!isPartHookPath(h?.path)) ops.push({ path: String(h?.path), action: "manual", note: "the manifest lists it as a part's hook, but init never writes there; left alone" });
  }
  for (const part of ["", ...parts]) {
    const hook = hookRuns(target, part);
    const hookText = readText(target, hook.file, true);
    if (!hook.ok || hookText === null) continue;
    const own = hookPath(part);
    const recorded = recordedHooks.get(own) ?? null;
    if (hook.file === own && recorded !== null && sha256(readText(target, own) ?? "") === recorded) ops.push({ path: hook.file, action: "delete" });
    else if (hookText.includes(MARK)) ops.push({ path: hook.file, action: "manual", note: "a harness hook that changed or is shared; delete it by hand if you no longer need it" });
    else if (hookText.includes(RUNS_HARNESS)) ops.push({ path: hook.file, action: "manual", note: `remove the line "${hookLine(part).trim()}"` });
  }
  const indexes = ["", ...parts].map((p) => p ? `${p}/.git/${HARNESS_INDEX}` : `.git/${HARNESS_INDEX}`);
  for (const rel2 of [".harness/profile.json", ".harness/verify.json", ...indexes]) if (exists(target, rel2)) ops.push({ path: rel2, action: "delete" });
  if (exists(target, PROPOSALS)) {
    let names2 = [];
    try {
      names2 = readdirSync10(path25.join(target, PROPOSALS));
    } catch {
      ops.push({ path: PROPOSALS, action: "delete" });
    }
    for (const n of names2) if (`${PROPOSALS}/${n}` !== LEARNINGS2) ops.push({ path: `${PROPOSALS}/${n}`, action: "delete" });
  }
  for (const rel2 of PERSON) if (exists(target, rel2)) ops.push({ path: rel2, action: "kept", note: "yours; delete it by hand if you no longer need it" });
  ops.push({ path: MANIFEST, action: "delete" });
  return ops;
}
function applyRemove(target, ops) {
  const work = ops.filter((op) => op.action === "delete" || op.action === "rewrite");
  for (const op of work) assertNoLink(target, op.path);
  for (const op of work) {
    if (op.action === "rewrite") safeWrite(target, op.path, op.content);
    else rmSync3(path25.join(target, op.path), { recursive: true, force: true });
  }
  const order = foldersToPrune(work.map((op) => op.path));
  pruneEmpty(target, [...FOLDERS.slice(0, 2), ...order, ...FOLDERS.slice(2)]);
}

// tools/src/commands/remove.ts
function removeCommand(flags, io) {
  const ops = planRemove(flags.cwd);
  if (ops === null) throw new UsageError(".harness/manifest.json is missing or unreadable, so nothing is known to be the harness's; nothing was removed");
  if (!flags.dryRun) applyRemove(flags.cwd, ops);
  const left = ops.filter((op) => op.action === "kept" || op.action === "manual");
  if (flags.json) {
    io.out(JSON.stringify({ dryRun: flags.dryRun, ops: ops.map(({ path: path31, action, note }) => ({ path: path31, action, note })) }, null, 2) + "\n");
  } else {
    if (flags.dryRun) io.out("Dry run: nothing removed.\n");
    for (const op of ops) io.out(`  ${op.action.padEnd(9)} ${op.path}${op.note ? `  (${op.note})` : ""}
`);
  }
  return left.length ? 3 : 0;
}

// tools/src/commands/verify.ts
import { existsSync as existsSync8, readFileSync as readFileSync9 } from "node:fs";
import path27 from "node:path";

// tools/src/verify/run.ts
import { spawn, spawnSync as spawnSync8 } from "node:child_process";
import { existsSync as existsSync7, statSync as statSync7 } from "node:fs";
import os4 from "node:os";
import path26 from "node:path";
var TAIL = 20;
var KEEP = 64 * 1024;
var SHELL_NOTE = "uses shell syntax; set a plain command in .harness/overrides.json";
var KILLED = /* @__PURE__ */ new Set([137, 3221225477]);
function onWindowsPath(prog, env) {
  const exts = (env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean);
  const hasDir = prog.includes("/") || prog.includes("\\");
  const dirs2 = hasDir ? [""] : (env.PATH ?? env.Path ?? "").split(";").filter(Boolean);
  for (const d of dirs2) {
    const base = d ? path26.join(d, prog) : prog;
    for (const ext2 of path26.extname(prog) ? ["", ...exts] : exts) {
      const f = base + ext2;
      try {
        if (existsSync7(f) && statSync7(f).isFile()) return f;
      } catch {
      }
    }
  }
  return void 0;
}
var cmdQuote = (a) => `"${a.replace(/"/g, '""')}"`;
function killTree(pid) {
  try {
    if (process.platform === "win32") spawnSync8("taskkill", ["/T", "/F", "/PID", String(pid)], { windowsHide: true, stdio: "ignore" });
    else process.kill(-pid, "SIGKILL");
  } catch {
  }
}
function runCommand(category, command, root, timeoutMs2) {
  const start = Date.now();
  const done = (outcome, code, tail, note) => ({ category, command, outcome, code, ms: Date.now() - start, tail, ...note ? { note } : {} });
  if (/[$`]/.test(command)) return Promise.resolve(done("skipped", null, [], SHELL_NOTE));
  const parsed = simpleCommands(command, root, "posix", { home: os4.homedir() });
  const c = parsed.commands[0];
  if (parsed.unreadable || parsed.commands.length !== 1 || !c || c.redirects.length || c.piped || c.stdin !== void 0 || !c.argv.length) {
    return Promise.resolve(done("skipped", null, [], SHELL_NOTE));
  }
  const env = { ...process.env, ...c.env };
  let prog = c.argv[0];
  let args = c.argv.slice(1);
  let verbatim = false;
  if (process.platform === "win32") {
    const found = onWindowsPath(prog, env);
    if (!found) return Promise.resolve(done("unrunnable", null, [], `not found: ${prog}`));
    if (/\.(cmd|bat)$/i.test(found)) {
      args = ["/d", "/s", "/c", `"${[found, ...args].map(cmdQuote).join(" ")}"`];
      prog = env.ComSpec ?? "cmd.exe";
      verbatim = true;
    } else prog = found;
  }
  return new Promise((resolve) => {
    let buf = "";
    let timedOut = false;
    let settled = false;
    const timers = [];
    const add2 = (d) => {
      buf += d;
      if (buf.length > KEEP * 2) buf = buf.slice(-KEEP);
    };
    const child = spawn(prog, args, { cwd: root, env, windowsHide: true, windowsVerbatimArguments: verbatim, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.setEncoding("utf8").on("data", add2);
    child.stderr.setEncoding("utf8").on("data", add2);
    const tail = () => buf.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim() !== "").slice(-TAIL);
    const finish = (code, signal) => {
      if (settled) return;
      settled = true;
      for (const t of timers) clearTimeout(t);
      child.stdout.destroy();
      child.stderr.destroy();
      if (timedOut) return resolve(done("unrunnable", code, tail(), `timed out after ${Math.round(timeoutMs2 / 1e3)}s`));
      if (signal || code !== null && KILLED.has(code)) return resolve(done("unrunnable", code, tail(), "killed (out of memory or signal)"));
      resolve(done(code === 0 ? "pass" : "fail", code, code === 0 ? [] : tail()));
    };
    timers.push(setTimeout(() => {
      timedOut = true;
      if (child.pid) killTree(child.pid);
      timers.push(setTimeout(() => finish(null, null), 5e3));
    }, timeoutMs2));
    child.on("error", (e) => {
      if (settled) return;
      settled = true;
      for (const t of timers) clearTimeout(t);
      resolve(done("unrunnable", null, [], e.code === "ENOENT" ? `not found: ${c.argv[0]}` : `could not start: ${e.code ?? e.message}`));
    });
    child.on("exit", (code, signal) => timers.push(setTimeout(() => finish(code, signal), 2e3)));
    child.on("close", (code, signal) => finish(code, signal));
  });
}

// tools/src/commands/verify.ts
var NORMAL = ["format", "lint", "typecheck", "testQuick"];
var FULL = ["format", "lint", "typecheck", "test", "build"];
var TASK = ".harness/task.md";
function timeoutMs() {
  const s = Number(process.env.HARNESS_VERIFY_TIMEOUT);
  return (Number.isFinite(s) && s > 0 ? Math.min(s, 600) : 600) * 1e3;
}
function report2(results, pass, notes) {
  if (!results.length) return "harness verify: the profile has no commands to run\n";
  const ran = results.map((r) => r.category).join(", ");
  const passedCats = results.filter((r) => r.outcome === "pass").map((r) => r.category).join(", ");
  const notRun = results.filter((r) => r.outcome === "skipped" || r.outcome === "unrunnable").length;
  const lines = [];
  for (const r of results) {
    if (r.outcome === "fail") lines.push(`FAIL ${r.category} (code ${r.code}): ${r.command}`, ...r.tail.map((l) => `  ${l}`));
    else if (r.outcome === "unrunnable") lines.push(`COULD NOT RUN ${r.category}: ${r.command} (${r.note})`, ...r.tail.map((l) => `  ${l}`));
    else if (r.outcome === "skipped") lines.push(`SKIP ${r.category}: ${r.command} (${r.note})`);
  }
  const passed = results.filter((r) => r.outcome === "pass").length;
  const head = !pass ? `harness verify: failed (${ran})` : notRun ? `harness verify: ${passed} checks pass (${passedCats}); ${notRun} not run` : `harness verify: ${passed} checks pass (${ran})`;
  return [head, ...lines, ...notes].join("\n") + "\n";
}
async function verifyCommand(flags, io) {
  const root = flags.cwd;
  const profile = applyOverrides(root, detectProfile(root));
  const order = flags.full ? FULL : NORMAL;
  const pieces = [
    { label: "", dir: root, commands: profile.commands, quick: quickTest(root) },
    ...profile.parts.map((p) => ({ label: `${p.path}:`, dir: path27.join(root, p.path), commands: p.commands, quick: quickTest(root, p.path) }))
  ];
  const results = [];
  for (const piece of pieces) {
    const commands2 = { ...Object.fromEntries(Object.entries(piece.commands).map(([k, v]) => [k, v?.value])), testQuick: piece.quick };
    for (const cat of order) {
      const cmd = commands2[cat];
      if (cmd) results.push(await runCommand(piece.label + cat, cmd, piece.dir, timeoutMs()));
    }
  }
  const pass = !results.some((r) => r.outcome === "fail");
  const notes = [];
  if (pass) {
    const at = (/* @__PURE__ */ new Date()).toISOString();
    const tree = workTree(root);
    const s = readState(root);
    s.quick = { tree, at };
    if (flags.full && results.every((r) => r.outcome === "pass")) {
      const committed = tree !== null && tree === headTree(root);
      s.full = { tree, head: committed ? headOf(root) : null, at };
      if (!committed && tree !== null) notes.push("note: uncommitted changes; commit, then run verify --full again for the pull request check");
    }
    writeState(root, s);
  }
  if (existsSync8(path27.join(root, TASK))) {
    const summary2 = results.map((r) => `${r.category} ${r.outcome}`).join(", ") || "no commands";
    const text2 = readFileSync9(path27.join(root, TASK), "utf8");
    const line = `- verify ${(/* @__PURE__ */ new Date()).toISOString()} (${flags.full ? "full" : "normal"}): ${pass ? "pass" : "fail"} \u2014 ${summary2}
`;
    safeWrite(root, TASK, (text2.endsWith("\n") || text2 === "" ? text2 : text2 + "\n") + line);
  }
  io.out(flags.json ? JSON.stringify({ full: flags.full, pass, results }, null, 2) + "\n" : report2(results, pass, notes));
  return pass ? 0 : 3;
}

// tools/src/commands/stop.ts
import { readFileSync as readFileSync10 } from "node:fs";
import path28 from "node:path";
var STOP_REASON = "harness: files changed since the last passing harness verify; run node .harness/bin/harness.mjs verify (format, lint and types only) before you say the task is done.";
function shouldStop(root, input) {
  if (input?.stop_hook_active === true) return false;
  const t = workTree(root);
  if (t === null) return false;
  const s = readState(root);
  const covered = t === s.quick?.tree || t === s.full?.tree || t === s.stop?.tree || s.stop === void 0 && t === headTree(root);
  s.stop = { tree: t };
  writeState(root, s);
  return !covered;
}
function stopCommand(flags, io) {
  const agent = flags.agent;
  if (agent !== "claude-code" && agent !== "opencode") throw new UsageError("stop needs --agent claude-code or --agent opencode");
  let block = false;
  try {
    let input = {};
    try {
      input = JSON.parse(readFileSync10(0, "utf8") || "{}");
    } catch {
      input = {};
    }
    const env = process.env.CLAUDE_PROJECT_DIR;
    const root = agent === "claude-code" && env && path28.isAbsolute(env) ? env : flags.cwd;
    block = shouldStop(root, input);
  } catch {
    block = false;
  }
  if (agent === "claude-code") {
    if (block) io.out(JSON.stringify({ decision: "block", reason: STOP_REASON }) + "\n");
  } else io.out(JSON.stringify(block ? { block: true, reason: STOP_REASON } : { block: false }) + "\n");
  return 0;
}

// tools/src/commands/resume.ts
import path29 from "node:path";
var TASK2 = ".harness/task.md";
var LIMIT = 4e3;
var HEADER = `harness: resuming after compaction \u2014 task state from ${TASK2}. Continue from it; do not explore again what it already records.`;
var TRUNCATED = `[truncated: read ${TASK2} for the rest]`;
function resumeText(root) {
  try {
    assertNoLink(root, TASK2);
  } catch {
    return "";
  }
  const task = readText(root, TASK2);
  if (task === null || task.trim() === "") return "";
  if (task.length <= LIMIT) return `${HEADER}

${task}`;
  const cut = task.lastIndexOf("\n", LIMIT - 1);
  const body = cut > 0 ? task.slice(0, cut + 1) : task.slice(0, LIMIT);
  return `${HEADER}

${body}${TRUNCATED}
`;
}
function resumeCommand(flags, io) {
  let text2 = "";
  try {
    const env = process.env.CLAUDE_PROJECT_DIR;
    text2 = resumeText(env && path29.isAbsolute(env) ? env : flags.cwd);
  } catch {
    text2 = "";
  }
  if (flags.json) io.out(JSON.stringify({ text: text2 }) + "\n");
  else if (text2) io.out(text2);
  return 0;
}

// tools/src/cli.ts
var defaultIo = { out: (s) => process.stdout.write(s), err: (s) => process.stderr.write(s) };
var HELP = `harness ${VERSION}

Usage: harness <command> [options]

Commands:
  detect [--check]                     Read the repo and write .harness/profile.json (--check: only report if it is current)
  init [--agent a,b] [--with m,n] [--without m,n] [--new] [--dry-run]
                                       Install the harness core and modules, or update them (alias: update)
  guard [--agent claude-code|opencode] Judge one agent action read as JSON on stdin (allow, ask or deny)
  hook pre-commit                      Check the staged changes for secrets and risky patterns (what the git hook runs)
  doctor [--brief]                     Check the installed harness (--brief: print only problems)
  remove [--dry-run]                   Remove what init installed; keep what you changed
  verify [--full]                      Run format, lint and types (--full: also test and build)
  stop --agent claude-code|opencode     At turn end: stop the agent once if changes were not verified
  resume [--json]                      Print the task state (.harness/task.md, bounded) after a compaction

Options:
  --cwd <dir>   Project root (default: current directory)
  --json        Machine-readable output
  --help        Show this help
`;
var commands = {};
function register(name, handler) {
  commands[name] = handler;
}
async function main(argv, io = defaultIo) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        cwd: { type: "string" },
        json: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
        check: { type: "boolean", default: false },
        "dry-run": { type: "boolean", default: false },
        brief: { type: "boolean", default: false },
        full: { type: "boolean", default: false },
        agent: { type: "string" },
        with: { type: "string" },
        without: { type: "string" },
        new: { type: "boolean", default: false }
      }
    });
  } catch (e) {
    io.err(`harness: ${e.message}
`);
    return 1;
  }
  const { values, positionals } = parsed;
  if (values.help || positionals.length === 0) {
    io.out(HELP);
    return values.help ? 0 : 1;
  }
  const name = positionals[0];
  const handler = commands[name];
  if (!handler) {
    io.err(`harness: unknown command "${name}". Run harness --help
`);
    return 1;
  }
  const cwd = path30.resolve(values.cwd ?? process.cwd());
  if (!existsSync9(cwd) || !statSync8(cwd).isDirectory()) {
    io.err(`harness: --cwd is not a directory: ${cwd}
`);
    return 1;
  }
  const flags = { cwd, args: positionals.slice(1), json: values.json, check: values.check, dryRun: values["dry-run"], brief: values.brief, full: values.full, agent: values.agent, with: values.with, without: values.without, new: values.new };
  try {
    return await handler(flags, io);
  } catch (e) {
    if (e instanceof UsageError) {
      io.err(`harness: ${e.message}
`);
      return 1;
    }
    io.err(`harness: internal error: ${e.stack ?? e}
`);
    return 1;
  }
}
register("detect", detectCommand);
register("init", initCommand);
register("update", initCommand);
register("guard", guardCommand);
register("hook", hookCommand);
register("doctor", doctorCommand);
register("remove", removeCommand);
register("verify", verifyCommand);
register("stop", stopCommand);
register("resume", resumeCommand);
var invoked = process.argv[1] && path30.resolve(process.argv[1]) === fileURLToPath2(import.meta.url);
if (invoked) process.exitCode = await main(process.argv.slice(2));
export {
  UsageError,
  main,
  register
};
