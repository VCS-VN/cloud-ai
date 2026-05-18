import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  PermissionDeniedError,
  RateLimitError,
} from "openai";

export type AgentErrorClass =
  | { kind: "transient_network"; retryable: true; cause: unknown }
  | { kind: "rate_limited"; retryable: true; retryAfterMs?: number; cause: unknown }
  | { kind: "server_error"; retryable: true; status?: number; cause: unknown }
  | { kind: "context_overflow"; retryable: false; cause: unknown }
  | { kind: "auth_required"; retryable: false; cause: unknown }
  | { kind: "bad_request"; retryable: false; cause: unknown }
  | { kind: "user_aborted"; retryable: false; cause: unknown }
  | { kind: "unknown"; retryable: false; cause: unknown };

export function classifyError(error: unknown): AgentErrorClass {
  if (error instanceof APIUserAbortError) {
    return { kind: "user_aborted", retryable: false, cause: error };
  }
  if (error instanceof APIConnectionTimeoutError || error instanceof APIConnectionError) {
    return { kind: "transient_network", retryable: true, cause: error };
  }
  if (error instanceof RateLimitError) {
    return { kind: "rate_limited", retryable: true, retryAfterMs: parseRetryAfter(error), cause: error };
  }
  if (error instanceof InternalServerError) {
    return { kind: "server_error", retryable: true, status: error.status, cause: error };
  }
  if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) {
    return { kind: "auth_required", retryable: false, cause: error };
  }
  if (error instanceof BadRequestError) {
    if (isContextOverflowError(error)) {
      return { kind: "context_overflow", retryable: false, cause: error };
    }
    return { kind: "bad_request", retryable: false, cause: error };
  }

  // Fallback: AbortError from native AbortController
  if (error instanceof Error && error.name === "AbortError") {
    return { kind: "user_aborted", retryable: false, cause: error };
  }

  // Detect Node fetch transient errors by message — last resort
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("econnreset") || msg.includes("etimedout") || msg.includes("socket hang up") || msg.includes("network") || msg.includes("fetch failed")) {
      return { kind: "transient_network", retryable: true, cause: error };
    }
  }

  return { kind: "unknown", retryable: false, cause: error };
}

export function isRetryable(cls: AgentErrorClass): boolean {
  return cls.retryable;
}

export function describeError(cls: AgentErrorClass): string {
  const base = cls.kind;
  if (cls.kind === "rate_limited" && cls.retryAfterMs) return `${base}(retry_after=${cls.retryAfterMs}ms)`;
  if (cls.kind === "server_error" && cls.status) return `${base}(status=${cls.status})`;
  return base;
}

function parseRetryAfter(error: RateLimitError): number | undefined {
  const headers = (error as { headers?: Headers | Record<string, string> }).headers;
  if (!headers) return undefined;
  const get = (key: string) =>
    typeof (headers as Headers).get === "function"
      ? (headers as Headers).get(key)
      : (headers as Record<string, string>)[key];
  const retryAfter = get("retry-after") ?? get("Retry-After");
  if (!retryAfter) return undefined;
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  // RFC 7231 HTTP-date format — best-effort
  const dateMs = Date.parse(retryAfter);
  if (Number.isFinite(dateMs)) {
    const diff = dateMs - Date.now();
    return diff > 0 ? diff : undefined;
  }
  return undefined;
}

function isContextOverflowError(error: BadRequestError): boolean {
  const msg = (error.message ?? "").toLowerCase();
  const code = (error.code ?? "").toString().toLowerCase();
  return (
    code.includes("context_length") ||
    msg.includes("context length") ||
    msg.includes("maximum context") ||
    msg.includes("token limit")
  );
}
