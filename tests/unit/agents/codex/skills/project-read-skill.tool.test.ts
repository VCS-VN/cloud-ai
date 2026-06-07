import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import {
  PROJECT_READ_SKILL_TOOL_NAME,
  projectReadSkill,
} from "@/features/agents/codex/skills/project-read-skill.tool.server";
import {
  loadRegistry,
  resetRegistryForTest,
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
      `description: "Skill ${name} for tool boundary test"`,
      "---",
      "",
      body,
      "",
    ].join("\n"),
  );
}

beforeEach(async () => {
  resetRegistryForTest();
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "project-read-skill-tool-"));
  skillsRoot = path.join(tmpRoot, "skills");
  await fs.mkdir(skillsRoot, { recursive: true });
});

afterEach(async () => {
  resetRegistryForTest();
  await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
});

describe("project_read_skill tool", () => {
  it("exports the canonical tool name", () => {
    expect(PROJECT_READ_SKILL_TOOL_NAME).toBe("project_read_skill");
  });

  it("returns body on happy-path lookup and emits onSuccess + skill_loaded audit", async () => {
    await writeSkill("design-taste-frontend", "anti-slop body");
    await loadRegistry({ skillsRoot, maxSkillChars: 32000 });
    const successes: { name: string; at: number }[] = [];
    const audits: string[] = [];
    const result = projectReadSkill(
      { name: "design-taste-frontend" },
      {
        onSuccess: (entry) => successes.push(entry),
        onAudit: (event) => audits.push(event.type),
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.name).toBe("design-taste-frontend");
      expect(result.body).toContain("anti-slop body");
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.version).toBe("1.0.0");
    }
    expect(successes).toHaveLength(1);
    expect(successes[0].name).toBe("design-taste-frontend");
    expect(typeof successes[0].at).toBe("number");
    expect(audits).toContain("skill_loaded");
  });

  it("returns not_found for an unknown skill and emits skill_load_failed audit", async () => {
    await loadRegistry({ skillsRoot, maxSkillChars: 32000 });
    const audits: { type: string; reason?: string }[] = [];
    const result = projectReadSkill(
      { name: "nonexistent-skill" },
      { onAudit: (event) => audits.push(event) },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("not_found");
    expect(audits.find((a) => a.type === "skill_load_failed")?.reason).toBe("not_found");
  });

  it("rejects names containing /", async () => {
    await loadRegistry({ skillsRoot, maxSkillChars: 32000 });
    const result = projectReadSkill({ name: "../../etc/passwd" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_name");
  });

  it("rejects names containing \\", async () => {
    await loadRegistry({ skillsRoot, maxSkillChars: 32000 });
    const result = projectReadSkill({ name: "foo\\bar" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_name");
  });

  it("rejects names with leading slash", async () => {
    await loadRegistry({ skillsRoot, maxSkillChars: 32000 });
    const result = projectReadSkill({ name: "/etc/passwd" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_name");
  });

  it("rejects empty name", async () => {
    await loadRegistry({ skillsRoot, maxSkillChars: 32000 });
    const result = projectReadSkill({ name: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_name");
  });

  it("rejects non-string name", async () => {
    await loadRegistry({ skillsRoot, maxSkillChars: 32000 });
    const result = projectReadSkill({ name: 123 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_name");
  });

  it("rejects names violating the kebab regex (uppercase)", async () => {
    await loadRegistry({ skillsRoot, maxSkillChars: 32000 });
    const result = projectReadSkill({ name: "Bad-NAME" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_name");
  });

  it("returns registry_unavailable when the registry was never loaded", () => {
    resetRegistryForTest();
    const result = projectReadSkill({ name: "design-taste-frontend" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("registry_unavailable");
  });

  it("appends one entry per call (no de-dup)", async () => {
    await writeSkill("foo");
    await loadRegistry({ skillsRoot, maxSkillChars: 32000 });
    const calls: { name: string; at: number }[] = [];
    projectReadSkill({ name: "foo" }, { onSuccess: (e) => calls.push(e) });
    projectReadSkill({ name: "foo" }, { onSuccess: (e) => calls.push(e) });
    projectReadSkill({ name: "foo" }, { onSuccess: (e) => calls.push(e) });
    expect(calls).toHaveLength(3);
  });

  it("never invokes onSuccess on failure", async () => {
    await loadRegistry({ skillsRoot, maxSkillChars: 32000 });
    const onSuccess = vi.fn();
    projectReadSkill({ name: "../../etc/passwd" }, { onSuccess });
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
