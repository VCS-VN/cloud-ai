import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getSkill,
  listSkills,
  loadRegistry,
  onRegistryAudit,
  resetRegistryForTest,
  type RegistryAuditEvent,
} from "@/features/agents/codex/skills/registry.server";

const MAX_CHARS = 10_000;

let tmpRoot: string;

async function makeSkill(
  root: string,
  dirName: string,
  frontmatter: string,
  body = "Body content for skill.",
): Promise<void> {
  const dir = path.join(root, dirName);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "SKILL.md"), `${frontmatter}\n${body}\n`, "utf8");
}

function validFrontmatter(name: string): string {
  return [
    "---",
    `name: "${name}"`,
    `description: "Test skill ${name}"`,
    "---",
  ].join("\n");
}

describe("registry.server", () => {
  beforeEach(async () => {
    resetRegistryForTest();
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "skills-registry-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
    resetRegistryForTest();
  });

  it("loads empty skills root with zero skills and emits a single loaded event", async () => {
    const events: RegistryAuditEvent[] = [];
    const unsubscribe = onRegistryAudit((e) => events.push(e));

    const status = await loadRegistry({ skillsRoot: tmpRoot, maxSkillChars: MAX_CHARS });

    expect(status.loaded).toBe(true);
    expect(status.count).toBe(0);
    expect(status.failures).toEqual([]);
    expect(listSkills()).toEqual([]);
    expect(events.length).toBe(1);
    expect(events[0]).toMatchObject({ type: "skill_registry_loaded", count: 0 });

    unsubscribe();
  });

  it("treats a nonexistent skills root as empty", async () => {
    const missing = path.join(tmpRoot, "does-not-exist");
    const events: RegistryAuditEvent[] = [];
    const unsubscribe = onRegistryAudit((e) => events.push(e));

    const status = await loadRegistry({ skillsRoot: missing, maxSkillChars: MAX_CHARS });

    expect(status.loaded).toBe(true);
    expect(status.count).toBe(0);
    expect(status.failures).toEqual([]);
    expect(listSkills()).toEqual([]);
    expect(events.length).toBe(1);
    expect(events[0]).toMatchObject({ type: "skill_registry_loaded", count: 0 });

    unsubscribe();
  });

  it("loads a single valid skill and exposes it via getSkill/listSkills", async () => {
    await makeSkill(tmpRoot, "foo", validFrontmatter("foo"), "Hello foo body.");

    const events: RegistryAuditEvent[] = [];
    const unsubscribe = onRegistryAudit((e) => events.push(e));

    const status = await loadRegistry({ skillsRoot: tmpRoot, maxSkillChars: MAX_CHARS });

    expect(status.loaded).toBe(true);
    expect(status.count).toBe(1);
    expect(status.failures).toEqual([]);
    expect(listSkills()).toHaveLength(1);

    const skill = getSkill("foo");
    expect(skill).not.toBeNull();
    expect(skill?.meta.name).toBe("foo");
    expect(skill?.body).toContain("Hello foo body.");
    expect(skill?.hash).toMatch(/^[a-f0-9]{64}$/);

    const loadedEvents = events.filter((e) => e.type === "skill_registry_loaded");
    expect(loadedEvents).toHaveLength(1);
    expect(loadedEvents[0]).toMatchObject({ type: "skill_registry_loaded", count: 1 });

    unsubscribe();
  });

  it("records failures for malformed YAML and name/dir mismatch while keeping valid skills", async () => {
    await makeSkill(tmpRoot, "good", validFrontmatter("good"));

    const malformed = ["---", "name: 'unterminated", "description: [oops", "---"].join("\n");
    await makeSkill(tmpRoot, "broken", malformed);

    await makeSkill(tmpRoot, "wrongdir", validFrontmatter("not-wrongdir"));

    const events: RegistryAuditEvent[] = [];
    const unsubscribe = onRegistryAudit((e) => events.push(e));

    const status = await loadRegistry({ skillsRoot: tmpRoot, maxSkillChars: MAX_CHARS });

    expect(status.count).toBe(1);
    expect(getSkill("good")).not.toBeNull();
    expect(status.failures).toHaveLength(2);

    const reasons = status.failures.map((f) => f.reason).sort();
    expect(reasons).toEqual(["invalid_yaml", "name_dir_mismatch"]);

    const failureEvents = events.filter((e) => e.type === "skill_load_failed");
    expect(failureEvents).toHaveLength(2);
    const failureReasons = failureEvents
      .map((e) => (e.type === "skill_load_failed" ? e.reason : ""))
      .sort();
    expect(failureReasons).toEqual(["invalid_yaml", "name_dir_mismatch"]);

    unsubscribe();
  });

  it("loads two distinct skills in separate dirs successfully", async () => {
    await makeSkill(tmpRoot, "foo", validFrontmatter("foo"));
    await makeSkill(tmpRoot, "bar", validFrontmatter("bar"));

    const status = await loadRegistry({ skillsRoot: tmpRoot, maxSkillChars: MAX_CHARS });

    expect(status.count).toBe(2);
    expect(status.failures).toEqual([]);
    expect(getSkill("foo")).not.toBeNull();
    expect(getSkill("bar")).not.toBeNull();
    expect(listSkills()).toHaveLength(2);
  });

  it("records symlink_escape failure and does not resolve symlinks", async () => {
    const target = path.join(tmpRoot, "outside-target");
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(
      path.join(target, "SKILL.md"),
      `${validFrontmatter("sym")}\nshould-not-be-read\n`,
      "utf8",
    );

    await fs.symlink(target, path.join(tmpRoot, "sym"));

    const events: RegistryAuditEvent[] = [];
    const unsubscribe = onRegistryAudit((e) => events.push(e));

    const status = await loadRegistry({ skillsRoot: tmpRoot, maxSkillChars: MAX_CHARS });

    expect(status.failures.some((f) => f.reason === "symlink_escape" && f.name === "sym")).toBe(
      true,
    );
    expect(getSkill("sym")).toBeNull();

    const symlinkFailures = events.filter(
      (e) => e.type === "skill_load_failed" && e.reason === "symlink_escape",
    );
    expect(symlinkFailures.length).toBeGreaterThanOrEqual(1);

    unsubscribe();
  });

  it("returns null from getSkill for an unknown name", async () => {
    await loadRegistry({ skillsRoot: tmpRoot, maxSkillChars: MAX_CHARS });
    expect(getSkill("nonexistent-skill")).toBeNull();
  });
});
