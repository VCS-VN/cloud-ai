import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/functions/auth", () => ({
  requireServerUser: vi.fn(async () => ({ id: "user-1" })),
}));

vi.mock("@/server/services/project-services", () => {
  const getProjectMock = vi.fn();
  const saveMessageMock = vi.fn(async (m: { id: string; content: string }) => ({
    ...m,
    role: "user",
    status: "completed",
    processingStatus: "completed",
    createdAt: new Date().toISOString(),
  }));
  const updateProcessingMock = vi.fn(async (id: string) => ({
    id,
    processingStatus: "processing",
    activeRunId: "run-mock",
  }));
  const runStoreCreateMock = vi.fn(async (input: { projectId: string }) => ({
    id: "run-mock",
    projectId: input.projectId,
    status: "streaming",
  }));
  return {
    getProjectServices: vi.fn(async () => ({
      projectService: {
        projectRepository: {
          getProject: getProjectMock,
          updateProjectProcessingState: updateProcessingMock,
        },
        messageRepository: { saveMessage: saveMessageMock },
      },
      chatHistoryService: { runStore: { create: runStoreCreateMock } },
    })),
    __getProjectMock: getProjectMock,
    __createRunMock: runStoreCreateMock,
  };
});

vi.mock("@/server/services/builder-run-dispatcher.server", () => {
  const startDispatchMock = vi.fn();
  return {
    startBuilderRunForChat: startDispatchMock,
    __startDispatchMock: startDispatchMock,
  };
});

import * as projectServicesModule from "@/server/services/project-services";
import * as dispatcherModule from "@/server/services/builder-run-dispatcher.server";
import { Route } from "@/routes/api/projects/$projectId/builder-runs/index";

const startDispatchMock = (
  dispatcherModule as unknown as { __startDispatchMock: ReturnType<typeof vi.fn> }
).__startDispatchMock;
const getProjectMock = (
  projectServicesModule as unknown as { __getProjectMock: ReturnType<typeof vi.fn> }
).__getProjectMock;
const createRunMock = (
  projectServicesModule as unknown as { __createRunMock: ReturnType<typeof vi.fn> }
).__createRunMock;

const handler = (Route.options as { server?: { handlers?: { POST?: any } } }).server?.handlers?.POST as
  | ((args: { params: { projectId: string }; request: Request }) => Promise<Response>)
  | undefined;

function makeRequest(body: unknown): Request {
  return new Request("http://test/api/projects/p1/builder-runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  startDispatchMock.mockReset();
  createRunMock.mockReset();
  getProjectMock.mockReset();
});

describe("POST /api/projects/$projectId/builder-runs — Phase 2 contract", () => {
  it("exposes a POST handler", () => {
    expect(handler).toBeTypeOf("function");
  });

  it("rejects empty prompt with 400 blocked_request", async () => {
    if (!handler) return;
    const resp = await handler({
      params: { projectId: "p1" },
      request: makeRequest({ prompt: "   " }),
    });
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body).toMatchObject({ ok: false, code: "blocked_request" });
  });

  it("returns 404 PROJECT_NOT_FOUND when project missing", async () => {
    if (!handler) return;
    getProjectMock.mockResolvedValueOnce(undefined);
    const resp = await handler({
      params: { projectId: "p1" },
      request: makeRequest({ prompt: "thêm image" }),
    });
    expect(resp.status).toBe(404);
    const body = await resp.json();
    expect(body).toMatchObject({ ok: false, code: "PROJECT_NOT_FOUND" });
  });

  it("returns 409 active_run_exists when project is processing", async () => {
    if (!handler) return;
    getProjectMock.mockResolvedValueOnce({
      id: "p1",
      processingStatus: "processing",
      status: "ready",
    });
    const resp = await handler({
      params: { projectId: "p1" },
      request: makeRequest({ prompt: "thêm image" }),
    });
    expect(resp.status).toBe(409);
    const body = await resp.json();
    expect(body).toMatchObject({ ok: false, code: "active_run_exists" });
  });

  it("does NOT pass body.kind through — kind is resolved server-side (R5)", async () => {
    if (!handler) return;
    getProjectMock.mockResolvedValueOnce({
      id: "p1",
      processingStatus: "idle",
      status: "ready",
    });
    createRunMock.mockResolvedValueOnce({
      id: "run-123",
      projectId: "p1",
      status: "streaming",
    });
    startDispatchMock.mockResolvedValueOnce({
      ok: true,
      runId: "run-123",
      events: (async function* () {})(),
      signal: new AbortController().signal,
    });
    const resp = await handler({
      params: { projectId: "p1" },
      request: makeRequest({
        prompt: "thêm image",
        kind: "init", // client tries to spoof — server must ignore
        reasoningEffort: "high",
      }),
    });
    expect(resp.status).toBe(201);
    const dispatchArgs = startDispatchMock.mock.calls[0][0];
    expect(dispatchArgs.reasoningEffort).toBe("high");
    expect("kind" in dispatchArgs ? dispatchArgs.kind : undefined).toBeUndefined();
  });

  it("returns 201 envelope with runId, userMessage, project, and stream URL", async () => {
    if (!handler) return;
    getProjectMock.mockResolvedValueOnce({
      id: "p1",
      processingStatus: "idle",
      status: "ready",
    });
    createRunMock.mockResolvedValueOnce({ id: "run-xyz", projectId: "p1", status: "streaming" });
    startDispatchMock.mockResolvedValueOnce({
      ok: true,
      runId: "run-xyz",
      events: (async function* () {})(),
      signal: new AbortController().signal,
    });
    const resp = await handler({
      params: { projectId: "p1" },
      request: makeRequest({ prompt: "thêm image" }),
    });
    expect(resp.status).toBe(201);
    const body = await resp.json();
    expect(body).toMatchObject({
      ok: true,
      runId: "run-xyz",
      userMessage: { content: "thêm image" },
      project: { id: "p1", processingStatus: "processing" },
      stream: { url: "/api/projects/p1/builder-runs/run-xyz/stream" },
    });
  });

  it("ignores invalid reasoningEffort values", async () => {
    if (!handler) return;
    getProjectMock.mockResolvedValueOnce({
      id: "p1",
      processingStatus: "idle",
      status: "ready",
    });
    createRunMock.mockResolvedValueOnce({ id: "run-2", projectId: "p1", status: "streaming" });
    startDispatchMock.mockResolvedValueOnce({
      ok: true,
      runId: "run-2",
      events: (async function* () {})(),
      signal: new AbortController().signal,
    });
    await handler({
      params: { projectId: "p1" },
      request: makeRequest({ prompt: "thêm image", reasoningEffort: "BANANA" }),
    });
    const dispatchArgs = startDispatchMock.mock.calls[0][0];
    expect(dispatchArgs.reasoningEffort).toBeUndefined();
  });

  it("propagates dispatcher failures with the right HTTP code mapping", async () => {
    if (!handler) return;
    getProjectMock.mockResolvedValueOnce({
      id: "p1",
      processingStatus: "idle",
      status: "ready",
    });
    createRunMock.mockResolvedValueOnce({ id: "run-3", projectId: "p1", status: "streaming" });
    startDispatchMock.mockResolvedValueOnce({
      ok: false,
      code: "config_unavailable",
      message: "AI builder is unavailable.",
    });
    const resp = await handler({
      params: { projectId: "p1" },
      request: makeRequest({ prompt: "thêm image" }),
    });
    expect(resp.status).toBe(503);
    const body = await resp.json();
    expect(body).toMatchObject({ ok: false, code: "config_unavailable" });
  });
});
