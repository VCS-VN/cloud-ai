import { readFileSync } from "node:fs";

describe("init source template import aliases", () => {
  it("keeps generated storefront templates on @ alias", () => {
    const source = readFileSync("src/features/ai-agent/source/init-source.server.ts", "utf8");

    expect(source).toContain("'@': fileURLToPath");
    expect(source).toContain('paths: { "@/*": ["./src/*"] }');
    expect(source).toContain("@/styles/app.css");
    expect(source).toContain("@/lib/website-config");
    expect(source).not.toContain("~/");
  });
});
