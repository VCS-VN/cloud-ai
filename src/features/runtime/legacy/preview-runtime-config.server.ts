import path from "node:path";

export type PreviewRuntimeConfig = {
  publicHost: string | null;
  portMin: number;
  portMax: number;
  maxConcurrentPreviews: number;
  tokenTtlSeconds: number;
  idleTimeoutSeconds: number;
  lazyResumeTimeoutSeconds: number;
  processMaxMemory: string;
  routerHost: string;
  routerPort: number;
  cloudflareApiToken: string | null;
  cloudflareZoneId: string | null;
  cloudflareTunnelId: string | null;
  pm2LogRoot: string;
};

function readIntEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function readStringEnv(name: string) {
  const raw = process.env[name]?.trim();
  return raw ? raw : null;
}

export function getPreviewRuntimeConfig(): PreviewRuntimeConfig {
  const portMin = readIntEnv("PREVIEW_PORT_MIN", 10000);
  const portMax = readIntEnv("PREVIEW_PORT_MAX", 19999);
  if (portMin > portMax) {
    throw new Error("PREVIEW_PORT_MIN must be less than or equal to PREVIEW_PORT_MAX.");
  }

  return {
    publicHost: readStringEnv("PREVIEW_PUBLIC_HOST"),
    portMin,
    portMax,
    maxConcurrentPreviews: readIntEnv("MAX_CONCURRENT_PREVIEWS", 8),
    tokenTtlSeconds: readIntEnv("PREVIEW_TOKEN_TTL_SECONDS", 900),
    idleTimeoutSeconds: readIntEnv("PREVIEW_IDLE_TIMEOUT_SECONDS", 1800),
    lazyResumeTimeoutSeconds: readIntEnv("PREVIEW_LAZY_RESUME_TIMEOUT_SECONDS", 30),
    processMaxMemory: process.env.PREVIEW_PROCESS_MAX_MEMORY?.trim() || "512M",
    routerHost: process.env.PREVIEW_ROUTER_HOST?.trim() || "127.0.0.1",
    routerPort: readIntEnv("PREVIEW_ROUTER_PORT", 9000),
    cloudflareApiToken: readStringEnv("CLOUDFLARE_API_TOKEN"),
    cloudflareZoneId: readStringEnv("CLOUDFLARE_ZONE_ID"),
    cloudflareTunnelId: readStringEnv("CLOUDFLARE_TUNNEL_ID"),
    pm2LogRoot: process.env.PREVIEW_PM2_LOG_ROOT?.trim() || path.join(process.env.HOME ?? process.cwd(), ".pm2", "logs"),
  };
}

export function isProductionPreviewEnabled(config = getPreviewRuntimeConfig()) {
  return Boolean(config.publicHost);
}
