import { classifyError, describeError, isRetryable, type AgentErrorClass } from "./error-classifier";

export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
  onAttempt?: (info: { attempt: number; cls: AgentErrorClass; delayMs: number }) => void;
};

const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_BASE_DELAY_MS = 200;
const DEFAULT_MAX_DELAY_MS = 30_000;

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = opts.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (opts.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const cls = classifyError(err);
      if (!isRetryable(cls) || attempt === maxAttempts) {
        throw err;
      }
      const delayMs = computeDelay(attempt, baseDelayMs, maxDelayMs, cls);
      opts.onAttempt?.({ attempt, cls, delayMs });
      await sleep(delayMs, opts.signal);
    }
  }
  throw lastError;
}

export function computeDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  cls: AgentErrorClass,
): number {
  if (cls.kind === "rate_limited" && cls.retryAfterMs) {
    return Math.min(cls.retryAfterMs, maxDelayMs);
  }
  const exp = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = 0.9 + Math.random() * 0.2;
  return Math.min(Math.round(exp * jitter), maxDelayMs);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export { describeError };
