import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanDraftForSymlinks } from "@/features/agents/codex/boundary/symlink-check.server";

let draft: string;
let outsideDir: string;

beforeEach(async () => {
  draft = await fs.mkdtemp(path.join(os.tmpdir(), "symlink-check-draft-"));
  outsideDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "symlink-check-outside-"),
  );
});

afterEach(async () => {
  await fs.rm(draft, { recursive: true, force: true });
  await fs.rm(outsideDir, { recursive: true, force: true });
});

describe("scanDraftForSymlinks", () => {
  it("returns ok for an empty draft with no symlinks", async () => {
    const result = await scanDraftForSymlinks(draft);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("accepts a symlink pointing to a real file inside the draft", async () => {
    const target = path.join(draft, "real.txt");
    await fs.writeFile(target, "hello");
    const link = path.join(draft, "link.txt");
    await fs.symlink(target, link);

    const result = await scanDraftForSymlinks(draft);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("flags a symlink pointing outside the draft", async () => {
    const outsideFile = path.join(outsideDir, "secret.txt");
    await fs.writeFile(outsideFile, "outside");
    const link = path.join(draft, "leak.txt");
    await fs.symlink(outsideFile, link);

    const result = await scanDraftForSymlinks(draft);
    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].reason).toBe("symlink_outside_draft");
    expect(result.issues[0].path).toBe(link);
  });

  it("flags a dangling symlink", async () => {
    const link = path.join(draft, "dangling.txt");
    await fs.symlink(path.join(draft, "does-not-exist.txt"), link);

    const result = await scanDraftForSymlinks(draft);
    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].reason).toBe("symlink_dangling");
    expect(result.issues[0].path).toBe(link);
  });

  it("follows a chain A -> B -> outside and reports symlink_outside_draft", async () => {
    const outsideFile = path.join(outsideDir, "target.txt");
    await fs.writeFile(outsideFile, "outside");
    const b = path.join(draft, "b.txt");
    const a = path.join(draft, "a.txt");
    await fs.symlink(outsideFile, b);
    await fs.symlink(b, a);

    const result = await scanDraftForSymlinks(draft);
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
    for (const issue of result.issues) {
      expect(issue.reason).toBe("symlink_outside_draft");
    }
    const aIssue = result.issues.find((i) => i.path === a);
    expect(aIssue).toBeDefined();
  });

  it("flags a symlink cycle A -> B -> A", async () => {
    const a = path.join(draft, "a.lnk");
    const b = path.join(draft, "b.lnk");
    await fs.symlink(a, b);
    await fs.symlink(b, a);

    const result = await scanDraftForSymlinks(draft);
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
    for (const issue of result.issues) {
      expect(issue.reason).toBe("symlink_cycle");
    }
  });
});
