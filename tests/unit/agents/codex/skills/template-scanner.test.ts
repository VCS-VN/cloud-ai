import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  aggregateTemplateScans,
  scanActiveTemplates,
  type TemplateScanResult,
} from "@/features/agents/codex/skills/template-scanner.server";

describe("aggregateTemplateScans", () => {
  it("returns empty sets for an empty input", () => {
    const { required, recommended } = aggregateTemplateScans([]);
    expect(required).toBeInstanceOf(Set);
    expect(recommended).toBeInstanceOf(Set);
    expect(required.size).toBe(0);
    expect(recommended.size).toBe(0);
  });

  it("collects required and recommended skills from a single result", () => {
    const result: TemplateScanResult = {
      templatePath: "/x/a.md",
      requiredSkills: ["a"],
      recommendedSkills: ["b"],
    };

    const { required, recommended } = aggregateTemplateScans([result]);
    expect(required.has("a")).toBe(true);
    expect(recommended.has("b")).toBe(true);
    expect(required.size).toBe(1);
    expect(recommended.size).toBe(1);
  });

  it("treats required as overriding recommended when both are present", () => {
    const a: TemplateScanResult = {
      templatePath: "/x/a.md",
      requiredSkills: ["x"],
      recommendedSkills: [],
    };
    const b: TemplateScanResult = {
      templatePath: "/x/b.md",
      requiredSkills: [],
      recommendedSkills: ["x"],
    };

    const { required, recommended } = aggregateTemplateScans([a, b]);
    expect(required.has("x")).toBe(true);
    expect(recommended.has("x")).toBe(false);
  });

  it("dedupes within and across required, and removes required names from recommended", () => {
    const result: TemplateScanResult = {
      templatePath: "/x/a.md",
      requiredSkills: ["a", "a", "b"],
      recommendedSkills: ["a"],
    };

    const { required, recommended } = aggregateTemplateScans([result]);
    expect(Array.from(required).sort()).toEqual(["a", "b"]);
    expect(recommended.size).toBe(0);
  });
});

describe("scanActiveTemplates (integration via spied cwd)", () => {
  let tmpRoot: string;
  let cwdSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "template-scanner-"));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
  });

  afterEach(async () => {
    cwdSpy?.mockRestore();
    cwdSpy = null;
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  async function writeTemplate(relPath: string, content: string): Promise<void> {
    const abs = path.join(tmpRoot, relPath);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, "utf8");
  }

  it("scans all four template families and aggregates skills correctly", async () => {
    await writeTemplate(
      "templates/codex-builder/foundation/edit-system.md",
      "---\nrequiredSkills:\n  - skill-a\n---\nbody\n",
    );
    await writeTemplate(
      "templates/codex-builder/init/system.md",
      "intro line\n@skill:skill-b required\noutro\n",
    );
    await writeTemplate(
      "templates/codex-builder/recovery/recovery.md",
      "---\nrecommendedSkills:\n  - skill-c\n---\nbody\n",
    );
    await writeTemplate(
      "templates/codex-builder/redesign/redesign.md",
      "no frontmatter, no directive\n",
    );

    const results = await scanActiveTemplates();
    expect(results).toHaveLength(4);

    const { required, recommended } = aggregateTemplateScans(results);
    expect(Array.from(required).sort()).toEqual(["skill-a", "skill-b"]);
    expect(Array.from(recommended).sort()).toEqual(["skill-c"]);
  });

  it("skips missing files without throwing and returns the rest", async () => {
    // Only write 3 of the 4 expected paths; foundation/edit-system.md absent.
    await writeTemplate(
      "templates/codex-builder/init/system.md",
      "@skill:skill-b required\n",
    );
    await writeTemplate(
      "templates/codex-builder/recovery/recovery.md",
      "---\nrecommendedSkills:\n  - skill-c\n---\n",
    );
    await writeTemplate(
      "templates/codex-builder/redesign/redesign.md",
      "plain body\n",
    );

    const results = await scanActiveTemplates();
    expect(results).toHaveLength(3);

    const { required, recommended } = aggregateTemplateScans(results);
    expect(Array.from(required).sort()).toEqual(["skill-b"]);
    expect(Array.from(recommended).sort()).toEqual(["skill-c"]);
  });

  it("ignores invalid inline skill names without throwing", async () => {
    await writeTemplate(
      "templates/codex-builder/foundation/edit-system.md",
      "@skill:Bad-NAME required\n",
    );
    await writeTemplate(
      "templates/codex-builder/init/system.md",
      "ok body\n",
    );
    await writeTemplate(
      "templates/codex-builder/recovery/recovery.md",
      "ok body\n",
    );
    await writeTemplate(
      "templates/codex-builder/redesign/redesign.md",
      "ok body\n",
    );

    const results = await scanActiveTemplates();
    expect(results).toHaveLength(4);

    const { required, recommended } = aggregateTemplateScans(results);
    expect(required.size).toBe(0);
    expect(recommended.size).toBe(0);
  });
});
