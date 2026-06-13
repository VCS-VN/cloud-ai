import { Codex, type Thread, type ThreadEvent, type Usage } from "@openai/codex-sdk";
import type { CodexEnvAvailable } from "@/server/env/codex";
import {
  PROJECT_READ_SKILL_TOOL_NAME,
  projectReadSkill,
  type ProjectReadSkillCallbacks,
  type ProjectReadSkillResult,
} from "@/features/agents/codex/skills/project-read-skill.tool.server";

export type CodexSandboxMode = "read-only" | "workspace-write" | "danger-full-access";
export type CodexReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

export type CodexThreadInput = {
  env: CodexEnvAvailable;
  draftWorkspacePath: string;
  skillToolCallbacks?: ProjectReadSkillCallbacks;
  sandboxMode?: CodexSandboxMode;
  modelReasoningEffort?: CodexReasoningEffort;
};

export type CodexTurnInput = {
  prompt: string;
  signal?: AbortSignal;
};

export type CodexTurnSummary = {
  finalResponse: string;
  usage: Usage | null;
  fileChanges: string[];
  skillToolCalls: { name: string; result: ProjectReadSkillResult }[];
  reasoning: string[];
};

/**
 * Per-item progress signal fired by `runTurnStreamed` as the codex turn unfolds.
 * Decoupled from the SDK's ThreadItem shape so the bridge can stay typed
 * without leaking SDK types into UI/translator layers.
 */
export type CodexProgressEvent =
  | { kind: "reasoning"; text: string }
  | { kind: "file_change_started"; paths: string[] }
  | { kind: "file_change_completed"; paths: string[]; failed: boolean }
  | { kind: "command_started"; command: string }
  | {
      kind: "command_completed";
      command: string;
      exitCode: number | null;
      failed: boolean;
    }
  | { kind: "mcp_tool_call_started"; server: string; tool: string }
  | {
      kind: "mcp_tool_call_completed";
      server: string;
      tool: string;
      failed: boolean;
    }
  | { kind: "reconnect_notice"; count: number };

const MAX_RETRY_ATTEMPTS = 10;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 60_000;

function computeBackoffDelay(attempt: number): number {
  // Exponential backoff with full jitter: delay = min(base * 2^attempt, cap) * random(0..1)
  // Bounded by MAX_RETRY_DELAY_MS so we never wait longer than 60s between attempts.
  const exp = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, attempt), MAX_RETRY_DELAY_MS);
  return Math.floor(Math.random() * exp);
}

function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && (error.name === "AbortError" || /aborted/i.test(error.message))) {
    return true;
  }
  return false;
}

async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
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
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

const GATEWAY_ERROR_PATTERNS: RegExp[] = [
  /^\s*\[gateway error[: ]/i,
  /^\s*\[upstream model error/i,
  /^\s*upstream model error/i,
  /\bplease retry in a moment\b/i,
  /^\s*\[rate.?limited?\b/i,
];

function isSoftGatewayError(text: string | null | undefined): boolean {
  if (!text) return false;
  const head = text.slice(0, 240);
  return GATEWAY_ERROR_PATTERNS.some((re) => re.test(head));
}

export class GatewaySoftError extends Error {
  constructor(public readonly preview: string) {
    super(`gateway_soft_error: ${preview.slice(0, 160)}`);
    this.name = "GatewaySoftError";
  }
}

/**
 * Thrown when a streamed turn finished only because the CLI's upstream
 * WebSocket reconnect attempts were exhausted, leaving a stub turn: one
 * preamble `agent_message`, no file changes, no skill calls, no reasoning.
 * The codex CLI emits "Reconnecting... N/5 (stream disconnected before
 * completion: WebSocket protocol error: Handshake not finished)" `error`
 * events, then closes the turn with whatever partial text it had instead of
 * doing the work. Accepting that as success silently drops the build. We
 * throw so runTurnStreamed's retry loop respawns a FRESH CLI process (fresh
 * WS) and re-runs the turn.
 */
export class StreamReconnectError extends Error {
  constructor(public readonly reconnectCount: number) {
    super(`stream_reconnect_degenerate_turn: ${reconnectCount} reconnects, no work produced`);
    this.name = "StreamReconnectError";
  }
}

// The CLI surfaces upstream WS reconnect notices as `error` events with this
// canonical phrasing: "Reconnecting... N/M (...)". The two captures expose
// the reconnect count and total so the post-loop gate can detect a budget
// exhaustion (N === M) and force a retry on a fresh CLI process.
const RECONNECT_NOTICE_RE = /\breconnecting\.{0,3}\s*(\d+)\s*\/\s*(\d+)/i;

// On the HTTP `responses` transport, codex replays the full transcript into
// input[] on every model round-trip within a turn. A replayed reasoning item
// carries no `content` unless the provider echoes `reasoning.encrypted_content`.
// A provider that strips it rejects the turn with `content is required
// (input[N].content)`. This is DETERMINISTIC for that provider — retrying the
// same turn just replays the same broken transcript, so the 10x backoff loop
// only prolongs a frozen UI before the inevitable failure. Detect it and fail
// fast with an actionable message instead.
const REASONING_REPLAY_RE =
  /content is required[^]*input\[\d+\]\.content|input\[\d+\]\.content[^]*content is required/i;

function isReasoningReplayError(text: string | null | undefined): boolean {
  if (!text) return false;
  return REASONING_REPLAY_RE.test(text);
}

/**
 * Thrown when the provider rejects a replayed reasoning item with
 * `content is required (input[N].content)`. See REASONING_REPLAY_RE. This is a
 * provider capability gap (it strips `reasoning.encrypted_content` and does not
 * support store + previous_response_id), not a transient fault — runTurn must
 * NOT retry it.
 */
export class ReasoningReplayError extends Error {
  constructor(public readonly preview: string) {
    super(
      "provider_drops_reasoning_content: the provider rejected a replayed " +
        "reasoning item (content is required). It must preserve " +
        "reasoning.encrypted_content (or support store + previous_response_id) " +
        "for multi-step build turns over the HTTP responses transport.",
    );
    this.name = "ReasoningReplayError";
  }
}

export class BoundedCodexThread {
  private readonly thread: Thread;
  private readonly skillToolCallbacks?: ProjectReadSkillCallbacks;

  constructor(thread: Thread, skillToolCallbacks?: ProjectReadSkillCallbacks) {
    this.thread = thread;
    this.skillToolCallbacks = skillToolCallbacks;
  }

  async runTurn(input: CodexTurnInput): Promise<CodexTurnSummary> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      if (input.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      try {
        const summary = await this.runTurnOnce(input);
        if (attempt > 0) {
          console.log(
            JSON.stringify({
              event: "codex_turn_retry_succeeded",
              attempt,
              previousFailures: attempt,
            }),
          );
        }
        return summary;
      } catch (error) {
        lastError = error;
        if (isAbortError(error)) throw error;
        // Deterministic provider capability gap — retrying replays the same
        // broken transcript. Surface it immediately instead of looping.
        if (error instanceof ReasoningReplayError) throw error;
        const isLastAttempt = attempt === MAX_RETRY_ATTEMPTS - 1;
        const waitMs = isLastAttempt ? 0 : computeBackoffDelay(attempt);
        console.warn(
          JSON.stringify({
            event: "codex_turn_failed",
            attempt: attempt + 1,
            maxAttempts: MAX_RETRY_ATTEMPTS,
            isLastAttempt,
            waitMs,
            rawMessage: error instanceof Error ? error.message : String(error),
            rawName: error instanceof Error ? error.name : undefined,
          }),
        );
        if (isLastAttempt) break;
        await delay(waitMs, input.signal);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(typeof lastError === "string" ? lastError : "codex turn ended unexpectedly");
  }

  private async runTurnOnce(input: CodexTurnInput): Promise<CodexTurnSummary> {
    const turn = await this.thread.run(input.prompt, { signal: input.signal });
    const fileChanges: string[] = [];
    const skillToolCalls: { name: string; result: ProjectReadSkillResult }[] = [];
    const reasoning: string[] = [];
    const itemTypeCounts: Record<string, number> = {};
    for (const item of turn.items) {
      itemTypeCounts[item.type] = (itemTypeCounts[item.type] ?? 0) + 1;
      if (item.type === "file_change") {
        for (const change of item.changes) fileChanges.push(change.path);
      }
      if (item.type === "reasoning" && typeof item.text === "string" && item.text.trim().length > 0) {
        reasoning.push(item.text);
      }
      if (item.type === "mcp_tool_call" && item.tool === PROJECT_READ_SKILL_TOOL_NAME) {
        const args = (item.arguments ?? {}) as { name?: unknown };
        const result = projectReadSkill({ name: args.name }, this.skillToolCallbacks);
        skillToolCalls.push({
          name: typeof args.name === "string" ? args.name : "<invalid>",
          result,
        });
      }
    }
    // Some upstream gateways respond with a soft-error string in finalResponse
    // (status 200, single agent_message, no file_change, no tool call) when
    // the model is rate-limited or the gateway upstream times out. The SDK
    // doesn't surface this as an error, so the retry loop never engages and
    // downstream parsers (classifier, planner, summary) silently treat the
    // error text as the model's answer. Detect the canonical phrasings and
    // throw so runTurn's exponential backoff kicks in.
    if (
      fileChanges.length === 0 &&
      skillToolCalls.length === 0 &&
      isSoftGatewayError(turn.finalResponse)
    ) {
      console.warn(
        JSON.stringify({
          event: "codex_turn_soft_gateway_error",
          finalResponsePreview: (turn.finalResponse ?? "").slice(0, 240),
          itemCount: turn.items.length,
          itemTypeCounts,
        }),
      );
      throw new GatewaySoftError(turn.finalResponse ?? "");
    }
    console.log(
      JSON.stringify({
        event: "codex_turn_completed",
        promptLength: input.prompt.length,
        finalResponseLength: turn.finalResponse?.length ?? 0,
        finalResponsePreview: (turn.finalResponse ?? "").slice(0, 240),
        itemCount: turn.items.length,
        itemTypeCounts,
        fileChangesCount: fileChanges.length,
        fileChangesPreview: fileChanges.slice(0, 5),
        skillToolCallsCount: skillToolCalls.length,
        reasoningCount: reasoning.length,
      }),
    );
    return {
      finalResponse: turn.finalResponse,
      usage: turn.usage,
      fileChanges,
      skillToolCalls,
      reasoning,
    };
  }

  /**
   * Streaming sibling of `runTurn`. Consumes the SDK's `runStreamed` event
   * generator, firing `onProgress` as items land so the UI shows live
   * step-progress instead of a frozen screen between turn start and end.
   * Returns the SAME CodexTurnSummary as `runTurn` (same retry loop, same
   * soft-gateway gate, same skill-tool side effects), so downstream callers
   * are agnostic to which path produced the summary.
   */
  async runTurnStreamed(
    input: CodexTurnInput,
    onProgress: (event: CodexProgressEvent) => void,
  ): Promise<CodexTurnSummary> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      if (input.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      try {
        const summary = await this.runTurnStreamedOnce(input, onProgress);
        if (attempt > 0) {
          console.log(
            JSON.stringify({
              event: "codex_turn_retry_succeeded",
              attempt,
              previousFailures: attempt,
            }),
          );
        }
        return summary;
      } catch (error) {
        lastError = error;
        if (isAbortError(error)) throw error;
        // Deterministic provider capability gap — retrying replays the same
        // broken transcript. Surface it immediately instead of looping.
        if (error instanceof ReasoningReplayError) throw error;
        const isLastAttempt = attempt === MAX_RETRY_ATTEMPTS - 1;
        const waitMs = isLastAttempt ? 0 : computeBackoffDelay(attempt);
        console.warn(
          JSON.stringify({
            event: "codex_turn_failed",
            attempt: attempt + 1,
            maxAttempts: MAX_RETRY_ATTEMPTS,
            isLastAttempt,
            waitMs,
            rawMessage: error instanceof Error ? error.message : String(error),
            rawName: error instanceof Error ? error.name : undefined,
          }),
        );
        if (isLastAttempt) break;
        await delay(waitMs, input.signal);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(typeof lastError === "string" ? lastError : "codex turn ended unexpectedly");
  }

  private async runTurnStreamedOnce(
    input: CodexTurnInput,
    onProgress: (event: CodexProgressEvent) => void,
  ): Promise<CodexTurnSummary> {
    const stream = await this.thread.runStreamed(input.prompt, {
      signal: input.signal,
    });
    const fileChanges: string[] = [];
    const skillToolCalls: { name: string; result: ProjectReadSkillResult }[] = [];
    const reasoning: string[] = [];
    const itemTypeCounts: Record<string, number> = {};
    // Turn.finalResponse from the non-streaming path is the last agent_message
    // text; mirror that convention here so the soft-gateway gate behaves
    // identically (R1 parity).
    let finalResponse = "";
    let usage: Usage | null = null;
    let itemCount = 0;
    // Track the CLI's upstream WebSocket reconnect notices so we can detect
    // a "fake completion" (turn closes after exhausting reconnects with
    // only a preamble agent_message). See StreamReconnectError comment.
    let reconnectCount = 0;
    // Track whether the CLI surfaced its terminal reconnect notice (the
    // "N/5" with N === total). If it did, the upstream WS is dead and the
    // turn cannot recover — even if partial reasoning/edits leaked through
    // before the cap. We force a retry with a fresh CLI process so the
    // turn restarts cleanly instead of completing on a half-built result.
    let reconnectExhausted = false;

    for await (const event of stream.events) {
      if (event.type === "turn.completed") {
        usage = event.usage;
        continue;
      }
      if (event.type === "turn.failed") {
        // Same deterministic provider gap surfaced as a terminal turn.failed
        // rather than a mid-stream `error` event. Fail fast, do not retry.
        if (isReasoningReplayError(event.error.message)) {
          console.warn(
            JSON.stringify({
              event: "codex_turn_reasoning_replay_rejected",
              message: event.error.message,
            }),
          );
          throw new ReasoningReplayError(event.error.message ?? "");
        }
        throw new Error(event.error.message);
      }
      if (event.type === "error") {
        // Deterministic provider failure: a replayed reasoning item was
        // rejected with `content is required (input[N].content)`. Retrying
        // replays the same broken transcript, so fail fast with an actionable
        // error instead of burning the 10x backoff loop on a frozen UI.
        if (isReasoningReplayError(event.message)) {
          console.warn(
            JSON.stringify({
              event: "codex_turn_reasoning_replay_rejected",
              message: event.message,
            }),
          );
          throw new ReasoningReplayError(event.message ?? "");
        }
        // CLI's upstream-WS reconnect notice — phrased as "Reconnecting...
        // N/5 (stream disconnected before completion: WebSocket protocol
        // error: Handshake not finished)". Match the SDK's non-streaming
        // `run()` (dist/index.js:101-113) which silently ignores these so
        // the in-flight turn isn't aborted on transient flaps. We DO count
        // them so the post-loop gate can refuse to accept a stub turn that
        // only "completed" because reconnects ran out.
        const reconnectMatch = RECONNECT_NOTICE_RE.exec(event.message ?? "");
        if (reconnectMatch) {
          reconnectCount += 1;
          onProgress({ kind: "reconnect_notice", count: reconnectCount });
          // The phrasing is "Reconnecting... N/M (...)". When N === M the CLI
          // has exhausted its reconnect budget; the stream will not recover.
          const current = Number(reconnectMatch[1]);
          const total = Number(reconnectMatch[2]);
          if (
            Number.isFinite(current) &&
            Number.isFinite(total) &&
            current >= total
          ) {
            reconnectExhausted = true;
          }
        }
        console.warn(
          JSON.stringify({
            event: "codex_turn_stream_error_ignored",
            message: event.message,
            reconnectCount,
          }),
        );
        continue;
      }
      if (event.type === "item.started") {
        const item = event.item;
        if (item.type === "command_execution") {
          onProgress({ kind: "command_started", command: item.command });
        } else if (item.type === "file_change") {
          onProgress({
            kind: "file_change_started",
            paths: item.changes.map((c) => c.path),
          });
        } else if (item.type === "mcp_tool_call") {
          onProgress({
            kind: "mcp_tool_call_started",
            server: item.server,
            tool: item.tool,
          });
        }
        continue;
      }
      if (event.type !== "item.completed") {
        continue;
      }
      const item = event.item;
      itemCount += 1;
      itemTypeCounts[item.type] = (itemTypeCounts[item.type] ?? 0) + 1;
      if (item.type === "agent_message") {
        finalResponse = item.text;
      } else if (
        item.type === "reasoning" &&
        typeof item.text === "string" &&
        item.text.trim().length > 0
      ) {
        reasoning.push(item.text);
        onProgress({ kind: "reasoning", text: item.text });
      } else if (item.type === "file_change") {
        const paths = item.changes.map((c) => c.path);
        for (const p of paths) fileChanges.push(p);
        onProgress({
          kind: "file_change_completed",
          paths,
          failed: item.status === "failed",
        });
      } else if (item.type === "command_execution") {
        onProgress({
          kind: "command_completed",
          command: item.command,
          exitCode: typeof item.exit_code === "number" ? item.exit_code : null,
          failed: item.status === "failed",
        });
      } else if (item.type === "mcp_tool_call") {
        if (item.tool === PROJECT_READ_SKILL_TOOL_NAME) {
          const args = (item.arguments ?? {}) as { name?: unknown };
          const result = projectReadSkill({ name: args.name }, this.skillToolCallbacks);
          skillToolCalls.push({
            name: typeof args.name === "string" ? args.name : "<invalid>",
            result,
          });
        }
        onProgress({
          kind: "mcp_tool_call_completed",
          server: item.server,
          tool: item.tool,
          failed: item.status === "failed",
        });
      }
    }

    // Identical soft-gateway gate to runTurnOnce: a status-200 gateway error
    // string with no file change and no skill call is not a real answer.
    if (
      fileChanges.length === 0 &&
      skillToolCalls.length === 0 &&
      isSoftGatewayError(finalResponse)
    ) {
      console.warn(
        JSON.stringify({
          event: "codex_turn_soft_gateway_error",
          finalResponsePreview: finalResponse.slice(0, 240),
          itemCount,
          itemTypeCounts,
        }),
      );
      throw new GatewaySoftError(finalResponse);
    }
    // Degenerate-reconnect gate: when the CLI surfaced one or more upstream
    // WS reconnect notices AND the turn produced no concrete work (no file
    // change, no skill call, no reasoning), the "completion" is the CLI
    // giving up after exhausting its reconnect budget. Empirically the
    // tail-event is a single short `agent_message` describing the work it
    // INTENDED to do — never the work itself. Throw so the outer retry
    // spawns a fresh CLI process (fresh upstream WS) and tries again.
    // We DON'T gate on "no edits" alone — legitimate planning/reasoning
    // turns produce zero edits, and integration mocks emit empty streams.
    // The reconnect-counter is the precise discriminator.
    //
    // Two retry triggers:
    //   1. reconnectExhausted: the CLI hit its terminal "N/N" reconnect
    //      notice — the upstream WS is dead, the turn cannot recover, retry
    //      regardless of whatever partial reasoning/edits leaked first.
    //   2. reconnectCount > 0 && noWork: transient flaps that left the turn
    //      with nothing concrete (the stub-completion case from the log).
    const noWork =
      fileChanges.length === 0 &&
      skillToolCalls.length === 0 &&
      reasoning.length === 0;
    if (reconnectExhausted || (reconnectCount > 0 && noWork)) {
      console.warn(
        JSON.stringify({
          event: "codex_turn_reconnect_stub",
          reconnectCount,
          reconnectExhausted,
          itemCount,
          itemTypeCounts,
          fileChangesCount: fileChanges.length,
          reasoningCount: reasoning.length,
          finalResponseLength: finalResponse.length,
          finalResponsePreview: finalResponse.slice(0, 240),
        }),
      );
      throw new StreamReconnectError(reconnectCount);
    }
    console.log(
      JSON.stringify({
        event: "codex_turn_completed",
        promptLength: input.prompt.length,
        finalResponseLength: finalResponse.length,
        finalResponsePreview: finalResponse.slice(0, 240),
        itemCount,
        itemTypeCounts,
        fileChangesCount: fileChanges.length,
        fileChangesPreview: fileChanges.slice(0, 5),
        skillToolCallsCount: skillToolCalls.length,
        reasoningCount: reasoning.length,
        streamed: true,
      }),
    );
    return {
      finalResponse,
      usage,
      fileChanges,
      skillToolCalls,
      reasoning,
    };
  }

  async *runStreamed(
    input: CodexTurnInput,
  ): AsyncGenerator<ThreadEvent> {
    const stream = await this.thread.runStreamed(input.prompt, {
      signal: input.signal,
    });
    for await (const event of stream.events) {
      yield event;
    }
  }

  get threadId(): string | null {
    return this.thread.id;
  }
}

export function createBoundedCodexThread(
  input: CodexThreadInput,
): BoundedCodexThread {
  // CODEX_DISABLE_SANDBOX=true bypasses the codex CLI's bwrap sandbox by passing
  // sandbox_mode=danger-full-access. Use this on hosts where unprivileged user
  // namespaces / network namespace creation is blocked (Ubuntu 24+ default,
  // Docker default seccomp, locked-down VPS), where bwrap fails with
  // "loopback: Failed RTM_NEWADDR: Operation not permitted" and apply_patch
  // becomes a no-op. The diff gate still enforces draft-workspace boundary.
  const sandboxDisabled = process.env.CODEX_DISABLE_SANDBOX === "true";
  const sandboxMode: CodexSandboxMode = sandboxDisabled
    ? "danger-full-access"
    : input.sandboxMode ?? "workspace-write";
  // Transport: use codex's DEFAULT (WebSocket) streaming — do NOT override
  // model_provider/wire_api.
  //
  // History (why this matters): we briefly forced the HTTP `responses` wire_api
  // to dodge a WS handshake flap. That flap came from an OLD relay
  // (9router/localhost) that is no longer in use. On the real provider the HTTP
  // path is architecturally broken for build turns: `responses` is stateless,
  // so codex replays the whole transcript into input[] on every model
  // round-trip within a turn. The replayed reasoning item carries no `content`
  // unless the provider echoes `reasoning.encrypted_content`, and the provider
  // rejects it with `content is required (input[N].content)`. Runtime confirmed
  // this twice (normal build AND the no-reasoning fallback both died there): the
  // model keeps emitting reasoning items regardless of effort, so NO client
  // config avoids the replay. WebSocket is STATEFUL — the server holds the
  // transcript, reasoning is never replayed — which is why build worked under
  // WS before the transport was switched. Keep the default.
  const codex = new Codex({
    apiKey: input.env.apiKey,
    baseUrl: input.env.baseUrl,
    env: {
      ...process.env,
      CODEX_HOME: input.env.codexHome,
    } as Record<string, string>,
  });
  const thread = codex.startThread({
    model: input.env.model,
    workingDirectory: input.draftWorkspacePath,
    sandboxMode,
    modelReasoningEffort: input.modelReasoningEffort,
    skipGitRepoCheck: true,
    networkAccessEnabled: false,
    approvalPolicy: "never",
    additionalDirectories: [],
  });
  return new BoundedCodexThread(thread, input.skillToolCallbacks);
}

export function summarizeUsage(usage: Usage | null): {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
} | null {
  if (!usage) return null;
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cachedInputTokens: usage.cached_input_tokens,
  };
}
