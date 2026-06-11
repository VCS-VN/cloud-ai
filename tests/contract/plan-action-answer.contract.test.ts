import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/functions/auth", () => ({
  requireServerUser: vi.fn(async () => ({ id: "u1" })),
}));

vi.mock("@/features/agents/codex/runtime/builder-run-registry.server", () => {
  const handle = {
    runId: "run-1",
    projectId: "p1",
    userId: "u1",
    status: "awaiting_clarification",
    abortController: new AbortController(),
    events: [] as unknown[],
    subscribers: new Set(),
    startedAt: 0,
    pendingSkills: [],
    clarificationPrompt: { question: "?", options: [{ id: "approve", label: "Approve" }] },
    userPrompt: null,
    resumeFn: vi.fn(async () => undefined),
    loadedSkills: [],
  };
  return {
    getBuilderRunHandle: () => handle,
    __handle: handle,
  };
});

vi.mock("@/server/services/project-services", () => {
  const loadMock = vi.fn();
  const markAnsweredMock = vi.fn();
  return {
    getProjectServices: vi.fn(async () => ({
      chatHistoryService: { runStore: { load: loadMock } },
      projectService: {
        messageRepository: {
          markAgentQuestionAnswered: markAnsweredMock,
        },
      },
    })),
    __loadMock: loadMock,
    __markAnsweredMock: markAnsweredMock,
  };
});

vi.mock("@/server/services/chat-event-channel.server", () => ({
  publishChatEvent: vi.fn(),
}));

import * as registryModule from "@/features/agents/codex/runtime/builder-run-registry.server";
import * as projectServices from "@/server/services/project-services";
import * as chatChannel from "@/server/services/chat-event-channel.server";
import { Route } from "@/routes/api/projects/$projectId/builder-runs/$runId/answer";

const handle = (
  registryModule as unknown as {
    __handle: {
      status: string;
      clarificationPrompt: { question: string; options: { id: string; label: string }[] } | null;
      resumeFn: ReturnType<typeof vi.fn>;
    };
  }
).__handle;
const loadMock = (
  projectServices as unknown as { __loadMock: ReturnType<typeof vi.fn> }
).__loadMock;
const markAnsweredMock = (
  projectServices as unknown as { __markAnsweredMock: ReturnType<typeof vi.fn> }
).__markAnsweredMock;
const publishChatEventMock = vi.mocked(chatChannel.publishChatEvent);
const handler = (Route.options as { server?: { handlers?: { POST?: any } } }).server?.handlers?.POST as
  | ((args: { params: { projectId: string; runId: string }; request: Request }) => Promise<Response>)
  | undefined;

function makeRequest(body: unknown): Request {
  return new Request("http://test/api/projects/p1/builder-runs/run-1/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  loadMock.mockReset();
  markAnsweredMock.mockReset();
  markAnsweredMock.mockResolvedValue({ id: "msg-db-1" });
  publishChatEventMock.mockReset();
  handle.status = "awaiting_clarification";
  handle.clarificationPrompt = { question: "?", options: [{ id: "approve", label: "Approve" }] };
  handle.resumeFn.mockReset();
});

describe("POST /builder-runs/$runId/answer — planAction contract (T049)", () => {
  it("planAction approve resolves only when plan_phase.stage === plan_ready (200/204)", async () => {
    if (!handler) return;
    loadMock.mockResolvedValueOnce({ planPhase: { stage: "plan_ready", planMarkdown: "..." } });
    handle.resumeFn.mockResolvedValueOnce(undefined);
    const resp = await handler({
      params: { projectId: "p1", runId: "run-1" },
      request: makeRequest({ planAction: "approve" }),
    });
    expect(resp.status).toBe(204);
  });

  it("planAction reject also requires plan_ready", async () => {
    if (!handler) return;
    loadMock.mockResolvedValueOnce({ planPhase: { stage: "plan_ready", planMarkdown: "..." } });
    handle.resumeFn.mockResolvedValueOnce(undefined);
    const resp = await handler({
      params: { projectId: "p1", runId: "run-1" },
      request: makeRequest({ planAction: "reject" }),
    });
    expect(resp.status).toBe(204);
  });

  it("planAction rejected with 409 when plan_phase.stage !== plan_ready", async () => {
    if (!handler) return;
    loadMock.mockResolvedValueOnce({ planPhase: { stage: "executing" } });
    const resp = await handler({
      params: { projectId: "p1", runId: "run-1" },
      request: makeRequest({ planAction: "approve" }),
    });
    expect(resp.status).toBe(409);
    const body = await resp.json();
    expect(body).toMatchObject({ ok: false, code: "RUN_NOT_AWAITING_INPUT" });
  });

  it("planAction rejected with 409 when run has no plan_phase at all", async () => {
    if (!handler) return;
    loadMock.mockResolvedValueOnce({ planPhase: null });
    const resp = await handler({
      params: { projectId: "p1", runId: "run-1" },
      request: makeRequest({ planAction: "approve" }),
    });
    expect(resp.status).toBe(409);
  });

  it("invalid planAction value falls through to empty_answer (400)", async () => {
    if (!handler) return;
    const resp = await handler({
      params: { projectId: "p1", runId: "run-1" },
      request: makeRequest({ planAction: "maybe" }),
    });
    expect(resp.status).toBe(400);
  });
});

describe("POST /builder-runs/$runId/answer — option persistence", () => {
  it("persists selected option before publishing and resuming", async () => {
    if (!handler) return;
    handle.resumeFn.mockResolvedValueOnce(undefined);

    const resp = await handler({
      params: { projectId: "p1", runId: "run-1" },
      request: makeRequest({ optionId: "approve" }),
    });

    expect(resp.status).toBe(204);
    expect(markAnsweredMock).toHaveBeenCalledWith("p1", "run-1", "approve", "u1");
    expect(publishChatEventMock).toHaveBeenCalledWith("run-1", {
      type: "option.selected",
      runId: "run-1",
      messageId: "msg-db-1",
      optionId: "approve",
    });
    expect(handle.resumeFn).toHaveBeenCalledWith({ optionId: "approve" });
  });

  it("does not mark planAction answers as option selections", async () => {
    if (!handler) return;
    loadMock.mockResolvedValueOnce({ planPhase: { stage: "plan_ready", planMarkdown: "..." } });
    handle.resumeFn.mockResolvedValueOnce(undefined);

    const resp = await handler({
      params: { projectId: "p1", runId: "run-1" },
      request: makeRequest({ planAction: "approve" }),
    });

    expect(resp.status).toBe(204);
    expect(markAnsweredMock).not.toHaveBeenCalled();
    expect(publishChatEventMock).not.toHaveBeenCalled();
  });

  it("does not resume when selected option persistence fails", async () => {
    if (!handler) return;
    markAnsweredMock.mockRejectedValueOnce(new Error("db down"));

    const resp = await handler({
      params: { projectId: "p1", runId: "run-1" },
      request: makeRequest({ optionId: "approve" }),
    });

    expect(resp.status).toBe(500);
    await expect(resp.json()).resolves.toMatchObject({
      ok: false,
      code: "answer_persist_failed",
    });
    expect(handle.resumeFn).not.toHaveBeenCalled();
    expect(publishChatEventMock).not.toHaveBeenCalled();
  });
});
