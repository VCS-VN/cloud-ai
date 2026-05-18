import { describe, expect, it } from "vitest";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  RateLimitError,
} from "openai";
import { classifyError, isRetryable } from "../error-classifier";

function makeRateLimit(retryAfterSeconds?: string) {
  const headers = new Headers();
  if (retryAfterSeconds) headers.set("retry-after", retryAfterSeconds);
  return new RateLimitError(429, undefined, "rate limited", headers);
}

describe("classifyError", () => {
  it("classifies APIConnectionError as transient_network and retryable", () => {
    const cls = classifyError(new APIConnectionError({ message: "boom" }));
    expect(cls.kind).toBe("transient_network");
    expect(isRetryable(cls)).toBe(true);
  });

  it("classifies APIConnectionTimeoutError as transient_network", () => {
    const cls = classifyError(new APIConnectionTimeoutError({ message: "slow" }));
    expect(cls.kind).toBe("transient_network");
    expect(isRetryable(cls)).toBe(true);
  });

  it("classifies RateLimitError and parses retry-after seconds", () => {
    const cls = classifyError(makeRateLimit("3"));
    expect(cls.kind).toBe("rate_limited");
    expect(isRetryable(cls)).toBe(true);
    expect(cls.kind === "rate_limited" && cls.retryAfterMs).toBe(3000);
  });

  it("classifies InternalServerError as server_error and retryable", () => {
    const cls = classifyError(new InternalServerError(500, undefined, "oops", new Headers()));
    expect(cls.kind).toBe("server_error");
    expect(isRetryable(cls)).toBe(true);
  });

  it("classifies AuthenticationError as auth_required and not retryable", () => {
    const cls = classifyError(new AuthenticationError(401, undefined, "no", new Headers()));
    expect(cls.kind).toBe("auth_required");
    expect(isRetryable(cls)).toBe(false);
  });

  it("classifies BadRequest with context_length as context_overflow", () => {
    const cls = classifyError(
      new BadRequestError(400, undefined, "context length 200000 exceeds maximum context", new Headers()),
    );
    expect(cls.kind).toBe("context_overflow");
    expect(isRetryable(cls)).toBe(false);
  });

  it("classifies APIUserAbortError as user_aborted", () => {
    const cls = classifyError(new APIUserAbortError());
    expect(cls.kind).toBe("user_aborted");
    expect(isRetryable(cls)).toBe(false);
  });

  it("classifies generic AbortError by name", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    const cls = classifyError(err);
    expect(cls.kind).toBe("user_aborted");
  });

  it("classifies network keywords in message as transient_network", () => {
    const cls = classifyError(new Error("ECONNRESET"));
    expect(cls.kind).toBe("transient_network");
    expect(isRetryable(cls)).toBe(true);
  });

  it("classifies unknown errors as not retryable", () => {
    const cls = classifyError(new Error("something weird"));
    expect(cls.kind).toBe("unknown");
    expect(isRetryable(cls)).toBe(false);
  });
});
