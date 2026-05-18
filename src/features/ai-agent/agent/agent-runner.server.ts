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

const projectMutationLocks = new Map<string, Promise<void>>();

export async function withProjectMutationLock<T>(input: {
  projectId: string;
  run: () => Promise<T>;
}): Promise<T> {
  const previous = projectMutationLocks.get(input.projectId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  projectMutationLocks.set(input.projectId, previous.then(() => current));

  await previous;
  try {
    return await input.run();
  } finally {
    release();
    if (projectMutationLocks.get(input.projectId) === current) {
      projectMutationLocks.delete(input.projectId);
    }
  }
}

export class AgentRunner {
  constructor(private readonly orchestrator: AgentOrchestrator) {}

  async *handlePromptStream(input: HandlePromptInput): AsyncGenerator<AgentStreamEvent> {
    const previous = projectMutationLocks.get(input.projectId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    projectMutationLocks.set(input.projectId, previous.then(() => current));

    await previous;
    try {
      yield* this.orchestrator.handlePromptStream(input);
    } finally {
      release();
      if (projectMutationLocks.get(input.projectId) === current) {
        projectMutationLocks.delete(input.projectId);
      }
    }
  }
}
