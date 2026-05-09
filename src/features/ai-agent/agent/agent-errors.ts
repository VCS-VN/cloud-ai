import { redactSecrets } from "../security/secret-redactor";

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
  return {
    code: fallbackCode,
    message: redactSecrets(error instanceof Error ? error.message : "Agent failed."),
    recoverable: false,
  };
}
