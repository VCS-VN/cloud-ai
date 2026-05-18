import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  resolve(process.cwd(), "src/features/ai-agent/source/init-source.server.ts"),
  "utf8",
);
const PROMPT_SOURCE = readFileSync(
  resolve(process.cwd(), "src/ai/prompt-builder.ts"),
  "utf8",
);

describe("generated project API base env", () => {
  it("creates generated project .env with customer API base URL", () => {
    expect(SOURCE).toContain('path: ".env"');
    expect(SOURCE).toContain("VITE_API_BASE_URL=https://customer-api.myepis.cloud");
  });

  it("includes init prompt instruction for generated project .env", () => {
    expect(PROMPT_SOURCE).toContain(
      "create generated project-detail .env with VITE_API_BASE_URL=https://customer-api.myepis.cloud",
    );
  });
});
