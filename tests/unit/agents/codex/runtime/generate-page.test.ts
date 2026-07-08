import { describe, it, expect } from "vitest";
import {
  parseGeneratePageCommand,
  findKnownPage,
  KNOWN_PAGES,
} from "@/features/agents/codex/runtime/generate-page";

describe("parseGeneratePageCommand", () => {
  it("returns null for a normal prompt", () => {
    expect(parseGeneratePageCommand("make the hero bigger")).toBeNull();
  });

  it("returns null when the command has no slug", () => {
    expect(parseGeneratePageCommand("/generate-page")).toBeNull();
    expect(parseGeneratePageCommand("/generate-page   ")).toBeNull();
  });

  it("parses a known page with a description", () => {
    const parsed = parseGeneratePageCommand(
      "/generate-page checkout add a discount code field",
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.target.slug).toBe("checkout");
    expect(parsed!.target.isKnownPage).toBe(true);
    expect(parsed!.target.route).toBe("src/routes/checkout.tsx");
    expect(parsed!.target.spec).toBe("pages/checkout.md");
    expect(parsed!.restPrompt).toBe("add a discount code field");
  });

  it("parses a known page with no description", () => {
    const parsed = parseGeneratePageCommand("/generate-page orders");
    expect(parsed!.target.slug).toBe("orders");
    expect(parsed!.target.isKnownPage).toBe(true);
    expect(parsed!.restPrompt).toBe("");
  });

  it("lowercases the slug", () => {
    const parsed = parseGeneratePageCommand("/generate-page Checkout tweak");
    expect(parsed!.target.slug).toBe("checkout");
    expect(parsed!.target.isKnownPage).toBe(true);
  });

  it("marks an unknown slug as a custom page with no route/spec", () => {
    const parsed = parseGeneratePageCommand(
      "/generate-page wishlist a saved-items page",
    );
    expect(parsed!.target.slug).toBe("wishlist");
    expect(parsed!.target.isKnownPage).toBe(false);
    expect(parsed!.target.route).toBeUndefined();
    expect(parsed!.target.spec).toBeUndefined();
    expect(parsed!.restPrompt).toBe("a saved-items page");
  });

  it("tolerates leading whitespace", () => {
    const parsed = parseGeneratePageCommand("  /generate-page cart  ");
    expect(parsed!.target.slug).toBe("cart");
    expect(parsed!.restPrompt).toBe("");
  });
});

describe("findKnownPage", () => {
  it("resolves every known slug to a unique route", () => {
    const routes = new Set(KNOWN_PAGES.map((p) => p.route));
    expect(routes.size).toBe(KNOWN_PAGES.length);
    expect(findKnownPage("product-detail")?.route).toBe(
      "src/routes/products/$productId.tsx",
    );
  });

  it("returns undefined for an unknown slug", () => {
    expect(findKnownPage("wishlist")).toBeUndefined();
  });
});
