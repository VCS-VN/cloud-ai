import { describe, expect, it } from "vitest";
import { isValidationCommandAllowed, normalizeValidationCommand } from "./command-allowlist.server";

describe("validation command allowlist", () => {
  it("allows normalized package validation scripts", () => {
    expect(isValidationCommandAllowed("npm run typecheck")).toBe(true);
    expect(isValidationCommandAllowed("pnpm lint")).toBe(true);
    expect(normalizeValidationCommand("  npm   run   build  ")).toBe("npm run build");
  });

  it("blocks arbitrary shell commands and chaining", () => {
    expect(isValidationCommandAllowed("rm -rf .")).toBe(false);
    expect(isValidationCommandAllowed("npm run lint && cat .env")).toBe(false);
    expect(isValidationCommandAllowed("npm run test -- --runInBand")).toBe(false);
  });
});
