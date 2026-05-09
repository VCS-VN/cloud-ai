import type { StreamErrorCode } from "@/shared/project-types";

export class AIProviderConfigurationError extends Error {
  constructor(readonly code: StreamErrorCode, message: string) {
    super(message);
    this.name = "AIProviderConfigurationError";
  }
}
