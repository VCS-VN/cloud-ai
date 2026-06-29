import type { CodexEnvAvailable } from "@/server/env/codex";

// Direct HTTP client for the OpenAI Responses API SSE stream. Used for the
// detect + variant pre-build clarification turns: those only need a JSON-shape
// reply, never apply_patch / exec, so going through the codex CLI (which bakes
// in a 13KB system prompt + 8KB tool array + skills registry on every call) is
// pure overhead. Hitting /v1/responses ourselves keeps the payload at <2KB and
// avoids the WS-reconnect / reasoning-replay failure modes that only surface
// inside the CLI's HTTP fallback.

export type RunResponsesTurnInput = {
  env: CodexEnvAvailable;
  prompt: string;
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  signal?: AbortSignal;
  // Streamed reasoning-summary deltas, mirroring CodexProgressEvent.kind === "reasoning"
  // so callers can emit `thinking` UI events without a second adapter layer.
  onReasoning?: (text: string) => void;
};

export type RunResponsesTurnResult = {
  finalResponse: string;
};

type SseEvent = { event: string; data: string };

// Parse a chunk of SSE text into discrete events. SSE delimits events with a
// blank line; each line is `field: value`. We only care about `event:` and
// `data:` — comments (`:` prefix) and other fields are ignored. Multi-line
// `data:` is joined with `\n` per spec, but the Responses API emits one-line
// JSON so the join is rarely exercised.
function parseSseChunk(buffer: string): { events: SseEvent[]; remainder: string } {
  const events: SseEvent[] = [];
  let remainder = buffer;
  while (true) {
    const sepIdx = remainder.indexOf("\n\n");
    if (sepIdx === -1) break;
    const block = remainder.slice(0, sepIdx);
    remainder = remainder.slice(sepIdx + 2);
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (!line || line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
      if (field === "event") event = value;
      else if (field === "data") dataLines.push(value);
    }
    if (dataLines.length > 0) {
      events.push({ event, data: dataLines.join("\n") });
    }
  }
  return { events, remainder };
}

export async function runResponsesTurn(
  input: RunResponsesTurnInput,
): Promise<RunResponsesTurnResult> {
  const baseUrl = input.env.baseUrl;
  if (!baseUrl) {
    throw new Error("responses_http_client: env.baseUrl is required");
  }
  const url = baseUrl.replace(/\/+$/, "") + "/responses";
  const body: Record<string, unknown> = {
    model: input.env.model,
    input: input.prompt,
    stream: true,
    store: false,
  };
  if (input.reasoningEffort) {
    body.reasoning = { effort: input.reasoningEffort, summary: "auto" };
  }
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
      authorization: `Bearer ${input.env.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: input.signal,
  });
  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `responses_http_client: ${response.status} ${response.statusText}: ${text.slice(0, 400)}`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let outputText = "";
  let completedOutput: string | null = null;
  let errorMessage: string | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseChunk(buffer);
      buffer = parsed.remainder;
      for (const ev of parsed.events) {
        if (ev.data === "[DONE]") continue;
        let payload: unknown;
        try {
          payload = JSON.parse(ev.data);
        } catch {
          continue;
        }
        const p = payload as { type?: string; delta?: string; response?: unknown; message?: string };
        const type = p.type ?? ev.event;
        if (type === "response.output_text.delta" && typeof p.delta === "string") {
          outputText += p.delta;
          continue;
        }
        if (
          (type === "response.reasoning_summary_text.delta" ||
            type === "response.reasoning.delta") &&
          typeof p.delta === "string" &&
          p.delta.trim().length > 0
        ) {
          input.onReasoning?.(p.delta);
          continue;
        }
        if (type === "response.completed" || type === "response.done") {
          completedOutput = extractCompletedText(p.response) ?? completedOutput;
          continue;
        }
        if (type === "error" || type === "response.failed") {
          errorMessage =
            typeof p.message === "string"
              ? p.message
              : JSON.stringify(payload).slice(0, 400);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (errorMessage) {
    throw new Error(`responses_http_client: ${errorMessage}`);
  }
  const finalResponse = completedOutput ?? outputText;
  if (!finalResponse) {
    throw new Error("responses_http_client: stream closed with empty output");
  }
  return { finalResponse };
}

// Extract assistant text from the terminal `response.completed` payload. The
// Responses API returns `response.output: ItemUnion[]`; message items hold the
// assistant text. We concat across all message items to mirror what the SDK's
// Turn.finalResponse exposes (last agent_message text).
function extractCompletedText(response: unknown): string | null {
  if (!response || typeof response !== "object") return null;
  const r = response as { output?: unknown };
  if (!Array.isArray(r.output)) return null;
  const chunks: string[] = [];
  for (const item of r.output) {
    if (!item || typeof item !== "object") continue;
    const it = item as { type?: string; content?: unknown };
    if (it.type !== "message") continue;
    if (!Array.isArray(it.content)) continue;
    for (const c of it.content) {
      if (!c || typeof c !== "object") continue;
      const cc = c as { type?: string; text?: unknown };
      if (
        (cc.type === "output_text" || cc.type === "text") &&
        typeof cc.text === "string"
      ) {
        chunks.push(cc.text);
      }
    }
  }
  if (chunks.length === 0) return null;
  return chunks.join("");
}
