import { describe, expect, it } from "vitest";
import { buildContextBundle } from "@/features/agents/codex/context/context-builder.server";
import type { LoadedInstruction } from "@/features/agents/codex/context/instruction-loader.server";

function baseInput(overrides: Partial<Parameters<typeof buildContextBundle>[0]> = {}) {
  return {
    projectId: "proj-1",
    userId: "user-1",
    draftWorkspacePath: "/tmp/draft",
    userPrompt: "Build me a homepage",
    locale: "vi-VN",
    projectSummary: null,
    fileManifest: ["app/routes/index.tsx"],
    protectedPaths: { blocked: [], allowedAudit: [] },
    validationRules: { typecheck: true, build: true, previewHealth: true },
    selectedInstructions: [] as LoadedInstruction[],
    ...overrides,
  };
}

const sampleInstruction: LoadedInstruction = {
  meta: {
    name: "retail-foundation",
    source: "template_required",
    version: "1.0.0",
    hash: "abc123",
    loaded: true,
  },
  content: "BODY",
};

describe("buildContextBundle", () => {
  it("wraps a selected instruction with the expected attributes", () => {
    const out = buildContextBundle(baseInput({ selectedInstructions: [sampleInstruction] }));
    expect(out.prompt).toContain(
      '<selected_instruction name="retail-foundation" source="template_required" version="1.0.0" hash="abc123">',
    );
    expect(out.prompt).toContain("</selected_instruction>");
    expect(out.prompt).toContain("BODY");
  });

  it("emits the locale block", () => {
    const out = buildContextBundle(baseInput({ locale: "vi-VN" }));
    expect(out.prompt).toContain("<locale>vi-VN</locale>");
  });

  it("emits the user prompt block with the prompt text", () => {
    const out = buildContextBundle(baseInput({ userPrompt: "Hello world" }));
    expect(out.prompt).toContain("<user_prompt>");
    expect(out.prompt).toContain("Hello world");
    expect(out.prompt).toContain("</user_prompt>");
  });

  it("returns selectedInstructionMeta one-to-one with the input instructions", () => {
    const second: LoadedInstruction = {
      meta: {
        name: "edit-system",
        source: "template_recommended",
        version: "2.0.0",
        hash: "def456",
        loaded: true,
      },
      content: "OTHER",
    };
    const out = buildContextBundle(
      baseInput({ selectedInstructions: [sampleInstruction, second] }),
    );
    expect(out.selectedInstructionMeta).toEqual([sampleInstruction.meta, second.meta]);
  });

  it("truncates manifests longer than 200 entries with a (+N more) marker", () => {
    const fileManifest = Array.from({ length: 250 }, (_, i) => `app/file-${i}.tsx`);
    const out = buildContextBundle(baseInput({ fileManifest }));
    expect(out.prompt).toContain("(+50 more)");
    expect(out.prompt).toContain("app/file-0.tsx");
    expect(out.prompt).not.toContain("app/file-200.tsx");
  });

  it("renders the no-summary placeholder when projectSummary is null", () => {
    const out = buildContextBundle(baseInput({ projectSummary: null }));
    expect(out.prompt).toContain("(no project summary yet)");
  });

  it("renders a scope_analysis block with the relevant files and approach", () => {
    const out = buildContextBundle(
      baseInput({
        scopeAnalysis: {
          relevantFiles: ["src/routes/index.tsx"],
          approach: "Edit the hero heading.",
        },
      }),
    );
    expect(out.prompt).toContain("<scope_analysis>");
    expect(out.prompt).toContain("- src/routes/index.tsx");
    expect(out.prompt).toContain("approach: Edit the hero heading.");
    expect(out.prompt).toContain("</scope_analysis>");
  });

  it("omits the scope_analysis block when scopeAnalysis is null", () => {
    const out = buildContextBundle(baseInput({ scopeAnalysis: null }));
    expect(out.prompt).not.toContain("<scope_analysis>");
  });

  it("omits the scope_analysis block when relevantFiles is empty", () => {
    const out = buildContextBundle(
      baseInput({ scopeAnalysis: { relevantFiles: [], approach: "unsure" } }),
    );
    expect(out.prompt).not.toContain("<scope_analysis>");
  });
});
