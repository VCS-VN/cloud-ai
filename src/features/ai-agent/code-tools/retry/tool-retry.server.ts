import type { ProjectToolResult, ProviderFunctionToolCall } from "../code-agent-types";

const RETRYABLE_ERROR_CODE = "TOOL_EXECUTION_FAILED";
const RETRY_DELAYS_MS = [500, 1500] as const;

const NON_RETRYABLE_ERROR_CODES = new Set([
  "TOOL_NOT_FOUND",
  "TOOL_ARGS_PARSE_FAILED",
  "PHASE_FORBIDDEN",
  "INSPECTION_REQUIRED",
  "SNAPSHOT_REQUIRED",
  "DESIGN_RULES_REQUIRED",
  "DESIGN_TOKEN_LITERAL_OFF_RULE",
  "PROTECTED_ENV_FILE",
  "GENERATED_API_CLIENT_POLICY_VIOLATION",
  "HUMAN_REVIEW_REQUIRED",
]);

export async function withToolRetry(input: {
  toolCall: ProviderFunctionToolCall;
  execute: () => Promise<ProjectToolResult>;
  signal?: AbortSignal;
  onRetry?: (info: { toolName: string; attempt: number; delayMs: number; errorCode: string; errorMessage: string }) => void | Promise<void>;
}): Promise<ProjectToolResult> {
  let lastResult: ProjectToolResult | undefined;
  for (let attempt = 1; attempt <= RETRY_DELAYS_MS.length + 1; attempt += 1) {
    if (input.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const result = await input.execute();
    if (result.ok || !shouldRetry(result) || attempt > RETRY_DELAYS_MS.length) {
      return result;
    }
    lastResult = result;
    const delayMs = RETRY_DELAYS_MS[attempt - 1];
    await input.onRetry?.({
      toolName: input.toolCall.name,
      attempt,
      delayMs,
      errorCode: result.error?.code ?? RETRYABLE_ERROR_CODE,
      errorMessage: result.error?.message ?? "Tool execution failed.",
    });
    await sleep(delayMs, input.signal);
  }
  return lastResult ?? await input.execute();
}

function shouldRetry(result: ProjectToolResult) {
  const code = result.error?.code;
  if (!code || NON_RETRYABLE_ERROR_CODES.has(code)) return false;
  return code === RETRYABLE_ERROR_CODE && result.error?.recoverable === true;
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
