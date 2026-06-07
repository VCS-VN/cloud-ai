import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import {
  loadRegistry,
  resetRegistryForTest,
  getSkill,
  listSkills,
  getRegistryStatus,
  onRegistryAudit,
  type RegistryAuditEvent,
} from "@/features/agents/codex/skills/registry.server";

let tmpRoot: string;
let skillsRoot: string;

async function writeSkill(name: string, body = `Body for ${name}`): Promise<void> {
  await fs.mkdir(path.join(skillsRoot, name), { recursive: true });
  await fs.writeFile(
    path.join(skillsRoot, name, "SKILL.md"),
    [
      "---",
      `name: ${name}`,
      `description: "Skill ${name} for boot test"`,
      "---",
      "",
      body,
      "",
    ].join("\n"),
  );
}

async function writeMalformed(name: string, payload: string): Promise<void> {
  await fs.mkdir(path.join(skillsRoot, name), { recursive: true });
  await fs.writeFile(path.join(skillsRoot, name, "SKILL.md"), payload);
}

beforeEach(async () => {
  resetRegistryForTest();
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "registry-boot-"));
  skillsRoot = path.join(tmpRoot, "skills");
  await fs.mkdir(skillsRoot, { recursive: true });
});

afterEach(async () => {
  resetRegistryForTest();
  await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
});

describe("US5 registry boot resilience", () => {
  it("boots cleanly with 1 valid + 2 broken entries", async () => {
    await writeSkill("good-skill");
    await writeMalformed("bad-yaml", "---\nname: bad-yaml\n  invalid yaml\n---\nbody");
    // Name in frontmatter mismatches the directory.
    await writeMalformed(
      "wrong-dir",
      ["---", "name: not-wrong-dir", "description: x", "---", "body"].join("\n"),
    );

    const audits: RegistryAuditEvent[] = [];
    const off = onRegistryAudit((event) => audits.push(event));

    const status = await loadRegistry({ skillsRoot, maxSkillChars: 32000 });
    off();

    expect(status.loaded).toBe(true);
    expect(status.count).toBe(1);
    expect(status.failures).toHaveLength(2);
    expect(getSkill("good-skill")).not.toBeNull();
    expect(getSkill("bad-yaml")).toBeNull();
    expect(getSkill("wrong-dir")).toBeNull();

    const loadedAudit = audits.find((a) => a.type === "skill_registry_loaded");
    expect(loadedAudit).toBeDefined();
    if (loadedAudit && loadedAudit.type === "skill_registry_loaded") {
      expect(loadedAudit.count).toBe(1);
    }
    const failureAudits = audits.filter((a) => a.type === "skill_load_failed");
    expect(failureAudits).toHaveLength(2);
  });

  it("rejects symlinked entries early without resolving and audits skill_load_failed", async () => {
    await writeSkill("real");
    const targetDir = path.join(tmpRoot, "outside-target");
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(
      path.join(targetDir, "SKILL.md"),
      "should-never-be-read",
    );
    await fs.symlink(targetDir, path.join(skillsRoot, "evil-link"));

    const audits: RegistryAuditEvent[] = [];
    const off = onRegistryAudit((event) => audits.push(event));

    const status = await loadRegistry({ skillsRoot, maxSkillChars: 32000 });
    off();

    expect(status.count).toBe(1);
    expect(getSkill("real")).not.toBeNull();
    expect(getSkill("evil-link")).toBeNull();

    const symlinkAudit = audits.find(
      (a) =>
        a.type === "skill_load_failed" &&
        a.name === "evil-link" &&
        a.reason === "symlink_escape",
    );
    expect(symlinkAudit).toBeDefined();
  });

  it("boots cleanly with empty $SKILLS_ROOT", async () => {
    const audits: RegistryAuditEvent[] = [];
    const off = onRegistryAudit((event) => audits.push(event));

    const status = await loadRegistry({ skillsRoot, maxSkillChars: 32000 });
    off();

    expect(status.loaded).toBe(true);
    expect(status.count).toBe(0);
    expect(status.failures).toHaveLength(0);
    expect(listSkills()).toHaveLength(0);

    const loadedAudit = audits.find((a) => a.type === "skill_registry_loaded");
    expect(loadedAudit).toBeDefined();
    if (loadedAudit && loadedAudit.type === "skill_registry_loaded") {
      expect(loadedAudit.count).toBe(0);
    }
  });

  it("getRegistryStatus reflects boot result", async () => {
    await writeSkill("foo");
    await loadRegistry({ skillsRoot, maxSkillChars: 32000 });

    const status = getRegistryStatus();
    expect(status.loaded).toBe(true);
    expect(status.skillsRoot).toBe(skillsRoot);
    expect(status.count).toBe(1);
    expect(status.bootedAt).toBeGreaterThan(0);
  });

  it("nonexistent $SKILLS_ROOT path boots cleanly with count 0", async () => {
    const ghostRoot = path.join(tmpRoot, "does-not-exist");
    const status = await loadRegistry({ skillsRoot: ghostRoot, maxSkillChars: 32000 });
    expect(status.loaded).toBe(true);
    expect(status.count).toBe(0);
    expect(status.failures).toHaveLength(0);
  });
});
