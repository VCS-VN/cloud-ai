import type { AgentStreamEvent } from "./agent-events";
import { AgentOrchestrator, type HandlePromptInput } from "./agent-orchestrator.server";

export type AgentRunLogFields = {
  runId?: string;
  projectId: string;
  userId?: string;
  intent?: string;
  modelUsed?: string;
  inputTokenEstimate?: number;
  outputTokenEstimate?: number;
  affectedFiles?: string[];
  validationOk?: boolean;
  durationMs?: number;
  errorCode?: string;
};

export function createAgentRunLogFields(fields: AgentRunLogFields): AgentRunLogFields {
  return {
    runId: fields.runId,
    projectId: fields.projectId,
    userId: fields.userId,
    intent: fields.intent,
    modelUsed: fields.modelUsed,
    inputTokenEstimate: fields.inputTokenEstimate,
    outputTokenEstimate: fields.outputTokenEstimate,
    affectedFiles: fields.affectedFiles ?? [],
    validationOk: fields.validationOk,
    durationMs: fields.durationMs,
    errorCode: fields.errorCode,
  };
}

export class AgentRunner {
  constructor(private readonly orchestrator: AgentOrchestrator) {}

  handlePromptStream(input: HandlePromptInput): AsyncGenerator<AgentStreamEvent> {
    return this.orchestrator.handlePromptStream(input);
  }
}
