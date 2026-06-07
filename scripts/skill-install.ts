#!/usr/bin/env -S npx tsx
/* eslint-disable no-console */
/**
 * skill-install — fetch a SKILL.md from anywhere, normalize its frontmatter
 * to match the cloud-ai builder runtime schema, write it into $SKILLS_ROOT.
 *
 * Sources supported:
 *   --from-local <path>          A local SKILL.md OR a local directory containing one or more <name>/SKILL.md.
 *   --from-github <repo-spec>    GitHub repo. Spec forms accepted:
 *                                  owner/repo
 *                                  owner/repo@branch
 *                                  owner/repo/path/to/SKILL.md
 *                                  owner/repo/path/to/folder
 *                                  https://github.com/owner/repo
 *                                  https://github.com/owner/repo/tree/branch/path
 *                                  https://github.com/owner/repo/blob/branch/path/SKILL.md
 *                                  https://raw.githubusercontent.com/owner/repo/branch/path/SKILL.md
 *   --from-url <https-url>       Direct fetch of a single SKILL.md (GitHub raw or any URL).
 *
 * Filters / overrides:
 *   --skill <name>               Install only this skill (matches frontmatter name OR folder name).
 *   --rename <name>              Force install name (overrides frontmatter name). Use when a skill's
 *                                folder name differs from its declared name and you want a specific name.
 *   --target <path>              Override $SKILLS_ROOT (default /var/bin/skills).
 *   --owner <user:group>         chown target dir (default builder:builder, ignored if not root).
 *   --dry-run                    Show what would happen, write nothing.
 *
 * Env file resolution (for SKILLS_ROOT / SKILLS_OWNER):
 *   --env-file <path>            Explicit path. Errors if unreadable.
 *   --no-env-file                Skip auto-loading.
 *   (default)                    Auto-load /etc/cloud-ai/.env when NODE_ENV=production,
 *                                otherwise look for .env in the current directory.
 *                                Resolution priority for SKILLS_ROOT/SKILLS_OWNER:
 *                                  CLI flag (--target / --owner)
 *                                  > shell env (export SKILLS_ROOT=...)
 *                                  > .env file value
 *                                  > built-in default (/var/bin/skills, builder:builder).
 *
 * Examples:
 *   sudo skill-install --from-local ./skills/design-taste-frontend
 *   sudo skill-install --from-github Leonxlnx/taste-skill --skill design-taste-frontend
 *   sudo skill-install --from-github mattpocock/skills/skills/engineering/diagnose
 *   sudo skill-install --from-url https://raw.githubusercontent.com/Leonxlnx/taste-skill/main/skills/taste-skill/SKILL.md
 *
 * Normalization adds missing required fields with sensible defaults:
 *   clarificationPolicy: when_ambiguous
 *   asksClarification:   true
 *   appliesTo:           [init_project, design_update, ui_mutation]
 *   version:             1.0.0
 *   description:         <falls back to first paragraph of body if absent>
 *
 * Strips fields not in our schema (the strict loader rejects unknown_fields).
 *
 * Re-running overwrites; idempotent.
 */

import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, statSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename, dirname, resolve, sep } from "node:path";
import { execFileSync } from "node:child_process";

type Args = {
  fromLocal?: string;
  fromGithub?: string;
  fromUrl?: string;
  skill?: string;
  rename?: string;
  target: string;
  owner: string;
  dryRun: boolean;
  envFile: string | null;
  envFileSource: "default" | "explicit" | "none";
};

const SCHEMA_FIELDS = new Set([
  "name",
  "description",
  "aliases",
  "triggers",
  "asksClarification",
  "clarificationPolicy",
  "appliesTo",
  "version",
]);

const VALID_POLICIES = new Set(["never", "when_ambiguous", "always_before_apply"]);
const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

const DEFAULT_ENV_CANDIDATES = [
  process.env.NODE_ENV === "production"
    ? "/etc/cloud-ai/.env"
    : null,
  ".env",
];

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const lineRaw of content.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnvFile(path: string): Record<string, string> | null {
  try {
    const content = readFileSync(path, "utf8");
    return parseEnvFile(content);
  } catch {
    return null;
  }
}

function resolveEnvFile(explicit: string | null): {
  path: string | null;
  source: "default" | "explicit" | "none";
  loaded: Record<string, string> | null;
} {
  if (explicit) {
    const loaded = loadEnvFile(explicit);
    if (!loaded) {
      throw new Error(`--env-file ${explicit} could not be read`);
    }
    return { path: explicit, source: "explicit", loaded };
  }
  for (const candidate of DEFAULT_ENV_CANDIDATES) {
    if (!candidate) continue;
    const loaded = loadEnvFile(candidate);
    if (loaded) return { path: candidate, source: "default", loaded };
  }
  return { path: null, source: "none", loaded: null };
}

function parseArgs(argv: string[]): Args {
  let envFlag: string | null = null;
  let noEnv = false;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--env-file") {
      envFlag = argv[i + 1];
    } else if (argv[i] === "--no-env-file") {
      noEnv = true;
    }
  }
  const envResolution = noEnv
    ? { path: null, source: "none" as const, loaded: null }
    : resolveEnvFile(envFlag);

  const envSkillsRoot = envResolution.loaded?.SKILLS_ROOT;
  const envOwner = envResolution.loaded?.SKILLS_OWNER;

  const out: Args = {
    target: process.env.SKILLS_ROOT ?? envSkillsRoot ?? "/var/bin/skills",
    owner: process.env.SKILLS_OWNER ?? envOwner ?? "builder:builder",
    dryRun: false,
    envFile: envResolution.path,
    envFileSource: envResolution.source,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    switch (a) {
      case "--from-local": out.fromLocal = next; i++; break;
      case "--from-github": out.fromGithub = next; i++; break;
      case "--from-url": out.fromUrl = next; i++; break;
      case "--skill": out.skill = next; i++; break;
      case "--rename": out.rename = next; i++; break;
      case "--target": out.target = next; i++; break;
      case "--owner": out.owner = next; i++; break;
      case "--dry-run": out.dryRun = true; break;
      case "--env-file": i++; break; // consumed earlier
      case "--no-env-file": break; // consumed earlier
      case "--help":
      case "-h":
        process.stdout.write(readFileSync(__filename, "utf8").split("\n").slice(1, 60).join("\n").replace(/^\/\*\*?|\*\/?$/g, "").replace(/^\s*\*\s?/gm, "") + "\n");
        process.exit(0);
        break;
      default:
        if (a.startsWith("--")) throw new Error(`unknown arg: ${a}`);
    }
  }
  const sources = [out.fromLocal, out.fromGithub, out.fromUrl].filter(Boolean).length;
  if (sources !== 1) {
    throw new Error("exactly one of --from-local, --from-github, --from-url is required");
  }
  return out;
}

type GithubSpec = {
  owner: string;
  repo: string;
  ref?: string;
  path?: string;     // path inside repo, "" for root
  pathKind?: "file" | "tree";
};

function parseGithubSpec(raw: string): GithubSpec {
  let s = raw.trim();
  s = s.replace(/^https?:\/\/raw\.githubusercontent\.com\//, "").replace(/^https?:\/\/github\.com\//, "");
  // Forms now: owner/repo[/blob|tree/ref/path] or owner/repo[/path] or owner/repo@ref[/path]
  let pathKind: "file" | "tree" | undefined;
  if (s.includes("/blob/")) { pathKind = "file"; s = s.replace("/blob/", "/__REF__/"); }
  if (s.includes("/tree/")) { pathKind = "tree"; s = s.replace("/tree/", "/__REF__/"); }
  let ref: string | undefined;
  let atSplit = s.split("@");
  if (atSplit.length === 2 && !atSplit[0].includes("/__REF__/")) {
    s = atSplit[0] + "/__REF__/" + atSplit[1];
  }
  const parts = s.split("/").filter(Boolean);
  if (parts.length < 2) throw new Error(`github spec needs owner/repo: ${raw}`);
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, "");
  let pathParts = parts.slice(2);
  const refIdx = pathParts.indexOf("__REF__");
  if (refIdx >= 0) {
    ref = pathParts[refIdx + 1];
    pathParts = pathParts.slice(refIdx + 2);
  }
  // If the trailing path looks like a file (ends in .md or known filename), mark as file
  const path = pathParts.join("/");
  if (!pathKind && path) {
    pathKind = path.endsWith(".md") ? "file" : "tree";
  }
  return { owner, repo, ref, path, pathKind };
}

function fetchUrl(url: string): string {
  // Use curl for simplicity; honors VPS-side proxy, ipv4/v6, redirects.
  return execFileSync("curl", ["-sSL", "--fail-with-body", url], { encoding: "utf8" });
}

function rawGithubUrl(spec: GithubSpec, filePath: string): string {
  const ref = spec.ref ?? "HEAD";
  return `https://raw.githubusercontent.com/${spec.owner}/${spec.repo}/${ref}/${filePath}`;
}

function listRepoTree(spec: GithubSpec): string[] {
  // GitHub trees API: returns full file list of a repo at a ref. Public repos work without auth.
  const ref = spec.ref ?? "HEAD";
  const url = `https://api.github.com/repos/${spec.owner}/${spec.repo}/git/trees/${ref}?recursive=1`;
  const json = JSON.parse(fetchUrl(url));
  if (!Array.isArray(json.tree)) throw new Error("github tree API returned no tree");
  return (json.tree as { path: string; type: string }[])
    .filter((e) => e.type === "blob" && e.path.endsWith("SKILL.md"))
    .map((e) => e.path);
}

type SkillSourceFile = { logicalName: string; sourceLabel: string; content: string };

function gatherFromGithub(spec: GithubSpec): SkillSourceFile[] {
  const out: SkillSourceFile[] = [];
  if (spec.pathKind === "file" && spec.path) {
    const content = fetchUrl(rawGithubUrl(spec, spec.path));
    const folderName = basename(dirname(spec.path));
    out.push({ logicalName: folderName, sourceLabel: `${spec.owner}/${spec.repo}/${spec.path}`, content });
    return out;
  }
  const allSkillPaths = listRepoTree(spec);
  const filtered = spec.path
    ? allSkillPaths.filter((p) => p === spec.path || p.startsWith(spec.path + "/"))
    : allSkillPaths;
  for (const p of filtered) {
    const folderName = basename(dirname(p));
    const content = fetchUrl(rawGithubUrl(spec, p));
    out.push({ logicalName: folderName, sourceLabel: `${spec.owner}/${spec.repo}/${p}`, content });
  }
  return out;
}

function gatherFromLocal(localPath: string): SkillSourceFile[] {
  const abs = resolve(localPath);
  const st = statSync(abs);
  if (st.isFile() && abs.endsWith("SKILL.md")) {
    return [{
      logicalName: basename(dirname(abs)),
      sourceLabel: abs,
      content: readFileSync(abs, "utf8"),
    }];
  }
  if (st.isDirectory()) {
    const direct = join(abs, "SKILL.md");
    if (existsSync(direct)) {
      return [{
        logicalName: basename(abs),
        sourceLabel: direct,
        content: readFileSync(direct, "utf8"),
      }];
    }
    const out: SkillSourceFile[] = [];
    function walk(dir: string): void {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.isFile() && entry.name === "SKILL.md") {
          out.push({
            logicalName: basename(dirname(full)),
            sourceLabel: full,
            content: readFileSync(full, "utf8"),
          });
        }
      }
    }
    walk(abs);
    return out;
  }
  throw new Error(`local path is neither a SKILL.md file nor a directory: ${localPath}`);
}

function gatherFromUrl(url: string): SkillSourceFile[] {
  const content = fetchUrl(url);
  const u = new URL(url);
  const segs = u.pathname.split("/").filter(Boolean);
  const folderName = segs.length >= 2 ? segs[segs.length - 2] : "skill";
  return [{ logicalName: folderName, sourceLabel: url, content }];
}

type ParsedFrontmatter = { fields: Record<string, unknown>; body: string };

function splitFrontmatter(content: string): ParsedFrontmatter {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) {
    return { fields: {}, body: content };
  }
  const end = content.indexOf("\n---", 4);
  if (end === -1) return { fields: {}, body: content };
  const block = content.slice(4, end);
  const after = content.slice(end + 4).replace(/^[\r\n]+/, "");
  const fields: Record<string, unknown> = {};
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;
  for (const lineRaw of block.split(/\r?\n/)) {
    const line = lineRaw.replace(/\s+$/, "");
    if (!line) continue;
    if (/^\s*-\s+/.test(line) && currentArray) {
      currentArray.push(line.replace(/^\s*-\s+/, "").replace(/^["']|["']$/g, ""));
      continue;
    }
    const m = line.match(/^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/);
    if (m) {
      currentKey = m[1];
      const raw = m[2];
      if (raw === "" || raw === undefined) {
        currentArray = [];
        fields[currentKey] = currentArray;
        continue;
      }
      currentArray = null;
      let v: unknown = raw.replace(/^["']|["']$/g, "");
      if (v === "true") v = true;
      else if (v === "false") v = false;
      else if (typeof v === "string" && /^\d+$/.test(v)) v = Number(v);
      fields[currentKey] = v;
    }
  }
  return { fields, body: after };
}

function inferDescription(body: string): string {
  const para = body.split(/\n\s*\n/).find((p) => p.trim().length > 0) ?? "";
  return para.replace(/[#>*_`-]/g, "").replace(/\s+/g, " ").trim().slice(0, 280) || "Imported skill.";
}

function normalize(input: SkillSourceFile, override?: string): { name: string; content: string; warnings: string[] } {
  const warnings: string[] = [];
  const fm = splitFrontmatter(input.content);
  const declaredName = typeof fm.fields["name"] === "string" ? (fm.fields["name"] as string) : null;
  const name = override ?? declaredName ?? input.logicalName;

  if (!NAME_PATTERN.test(name)) {
    throw new Error(`skill name "${name}" violates regex ${NAME_PATTERN}; pass --rename to fix`);
  }

  const newFields: Record<string, unknown> = {};
  newFields["name"] = name;

  const desc = (fm.fields["description"] as string | undefined) ?? inferDescription(fm.body);
  if (!fm.fields["description"]) warnings.push(`description missing — derived from body`);
  newFields["description"] = desc;

  if (Array.isArray(fm.fields["aliases"])) newFields["aliases"] = fm.fields["aliases"];
  if (Array.isArray(fm.fields["triggers"])) newFields["triggers"] = fm.fields["triggers"];
  if (Array.isArray(fm.fields["appliesTo"])) {
    newFields["appliesTo"] = fm.fields["appliesTo"];
  } else {
    newFields["appliesTo"] = ["init_project", "design_update", "ui_mutation"];
    warnings.push(`appliesTo defaulted to [init_project, design_update, ui_mutation]`);
  }

  const policy = fm.fields["clarificationPolicy"];
  if (typeof policy === "string" && VALID_POLICIES.has(policy)) {
    newFields["clarificationPolicy"] = policy;
  } else {
    newFields["clarificationPolicy"] = "when_ambiguous";
    if (policy !== undefined) warnings.push(`clarificationPolicy "${policy}" not in {never, when_ambiguous, always_before_apply}; defaulted to when_ambiguous`);
    else warnings.push(`clarificationPolicy defaulted to when_ambiguous`);
  }

  const asksRaw = fm.fields["asksClarification"];
  newFields["asksClarification"] = typeof asksRaw === "boolean" ? asksRaw : true;

  const versionRaw = fm.fields["version"];
  newFields["version"] = typeof versionRaw === "string" ? versionRaw : "1.0.0";

  const stripped = Object.keys(fm.fields).filter((k) => !SCHEMA_FIELDS.has(k));
  if (stripped.length > 0) warnings.push(`stripped unknown fields: ${stripped.join(", ")}`);

  const yamlLines = ["---"];
  yamlLines.push(`name: ${newFields["name"]}`);
  yamlLines.push(`description: ${JSON.stringify(newFields["description"])}`);
  for (const arrayKey of ["aliases", "triggers", "appliesTo"] as const) {
    const v = newFields[arrayKey];
    if (Array.isArray(v) && v.length > 0) {
      yamlLines.push(`${arrayKey}:`);
      for (const item of v as string[]) yamlLines.push(`  - ${item}`);
    }
  }
  yamlLines.push(`asksClarification: ${newFields["asksClarification"] ? "true" : "false"}`);
  yamlLines.push(`clarificationPolicy: ${newFields["clarificationPolicy"]}`);
  yamlLines.push(`version: "${newFields["version"]}"`);
  yamlLines.push("---");
  yamlLines.push("");
  const content = yamlLines.join("\n") + fm.body;
  return { name, content, warnings };
}

function ensureTargetDir(targetRoot: string, owner: string, dryRun: boolean): void {
  if (!existsSync(targetRoot)) {
    if (dryRun) {
      console.log(`[dry-run] would mkdir ${targetRoot}`);
      return;
    }
    mkdirSync(targetRoot, { recursive: true });
    if (process.getuid?.() === 0) {
      try {
        execFileSync("chown", [owner, targetRoot]);
        execFileSync("chmod", ["750", targetRoot]);
      } catch (err) {
        console.warn(`warn: chown/chmod ${targetRoot} failed: ${(err as Error).message}`);
      }
    }
  }
}

function writeSkill(targetRoot: string, name: string, content: string, owner: string, dryRun: boolean): string {
  const dir = join(targetRoot, name);
  const file = join(dir, "SKILL.md");
  if (dryRun) {
    console.log(`[dry-run] would write ${file} (${content.length} bytes)`);
    return file;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, content);
  if (process.getuid?.() === 0) {
    try {
      execFileSync("chown", ["-R", owner, dir]);
      execFileSync("chmod", ["750", dir]);
      execFileSync("chmod", ["640", file]);
    } catch (err) {
      console.warn(`warn: chown/chmod ${dir} failed: ${(err as Error).message}`);
    }
  }
  return file;
}

function main(): void {
  const args = parseArgs(process.argv);

  if (args.envFileSource === "explicit") {
    console.log(`env: loaded ${args.envFile}`);
  } else if (args.envFileSource === "default" && args.envFile) {
    console.log(`env: loaded ${args.envFile} (default)`);
  } else {
    console.log("env: no .env file (using shell env + defaults)");
  }
  console.log(`target: ${args.target}`);
  console.log(`owner:  ${args.owner}`);

  let sources: SkillSourceFile[] = [];
  if (args.fromLocal) sources = gatherFromLocal(args.fromLocal);
  else if (args.fromGithub) sources = gatherFromGithub(parseGithubSpec(args.fromGithub));
  else if (args.fromUrl) sources = gatherFromUrl(args.fromUrl);

  if (sources.length === 0) {
    console.error("error: no SKILL.md found at the given source");
    process.exit(2);
  }

  if (args.skill) {
    sources = sources.filter((s) => {
      const fm = splitFrontmatter(s.content);
      const declared = typeof fm.fields["name"] === "string" ? (fm.fields["name"] as string) : null;
      return declared === args.skill || s.logicalName === args.skill;
    });
    if (sources.length === 0) {
      console.error(`error: --skill ${args.skill} did not match any source`);
      process.exit(2);
    }
  }

  ensureTargetDir(args.target, args.owner, args.dryRun);

  let installed = 0;
  for (const src of sources) {
    let normalized: ReturnType<typeof normalize>;
    try {
      normalized = normalize(src, args.rename);
    } catch (err) {
      console.error(`skip ${src.sourceLabel}: ${(err as Error).message}`);
      continue;
    }
    const file = writeSkill(args.target, normalized.name, normalized.content, args.owner, args.dryRun);
    console.log(`${args.dryRun ? "[dry-run] " : ""}installed: ${normalized.name} from ${src.sourceLabel} -> ${file}`);
    if (normalized.warnings.length > 0) {
      for (const w of normalized.warnings) console.log(`  warn: ${w}`);
    }
    installed++;
  }

  console.log("");
  console.log(`done: ${installed} skill(s) ${args.dryRun ? "would be " : ""}installed at ${args.target}`);
  if (!args.dryRun && installed > 0) {
    console.log("next: pm2 restart cloud-ai-builder && pm2 logs cloud-ai-builder --lines 30 --nostream | grep skill_registry_loaded");
  }
}

try {
  main();
} catch (err) {
  console.error(`error: ${(err as Error).message}`);
  process.exit(1);
}
