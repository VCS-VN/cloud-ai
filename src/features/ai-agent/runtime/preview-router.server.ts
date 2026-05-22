import http, { type IncomingMessage, type ServerResponse } from "node:http";
import httpProxy from "http-proxy";
import type { RuntimeOrchestrator } from "./runtime-orchestrator.server";
import { PREVIEW_TOKEN_COOKIE_NAME, type PreviewTokenService } from "./preview-token-service.server";
import { getPreviewRuntimeConfig } from "./preview-runtime-config.server";

type ProxyTargetResult =
  | { ok: true; projectId: string; target: string }
  | { ok: false; reason: string; projectId?: string; details?: Record<string, unknown> };

export type PreviewRouterOptions = {
  runtimeOrchestrator: RuntimeOrchestrator;
  tokenService?: Pick<PreviewTokenService, "verifyToken">;
  publicHost: string;
  host?: string;
  port?: number;
};

let server: http.Server | null = null;

export function extractProjectIdFromPreviewHost(hostHeader: string | undefined, publicHost: string): string | null {
  if (!hostHeader) return null;
  const host = hostHeader.split(":")[0]?.toLowerCase();
  const suffix = `-preview.${publicHost.toLowerCase()}`;
  if (!host || !host.endsWith(suffix)) return null;
  const projectId = host.slice(0, -suffix.length);
  if (!/^[a-z0-9_-]+$/i.test(projectId)) return null;
  return projectId;
}

export function startPreviewRouterOnce(options: PreviewRouterOptions) {
  if (server) return server;
  const config = getPreviewRuntimeConfig();
  const proxy = httpProxy.createProxyServer({ ws: true, xfwd: true });
  proxy.on("proxyRes", stripFrameBlockingHeaders);
  proxy.on("error", (error, request) => {
    logRouterError("preview_proxy_error", request as IncomingMessage | undefined, error);
  });

  server = http.createServer(async (request, response) => {
    await proxyRequest({ request, response, proxy, options });
  });

  server.on("upgrade", async (request, socket, head) => {
    try {
      const result = await resolveProxyTargetResult(request, options);
      if (!result.ok) {
        logRouterReject(request, result);
        safeCloseSocket(socket, statusForReject(result));
        return;
      }
      proxy.ws(request, socket, head, { target: result.target }, (error) => {
        logRouterError("preview_router_upgrade_error", request, error);
        safeCloseSocket(socket, 503);
      });
    } catch (error) {
      logRouterError("preview_router_upgrade_error", request, error);
      safeCloseSocket(socket, 503);
    }
  });

  server.listen(options.port ?? config.routerPort, options.host ?? config.routerHost);
  return server;
}

async function proxyRequest(input: {
  request: IncomingMessage;
  response: ServerResponse;
  proxy: httpProxy;
  options: PreviewRouterOptions;
}) {
  try {
    const result = await resolveProxyTargetResult(input.request, input.options);
    if (!result.ok) {
      logRouterReject(input.request, result);
      safeEndResponse(input.response, statusForReject(result), bodyForReject(result));
      return;
    }
    input.proxy.web(input.request, input.response, { target: result.target }, (error) => {
      logRouterError("preview_proxy_error", input.request, error);
      safeEndResponse(input.response, 503, "Preview unavailable.");
    });
  } catch (error) {
    logRouterError("preview_router_error", input.request, error);
    safeEndResponse(input.response, 503, "Preview unavailable.");
  }
}

export async function resolveProxyTarget(request: IncomingMessage, options: PreviewRouterOptions) {
  const result = await resolveProxyTargetResult(request, options);
  return result.ok ? result.target : null;
}

export async function resolveProxyTargetResult(request: IncomingMessage, options: PreviewRouterOptions): Promise<ProxyTargetResult> {
  const projectId = extractProjectIdFromPreviewHost(request.headers.host, options.publicHost);
  if (!projectId) return { ok: false, reason: "host_mismatch" };
  if (options.tokenService) {
    const token = readCookie(request.headers.cookie, PREVIEW_TOKEN_COOKIE_NAME);
    let verification: Awaited<ReturnType<PreviewTokenService["verifyToken"]>>;
    try {
      verification = await options.tokenService.verifyToken({ token, projectId });
    } catch (error) {
      return { ok: false, projectId, reason: "auth_error", details: { error: formatErrorMessage(error) } };
    }
    if (!verification.ok) return { ok: false, projectId, reason: `auth_${verification.reason}` };
  }
  let runtime: Awaited<ReturnType<RuntimeOrchestrator["getRuntimeState"]>>;
  try {
    runtime = await options.runtimeOrchestrator.getRuntimeState(projectId);
  } catch (error) {
    return { ok: false, projectId, reason: "runtime_error", details: { phase: "lookup", error: formatErrorMessage(error) } };
  }
  let port = runtime.status === "running" ? runtime.port : null;
  if (!port && runtime.enabled && runtime.status === "stopped") {
    try {
      const resumed = await options.runtimeOrchestrator.resumePreview(projectId);
      if (resumed.success) port = resumed.port;
    } catch (error) {
      return { ok: false, projectId, reason: "runtime_error", details: { phase: "resume", error: formatErrorMessage(error) } };
    }
  }
  if (!port) {
    return {
      ok: false,
      projectId,
      reason: "runtime_not_running",
      details: { status: runtime.status, enabled: runtime.enabled, port: runtime.port, previewUrl: runtime.previewUrl },
    };
  }
  try {
    await options.runtimeOrchestrator.touchLastAccessed(projectId);
  } catch (error) {
    console.warn(JSON.stringify({
      event: "preview_router_touch_failed",
      projectId,
      error: formatErrorMessage(error),
    }));
  }
  return { ok: true, projectId, target: `http://127.0.0.1:${port}` };
}

function statusForReject(result: Extract<ProxyTargetResult, { ok: false }>) {
  if (result.reason.startsWith("auth_")) return 401;
  if (result.reason === "runtime_error") return 503;
  return 404;
}

function bodyForReject(result: Extract<ProxyTargetResult, { ok: false }>) {
  if (result.reason.startsWith("auth_")) return "Preview access required.";
  if (result.reason === "runtime_error") return "Preview unavailable.";
  return "Preview not found.";
}

function safeEndResponse(response: ServerResponse, statusCode: number, body: string) {
  if (response.destroyed || response.writableEnded) return;
  if (!response.headersSent) response.statusCode = statusCode;
  response.end(body);
}

function safeCloseSocket(socket: NodeJS.WritableStream & { destroyed?: boolean; destroy?: () => void }, statusCode: number) {
  if (socket.destroyed) return;
  try {
    socket.write(`HTTP/1.1 ${statusCode} ${statusCode === 401 ? "Unauthorized" : statusCode === 503 ? "Service Unavailable" : "Not Found"}\r\n\r\n`);
  } catch {
    // Socket may already be closed.
  } finally {
    socket.destroy?.();
  }
}

function logRouterError(event: string, request: IncomingMessage | undefined, error: unknown) {
  console.warn(JSON.stringify({
    event,
    host: request?.headers.host,
    error: formatErrorMessage(error),
  }));
}

function formatErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200);
}

function logRouterReject(request: IncomingMessage, result: Extract<ProxyTargetResult, { ok: false }>) {
  console.info(JSON.stringify({
    event: "preview_router_rejected",
    host: request.headers.host,
    reason: result.reason,
    projectId: result.projectId,
    details: result.details,
  }));
}

function stripFrameBlockingHeaders(proxyRes: IncomingMessage) {
  delete proxyRes.headers["x-frame-options"];
  delete proxyRes.headers["content-security-policy"];
  delete proxyRes.headers["content-security-policy-report-only"];
}

function readCookie(header: string | undefined, name: string) {
  if (!header) return null;
  const cookies = header.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const match = cookies.find((cookie) => cookie.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}
