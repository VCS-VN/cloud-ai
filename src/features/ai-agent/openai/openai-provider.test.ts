import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseStructuredText } from "./structured-output-parser";

const testSchema = z.object({
  status: z.literal("ok"),
  message: z.string(),
});

describe("OpenAIProvider structured output parsing", () => {
  it("accepts valid JSON that matches the schema", () => {
    const parsed = parseStructuredText('{"status":"ok","message":"ready"}', testSchema, "test_schema", "completed");
    expect(parsed).toEqual({ status: "ok", message: "ready" });
  });

  it("recovers a single fenced JSON object", () => {
    const parsed = parseStructuredText('```json\n{"status":"ok","message":"ready"}\n```', testSchema, "test_schema", "completed");
    expect(parsed).toEqual({ status: "ok", message: "ready" });
  });

  it("rejects free-form text without recoverable JSON", () => {
    expect(() => parseStructuredText("Sure, I can do that.", testSchema, "test_schema", "completed")).toThrow(/not valid JSON/);
  });

  it("rejects partial JSON", () => {
    expect(() => parseStructuredText('{"status":"ok"', testSchema, "test_schema", "completed")).toThrow(/not valid JSON/);
  });

  it("rejects JSON that does not match the schema", () => {
    expect(() => parseStructuredText('{"status":"ok"}', testSchema, "test_schema", "completed")).toThrow(/failed schema validation/);
  });
});
