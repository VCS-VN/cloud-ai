import { jwtVerify, SignJWT } from "jose";
import { getPreviewRuntimeConfig } from "./preview-runtime-config.server";

export type PreviewTokenClaims = {
  sub: string;
  projectId: string;
  aud: "preview";
  iss: "cloud-ai";
  iat?: number;
  exp?: number;
  jti?: string;
};

export type PreviewTokenServiceOptions = {
  secret?: string;
  canAccessProject?: (projectId: string, userId: string) => Promise<boolean>;
  now?: () => Date;
};

export const PREVIEW_TOKEN_COOKIE_NAME = "preview_token";

const encoder = new TextEncoder();

export class PreviewTokenService {
  constructor(private readonly options: PreviewTokenServiceOptions = {}) {}

  async issueToken(input: { projectId: string; userId: string }) {
    await this.assertProjectAccess(input.projectId, input.userId);
    const config = getPreviewRuntimeConfig();
    const now = Math.floor((this.options.now ?? (() => new Date()))().getTime() / 1000);
    const expiresAt = new Date((now + config.tokenTtlSeconds) * 1000).toISOString();
    const token = await new SignJWT({ projectId: input.projectId })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("cloud-ai")
      .setAudience("preview")
      .setSubject(input.userId)
      .setJti(crypto.randomUUID())
      .setIssuedAt(now)
      .setExpirationTime(now + config.tokenTtlSeconds)
      .sign(this.getKey());
    return { token, expiresAt };
  }

  async verifyToken(input: { token?: string | null; projectId: string }) {
    if (!input.token) return { ok: false as const, reason: "missing" as const };
    try {
      const { payload } = await jwtVerify(input.token, this.getKey(), {
        issuer: "cloud-ai",
        audience: "preview",
      });
      const userId = payload.sub;
      const projectId = typeof payload.projectId === "string" ? payload.projectId : null;
      if (!userId || projectId !== input.projectId) return { ok: false as const, reason: "project_mismatch" as const };
      await this.assertProjectAccess(projectId, userId);
      return { ok: true as const, userId, projectId };
    } catch {
      return { ok: false as const, reason: "invalid" as const };
    }
  }

  getCookieOptions() {
    const config = getPreviewRuntimeConfig();
    const production = process.env.NODE_ENV === "production";
    return {
      httpOnly: true,
      secure: production,
      sameSite: production ? "none" as const : "lax" as const,
      path: "/",
      maxAge: config.tokenTtlSeconds,
      ...(config.publicHost ? { domain: toCookieDomain(config.publicHost) } : {}),
    };
  }

  private async assertProjectAccess(projectId: string, userId: string) {
    if (!this.options.canAccessProject) return;
    if (!(await this.options.canAccessProject(projectId, userId))) {
      throw new Error("Preview access denied.");
    }
  }

  private getKey() {
    const secret = this.options.secret ?? process.env.PREVIEW_TOKEN_SECRET ?? process.env.SESSION_SECRET ?? "development-preview-token-secret-minimum-32-chars";
    if (secret.length < 32) throw new Error("PREVIEW_TOKEN_SECRET must be at least 32 characters.");
    return encoder.encode(secret);
  }
}

function toCookieDomain(publicHost: string) {
  const parts = publicHost.split(".");
  if (parts.length <= 2) return `.${publicHost}`;
  return `.${parts.slice(-2).join(".")}`;
}
