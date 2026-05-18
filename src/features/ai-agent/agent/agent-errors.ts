import { redactSecrets } from "../security/secret-redactor";
import { classifyError, describeError } from "./error-classifier";

export class AgentError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly recoverable = false,
  ) {
    super(redactSecrets(message));
    this.name = "AgentError";
  }
}

export function toSafeAgentError(error: unknown, fallbackCode = "AGENT_FAILED") {
  if (error instanceof AgentError) {
    return { code: error.code, message: error.message, recoverable: error.recoverable };
  }
  const cls = classifyError(error);
  const code = cls.kind === "user_aborted"
    ? "AGENT_ABORTED"
    : cls.kind === "auth_required"
    ? "AGENT_AUTH_REQUIRED"
    : cls.kind === "rate_limited"
    ? "AGENT_RATE_LIMITED"
    : cls.kind === "context_overflow"
    ? "AGENT_CONTEXT_OVERFLOW"
    : fallbackCode;
  const baseMessage = error instanceof Error ? error.message : "Agent failed.";
  return {
    code,
    message: redactSecrets(`[${describeError(cls)}] ${baseMessage}`),
    recoverable: cls.retryable,
  };
}
