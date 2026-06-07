import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadSkill,
  TRUNCATION_MARKER,
} from "@/features/agents/codex/skills/skill-loader.server";

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function frontmatter(name: string): string {
  return [
    "---",
    `name: ${name}`,
    'description: "test skill"',
    "---",
  ].join("\n");
}

describe("loadSkill", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "skill-loader-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("loads a valid skill and computes a SHA-256 hash of the body", async () => {
    const skillDir = path.join(tmpRoot, "foo");
    await fs.mkdir(skillDir, { recursive: true });
    const fileContent = `${frontmatter("foo")}\nBODY`;
    await fs.writeFile(path.join(skillDir, "SKILL.md"), fileContent, "utf8");

    const result = await loadSkill({
      directoryPath: skillDir,
      maxSkillChars: 1000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skill.meta.name).toBe("foo");
    expect(result.skill.body).toContain("BODY");
    expect(result.skill.truncated).toBe(false);
    expect(result.skill.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.skill.hash).toBe(sha256(result.skill.body));
  });

  it("truncates the body when it exceeds maxSkillChars and hashes the truncated body", async () => {
    const skillDir = path.join(tmpRoot, "foo");
    await fs.mkdir(skillDir, { recursive: true });
    const longBody = "a".repeat(200);
    const fileContent = `${frontmatter("foo")}\n${longBody}`;
    await fs.writeFile(path.join(skillDir, "SKILL.md"), fileContent, "utf8");

    const result = await loadSkill({
      directoryPath: skillDir,
      maxSkillChars: 50,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skill.truncated).toBe(true);
    expect(result.skill.body.endsWith(TRUNCATION_MARKER)).toBe(true);
    expect(result.skill.body.length).toBe(50);
    expect(result.skill.hash).toBe(sha256(result.skill.body));
  });

  it("returns file_not_found when SKILL.md is missing", async () => {
    const missingDir = path.join(tmpRoot, "does-not-exist");

    const result = await loadSkill({
      directoryPath: missingDir,
      maxSkillChars: 1000,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("file_not_found");
  });

  it("returns name_dir_mismatch when frontmatter name differs from directory name", async () => {
    const skillDir = path.join(tmpRoot, "foo");
    await fs.mkdir(skillDir, { recursive: true });
    const fileContent = `${frontmatter("bar")}\nbody`;
    await fs.writeFile(path.join(skillDir, "SKILL.md"), fileContent, "utf8");

    const result = await loadSkill({
      directoryPath: skillDir,
      maxSkillChars: 1000,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("name_dir_mismatch");
    expect(result.detail).toContain("bar");
    expect(result.detail).toContain("foo");
  });

  it("returns invalid_yaml for malformed frontmatter YAML", async () => {
    const skillDir = path.join(tmpRoot, "foo");
    await fs.mkdir(skillDir, { recursive: true });
    const fileContent = [
      "---",
      "name: foo",
      "description: \"unterminated",
      "  bad: [unclosed",
      "---",
      "body",
    ].join("\n");
    await fs.writeFile(path.join(skillDir, "SKILL.md"), fileContent, "utf8");

    const result = await loadSkill({
      directoryPath: skillDir,
      maxSkillChars: 1000,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("invalid_yaml");
  });

  it("returns missing_frontmatter when no YAML frontmatter is present", async () => {
    const skillDir = path.join(tmpRoot, "foo");
    await fs.mkdir(skillDir, { recursive: true });
    await fs.writeFile(
      path.join(skillDir, "SKILL.md"),
      "no frontmatter here, just body content",
      "utf8",
    );

    const result = await loadSkill({
      directoryPath: skillDir,
      maxSkillChars: 1000,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("missing_frontmatter");
  });

  it("hash equals SHA-256 of the post-truncation body string", async () => {
    const skillDir = path.join(tmpRoot, "foo");
    await fs.mkdir(skillDir, { recursive: true });
    const longBody = "a".repeat(200);
    const fileContent = `${frontmatter("foo")}\n${longBody}`;
    await fs.writeFile(path.join(skillDir, "SKILL.md"), fileContent, "utf8");

    const result = await loadSkill({
      directoryPath: skillDir,
      maxSkillChars: 80,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const expected = createHash("sha256")
      .update(result.skill.body)
      .digest("hex");
    expect(result.skill.hash).toBe(expected);
  });
});
