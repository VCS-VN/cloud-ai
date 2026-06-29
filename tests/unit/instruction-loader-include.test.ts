import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  loadInstruction,
  resolveTemplateIncludes,
} from "@/features/agents/codex/context/instruction-loader.server";

async function makeTempTemplatesRoot(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "instruction-loader-"));
  await fs.mkdir(path.join(dir, "templates", "codex-builder", "canonical"), {
    recursive: true,
  });
  await fs.mkdir(path.join(dir, "templates", "codex-builder", "foundation"), {
    recursive: true,
  });
  return dir;
}

describe("resolveTemplateIncludes / loadInstruction", () => {
  let workspace: string;
  beforeEach(async () => {
    workspace = await makeTempTemplatesRoot();
    vi.spyOn(process, "cwd").mockReturnValue(workspace);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(workspace, { recursive: true, force: true });
  });

  it("inlines a canonical body in place of {{include:...}}", async () => {
    await fs.writeFile(
      path.join(workspace, "templates/codex-builder/canonical/brand.md"),
      "---\nrule: brand\n---\nBRAND CANONICAL BODY",
    );
    const body = "Header\n\n{{include:canonical/brand.md}}\n\nFooter";
    const out = await resolveTemplateIncludes(body);
    expect(out).toContain("BRAND CANONICAL BODY");
    expect(out).not.toContain("{{include:");
    expect(out.indexOf("Header")).toBeLessThan(out.indexOf("BRAND CANONICAL BODY"));
    expect(out.indexOf("BRAND CANONICAL BODY")).toBeLessThan(out.indexOf("Footer"));
  });

  it("strips frontmatter from the included file", async () => {
    await fs.writeFile(
      path.join(workspace, "templates/codex-builder/canonical/x.md"),
      "---\nrule: x\n---\nBODY",
    );
    const out = await resolveTemplateIncludes("{{include:canonical/x.md}}");
    expect(out).toBe("BODY");
  });

  it("leaves placeholder verbatim and warns when target is missing", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = await resolveTemplateIncludes("{{include:canonical/missing.md}}");
    expect(out).toContain("{{include:canonical/missing.md}}");
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining(`include "canonical/missing.md" failed`),
    );
  });

  it("does NOT recursively resolve nested {{include}} (depth 1 only)", async () => {
    await fs.writeFile(
      path.join(workspace, "templates/codex-builder/canonical/leaf.md"),
      "---\nrule: leaf\n---\nLEAF + {{include:canonical/other.md}}",
    );
    await fs.writeFile(
      path.join(workspace, "templates/codex-builder/canonical/other.md"),
      "OTHER",
    );
    const out = await resolveTemplateIncludes("{{include:canonical/leaf.md}}");
    expect(out).toContain("LEAF +");
    // The nested placeholder must remain unresolved — that is the contract.
    expect(out).toContain("{{include:canonical/other.md}}");
  });

  it("caches duplicate includes (reads disk once)", async () => {
    await fs.writeFile(
      path.join(workspace, "templates/codex-builder/canonical/dup.md"),
      "DUP",
    );
    const readSpy = vi.spyOn(fs, "readFile");
    const body = "{{include:canonical/dup.md}} | {{include:canonical/dup.md}}";
    const out = await resolveTemplateIncludes(body);
    expect(out).toBe("DUP | DUP");
    const readsForDup = readSpy.mock.calls.filter((c) =>
      String(c[0]).endsWith("canonical/dup.md"),
    );
    expect(readsForDup).toHaveLength(1);
  });

  it("loadInstruction expands includes and hashes the expanded content", async () => {
    await fs.writeFile(
      path.join(workspace, "templates/codex-builder/canonical/v.md"),
      "V-BODY",
    );
    await fs.writeFile(
      path.join(workspace, "templates/codex-builder/foundation/host.md"),
      "---\nname: host\n---\nHOST {{include:canonical/v.md}}",
    );
    const loaded = await loadInstruction({
      name: "host",
      relativePath: "foundation/host.md",
      source: "template_required",
    });
    expect(loaded.content).toBe("HOST V-BODY");
    expect(loaded.meta.hash).toMatch(/^[0-9a-f]{16}$/);
  });
});
