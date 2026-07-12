import { describe, expect, it } from "vitest";
import {
  buildRetailSuggestionsPrompt,
  generateRetailSuggestions,
} from "@/features/agents/codex/runtime/retail-suggestions.server";

const VALID = `[
  "Add a checkout page",
  "Feature bestsellers on the home hero",
  "Show customer reviews on product pages",
  "Add a limited-time promo banner"
]`;

describe("generateRetailSuggestions — robust parser", () => {
  it("accepts a bare JSON array", async () => {
    const result = await generateRetailSuggestions({
      runTurn: async () => ({ finalResponse: VALID }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.suggestions).toHaveLength(4);
      expect(result.suggestions[0]).toBe("Add a checkout page");
    }
  });

  it("accepts JSON wrapped in ```json fence", async () => {
    const result = await generateRetailSuggestions({
      runTurn: async () => ({ finalResponse: "```json\n" + VALID + "\n```" }),
    });
    expect(result.ok).toBe(true);
  });

  it('accepts {"suggestions": [...]} object wrapper', async () => {
    const result = await generateRetailSuggestions({
      runTurn: async () => ({ finalResponse: `{"suggestions": ${VALID}}` }),
    });
    expect(result.ok).toBe(true);
  });

  it("accepts JSON buried in narrative prose", async () => {
    const buried = `Here are some ideas:\n\n${VALID}\n\nHope these help!`;
    const result = await generateRetailSuggestions({
      runTurn: async () => ({ finalResponse: buried }),
    });
    expect(result.ok).toBe(true);
  });

  it("truncates over-long entries instead of failing", async () => {
    const long = "x".repeat(200);
    const result = await generateRetailSuggestions({
      runTurn: async () => ({ finalResponse: JSON.stringify([long, "Add a cart page"]) }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.suggestions[0].length).toBeLessThanOrEqual(80);
    }
  });

  it("rejects entries that leak file paths / code (privacy-safe)", async () => {
    const unsafe = JSON.stringify(["Edit src/routes/index.tsx", "Add a cart"]);
    const result = await generateRetailSuggestions({
      runTurn: async () => ({ finalResponse: unsafe }),
    });
    expect(result.ok).toBe(false);
  });

  it("retries once on invalid JSON, then fails with reason", async () => {
    let calls = 0;
    const result = await generateRetailSuggestions({
      runTurn: async () => {
        calls++;
        return { finalResponse: "totally not json" };
      },
    });
    expect(result.ok).toBe(false);
    expect(calls).toBe(2);
    if (!result.ok) expect(result.reason).toContain("invalid JSON");
  });
});

describe("buildRetailSuggestionsPrompt", () => {
  it("lists missing storefront pages given generated slugs", () => {
    const prompt = buildRetailSuggestionsPrompt({
      storeName: "Acme Shop",
      recentUserPrompt: "build the home page",
      generatedPageSlugs: ["home"],
    });
    expect(prompt).toContain("Acme Shop");
    expect(prompt).toContain("Pages that already exist: home");
    expect(prompt).toContain("Checkout"); // a not-yet-built page label
  });

  it("handles the no-pages-yet case", () => {
    const prompt = buildRetailSuggestionsPrompt({});
    expect(prompt).toContain("No storefront pages exist yet.");
  });
});
