import { describe, expect, it, vi } from "vitest";
import { APIConnectionError, AuthenticationError } from "openai";
import { withRetry, computeDelay } from "../retry";

describe("withRetry", () => {
  it("returns immediately on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { maxAttempts: 3 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries retryable errors and eventually succeeds", async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls += 1;
      if (calls < 3) throw new APIConnectionError({ message: "boom" });
      return "ok";
    });
    const result = await withRetry(fn, { maxAttempts: 4, baseDelayMs: 1 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-retryable errors", async () => {
    const err = new AuthenticationError(401, undefined, "no", new Headers());
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { maxAttempts: 4, baseDelayMs: 1 })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxAttempts on retryable errors", async () => {
    const err = new APIConnectionError({ message: "boom" });
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("aborts immediately when signal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = vi.fn();
    await expect(withRetry(fn, { maxAttempts: 3, signal: controller.signal })).rejects.toThrow(/abort/i);
    expect(fn).not.toHaveBeenCalled();
  });

  it("aborts during sleep between retries", async () => {
    const controller = new AbortController();
    const err = new APIConnectionError({ message: "boom" });
    const fn = vi.fn().mockRejectedValue(err);
    setTimeout(() => controller.abort(), 5);
    await expect(
      withRetry(fn, { maxAttempts: 5, baseDelayMs: 200, signal: controller.signal }),
    ).rejects.toThrow(/abort/i);
  });

  it("invokes onAttempt for each retry", async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls += 1;
      if (calls < 2) throw new APIConnectionError({ message: "boom" });
      return "ok";
    });
    const onAttempt = vi.fn();
    await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1, onAttempt });
    expect(onAttempt).toHaveBeenCalledTimes(1);
    expect(onAttempt.mock.calls[0][0].cls.kind).toBe("transient_network");
  });
});

describe("computeDelay", () => {
  it("returns retryAfterMs for rate_limited", () => {
    const delay = computeDelay(1, 200, 30_000, {
      kind: "rate_limited",
      retryable: true,
      retryAfterMs: 5000,
      cause: null,
    });
    expect(delay).toBe(5000);
  });

  it("caps rate_limited at maxDelayMs", () => {
    const delay = computeDelay(1, 200, 1000, {
      kind: "rate_limited",
      retryable: true,
      retryAfterMs: 60_000,
      cause: null,
    });
    expect(delay).toBe(1000);
  });

  it("uses exponential backoff for transient_network", () => {
    const delay = computeDelay(2, 200, 30_000, {
      kind: "transient_network",
      retryable: true,
      cause: null,
    });
    expect(delay).toBeGreaterThanOrEqual(360);
    expect(delay).toBeLessThanOrEqual(440);
  });
});
