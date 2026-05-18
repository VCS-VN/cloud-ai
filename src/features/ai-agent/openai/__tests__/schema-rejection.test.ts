import { describe, expect, it } from "vitest";
import { isSchemaRejectionError } from "../schema-error-detection";

describe("isSchemaRejectionError", () => {
  it("matches 400 invalid schema error from upstream", () => {
    const err = new Error('400 [codex/gpt-5.5] [400]: {"error":{"message":"Invalid sch...');
    expect(isSchemaRejectionError(err)).toBe(true);
  });

  it("matches invalid_schema code", () => {
    const err = new Error('400: invalid_schema specified for response_format');
    expect(isSchemaRejectionError(err)).toBe(true);
  });

  it("matches schema validation rejection", () => {
    const err = new Error('400: schema validation failed for required fields');
    expect(isSchemaRejectionError(err)).toBe(true);
  });

  it("matches unsupported response_format", () => {
    const err = new Error('400: model does not support response_format json_schema');
    expect(isSchemaRejectionError(err)).toBe(true);
  });

  it("rejects 500 errors", () => {
    const err = new Error('500: internal server error');
    expect(isSchemaRejectionError(err)).toBe(false);
  });

  it("rejects unrelated 400 errors", () => {
    const err = new Error('400: invalid prompt content');
    expect(isSchemaRejectionError(err)).toBe(false);
  });

  it("rejects non-Error values", () => {
    expect(isSchemaRejectionError("a string")).toBe(false);
    expect(isSchemaRejectionError(null)).toBe(false);
    expect(isSchemaRejectionError(undefined)).toBe(false);
    expect(isSchemaRejectionError({})).toBe(false);
  });
});
