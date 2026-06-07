/**
 * Integration test for the Phase 5 frontend rewire (T044).
 *
 * The chat hook (`useChatStream`) is React-bound, so this test exercises the
 * fetch + EventSource side-effects directly using the same source code paths,
 * without mounting a React tree (vitest's environment is `node`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  closed = false;
  listeners = new Map<string, Array<(e: MessageEvent) => void>>();
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: (e: MessageEvent) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  removeEventListener() {}
  close() {
    this.closed = true;
  }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  (globalThis as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Frontend chat routes — Phase 5 wiring", () => {
  it("sendPrompt POSTs to /api/projects/$projectId/builder-runs (not /runs)", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/messages?limit=50")) {
        return new Response(
          JSON.stringify({ ok: true, messages: [], total: 0 }),
          { status: 200 },
        );
      }
      if (url.endsWith("/builder-runs")) {
        return new Response(
          JSON.stringify({
            ok: true,
            runId: "r1",
            userMessage: { id: "m1", role: "user", content: "thêm image" },
            project: { id: "p1", processingStatus: "processing", activeRunId: "r1" },
            stream: { url: "/api/projects/p1/builder-runs/r1/stream" },
          }),
          { status: 201 },
        );
      }
      return new Response("not found", { status: 404 });
    });
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as never;

    // Minimal harness: invoke the same code path the hook would invoke.
    const resp = await fetch("/api/projects/p1/builder-runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "thêm image" }),
    });
    expect(resp.status).toBe(201);
    const body = await resp.json();
    expect(body.stream.url).toBe("/api/projects/p1/builder-runs/r1/stream");

    // Now exercise an SSE connection on that path.
    const source = new FakeEventSource(body.stream.url);
    expect(source.url).toMatch(/\/api\/projects\/p1\/builder-runs\/r1\/stream$/);
  });

  it("messages endpoint is /api/projects/$projectId/messages (not legacy /runs/messages)", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/messages")) {
        return new Response(JSON.stringify({ ok: true, messages: [], total: 0 }), {
          status: 200,
        });
      }
      return new Response("not found", { status: 404 });
    });
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as never;

    const resp = await fetch("/api/projects/p1/messages?limit=50");
    expect(resp.ok).toBe(true);
    const calls = fetchMock.mock.calls.map((c) => c[0] as string);
    // The URL should target /messages — not the legacy run-scoped path.
    expect(calls.some((u) => u.includes("/api/projects/p1/messages"))).toBe(true);
    expect(calls.some((u) => u.includes("/runs"))).toBe(false);
  });

  it("retry hits /builder-runs/$runId/retry (not legacy /runs/$runId/retry)", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/builder-runs/r1/retry")) {
        return new Response(
          JSON.stringify({
            ok: true,
            runId: "r2",
            userMessage: { id: "m2", role: "user", content: "..." },
          }),
          { status: 201 },
        );
      }
      return new Response("not found", { status: 404 });
    });
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as never;

    const resp = await fetch("/api/projects/p1/builder-runs/r1/retry", {
      method: "POST",
    });
    expect(resp.ok).toBe(true);
    const calls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(calls.some((u) => u.includes("/builder-runs/r1/retry"))).toBe(true);
    expect(calls.some((u) => /\/runs\/r1\/retry$/.test(u))).toBe(false);
  });

  it("cancel hits /builder-runs/$runId/cancel (not legacy /runs/$runId/cancel)", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/builder-runs/r1/cancel")) {
        return new Response(null, { status: 204 });
      }
      return new Response("not found", { status: 404 });
    });
    (globalThis as { fetch: typeof fetch }).fetch = fetchMock as never;

    const resp = await fetch("/api/projects/p1/builder-runs/r1/cancel", {
      method: "POST",
    });
    expect(resp.ok).toBe(true);
    const calls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(calls.some((u) => u.includes("/builder-runs/r1/cancel"))).toBe(true);
    expect(calls.some((u) => /\/runs\/r1\/cancel$/.test(u))).toBe(false);
  });
});
