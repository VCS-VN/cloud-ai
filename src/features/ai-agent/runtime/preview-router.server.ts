import http, { type IncomingMessage, type ServerResponse } from "node:http";
import httpProxy from "http-proxy";
import type { RuntimeOrchestrator } from "./runtime-orchestrator.server";
import { PREVIEW_TOKEN_COOKIE_NAME, type PreviewTokenService } from "./preview-token-service.server";
import { getPreviewRuntimeConfig } from "./preview-runtime-config.server";

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

  server = http.createServer(async (request, response) => {
    await proxyRequest({ request, response, proxy, options });
  });

  server.on("upgrade", async (request, socket, head) => {
    const target = await resolveProxyTarget(request, options);
    if (!target) {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }
    proxy.ws(request, socket, head, { target });
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
  const target = await resolveProxyTarget(input.request, input.options);
  if (!target) {
    input.response.statusCode = 404;
    input.response.end("Preview not found.");
    return;
  }
  input.proxy.web(input.request, input.response, { target }, (error) => {
    input.response.statusCode = 503;
    input.response.end(error instanceof Error ? error.message : "Preview unavailable.");
  });
}

export async function resolveProxyTarget(request: IncomingMessage, options: PreviewRouterOptions) {
  const projectId = extractProjectIdFromPreviewHost(request.headers.host, options.publicHost);
  if (!projectId) return null;
  if (options.tokenService) {
    const token = readCookie(request.headers.cookie, PREVIEW_TOKEN_COOKIE_NAME);
    const verification = await options.tokenService.verifyToken({ token, projectId });
    if (!verification.ok) return null;
  }
  const runtime = await options.runtimeOrchestrator.getRuntimeState(projectId);
  let port = runtime.status === "running" ? runtime.port : null;
  if (!port && runtime.enabled && runtime.status === "stopped") {
    const resumed = await options.runtimeOrchestrator.resumePreview(projectId);
    if (resumed.success) port = resumed.port;
  }
  if (!port) return null;
  await options.runtimeOrchestrator.touchLastAccessed(projectId);
  return `http://127.0.0.1:${port}`;
}

function readCookie(header: string | undefined, name: string) {
  if (!header) return null;
  const cookies = header.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const match = cookies.find((cookie) => cookie.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}
