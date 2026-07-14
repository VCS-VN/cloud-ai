console.log("🚀 ~ AuthService ~ listEpisCloudModels ~ error:", error);
import { redirect } from "@tanstack/react-router";
import { AuthError, getSafeAuthMessage, toSafeAuthError } from "./auth-errors";
import {
  mapDecodedTokenToUserProfile,
  verifyIdToken,
} from "./firebase-admin.server";
import { encryptUserApiKey, decryptUserApiKey } from "./api-key-crypto.server";
import { MerchantGatewayClient } from "./oauth-client.server";
import { EpisCloudClient } from "./episcloud-client.server";
import type {
  EpisCloudModelsResult,
  LoginResult,
  TopupBalanceInput,
} from "./types";
import { toAuthUserSummary, UserRepository } from "./user-repository";
import { UserSettingsRepository } from "./user-settings-repository";
import { SessionService } from "./session-service.server";

export class AuthService {
  constructor(
    private readonly users = new UserRepository(),
    private readonly sessions = new SessionService(),
    private readonly merchantGateway = new MerchantGatewayClient(),
    private readonly episCloud = new EpisCloudClient(),
    private readonly userSettings = new UserSettingsRepository(),
  ) {}

  async signInWithFirebaseIdToken(idToken: string): Promise<LoginResult> {
    if (!idToken || typeof idToken !== "string")
      return toSafeAuthError(new AuthError("missing-token"));

    try {
      const decoded = await verifyIdToken(idToken);
      const profile = mapDecodedTokenToUserProfile(decoded);
      const user = await this.users.upsertFromFirebase(profile);
      await this.sessions.createSessionCookie(user);
      return {
        ok: true,
        user: toAuthUserSummary(user),
        redirectTo: "/dashboard",
      };
    } catch (error) {
      return toSafeAuthError(error);
    }
  }

  async signInWithHandoffCode(code: string): Promise<LoginResult> {
    if (!code || typeof code !== "string") {
      return toSafeAuthError(new AuthError("handoff-code-missing"));
    }

    try {
      const tokenSet = await this.merchantGateway.exchangeHandoffCode({ code });
      const profile = await this.merchantGateway.getProfile({
        apiKey: tokenSet.apiKey,
      });
      const user = await this.users.upsertFromOAuth({
        providerUid: profile.id,
        email: profile.email,
        displayName: profile.name,
        provider: "MONMI_OAUTH",
        apiKey: encryptUserApiKey(tokenSet.apiKey),
      });

      await this.sessions.createSessionCookie(user);

      return {
        ok: true,
        user: toAuthUserSummary(user),
        redirectTo: "/dashboard",
      };
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "cloud_ai_handoff_login_failed",
          reason:
            error instanceof AuthError
              ? error.code
              : error instanceof Error
                ? error.message
                : "unknown",
        }),
      );
      return toSafeAuthError(error, "handoff-login-failed");
    }
  }

  async getCurrentUser() {
    const session = await this.sessions.readSession();
    if (!session) return null;
    const user = await this.users.findById(session.userId);
    return user ? toAuthUserSummary(user) : null;
  }

  async requireUser() {
    const user = await this.getCurrentUser();
    if (!user) throw redirect({ to: "/" });
    return user;
  }

  async requireActionUser() {
    const user = await this.getCurrentUser();
    if (!user) throw new AuthError("unauthorized");
    return user;
  }

  async updateProfile(fields: {
    displayName: string | null;
    bio: string | null;
    photoUrl: string | null;
    coverImage: string | null;
    dateOfBirth: string | null;
  }) {
    const current = await this.requireActionUser();
    const updated = await this.users.updateProfile(current.id, fields);
    return toAuthUserSummary(updated);
  }

  async activateEpisCloud() {
    const current = await this.requireActionUser();
    const user = await this.users.findById(current.id);
    if (!user) throw new AuthError("unauthorized");

    let result = user;
    let tenantId = user.episCloudTenantId;

    if (!tenantId) {
      const account = await this.episCloud.createAccount({
        externalRef: user.id,
        displayName: user.displayName ?? user.email,
      });
      tenantId = account.tenant_id;
      result = await this.users.activateEpisCloud(user.id, tenantId);
    }

    const settings = await this.userSettings.findByUserId(user.id);
    if (!settings?.episCloudApiKey) {
      const apiKey = await this.episCloud.createApiKey({
        tenantId,
        name: "retail-default",
      });
      await this.userSettings.saveEpisCloudApiKey(user.id, {
        encryptedSecret: encryptUserApiKey(apiKey.raw_secret),
        keyId: apiKey.id,
        prefix: apiKey.prefix,
      });
    }

    return toAuthUserSummary(result);
  }

  async getPaymentConfig() {
    const current = await this.requireActionUser();
    if (!current.episCloudTenantId)
      throw new AuthError("episcloud-not-activated");
    return this.episCloud.getPaymentConfig(current.episCloudTenantId);
  }

  async listPaymentMethods() {
    const current = await this.requireActionUser();
    if (!current.episCloudTenantId)
      throw new AuthError("episcloud-not-activated");
    return this.episCloud.listPaymentMethods(current.episCloudTenantId);
  }

  async getBalanceSummary() {
    const current = await this.requireActionUser();
    if (!current.episCloudTenantId)
      throw new AuthError("episcloud-not-activated");
    return this.episCloud.getBalanceSummary(current.episCloudTenantId);
  }

  async topupBalance(input: TopupBalanceInput) {
    const current = await this.requireActionUser();
    if (!current.episCloudTenantId)
      throw new AuthError("episcloud-not-activated");
    if (!Number.isInteger(input.amountMicroUsd) || input.amountMicroUsd <= 0)
      throw new AuthError("topup-failed");
    return this.episCloud.topupBalance(current.episCloudTenantId, {
      amountMicroUsd: input.amountMicroUsd,
      reason: input.reason,
      paymentMethodId: input.paymentMethodId,
    });
  }

  async listEpisCloudModels(): Promise<EpisCloudModelsResult> {
    const current = await this.requireActionUser();
    const settings = await this.userSettings.findByUserId(current.id);
    if (!settings?.episCloudApiKey) return { status: "no-api-key" };

    try {
      const apiKey = decryptUserApiKey(settings.episCloudApiKey);
      console.log("🚀 ~ AuthService ~ listEpisCloudModels ~ apiKey:", apiKey);
      const models = await this.episCloud.listModels(apiKey);
      return { status: "ok", models };
    } catch (error) {
      console.log("ajsdofjoasdosdf", error);
      const code =
        error instanceof AuthError ? error.code : "episcloud-models-failed";
      return { status: "error", message: getSafeAuthMessage(code) };
    }
  }

  async requireMerchantApiKey() {
    const session = await this.sessions.readSession();
    if (!session) throw new AuthError("unauthorized");

    const user = await this.users.findById(session.userId);
    if (!user?.apiKey) throw new AuthError("unauthorized");

    return decryptUserApiKey(user.apiKey);
  }

  async requireEpisCloudApiKey() {
    const session = await this.sessions.readSession();
    if (!session) throw new AuthError("unauthorized");

    const settings = await this.userSettings.findByUserId(session.userId);
    if (!settings?.episCloudApiKey)
      throw new AuthError("episcloud-api-key-failed");

    return decryptUserApiKey(settings.episCloudApiKey);
  }

  async getEpisCloudApiKeyForUserId(userId: string): Promise<string | null> {
    const settings = await this.userSettings.findByUserId(userId);
    if (!settings?.episCloudApiKey) return null;

    const result = decryptUserApiKey(settings.episCloudApiKey);
    console.log(
      "🚀 ~ AuthService ~ getEpisCloudApiKeyForUserId ~ result:",
      result,
    );
    return result;
  }

  async logout() {
    const session = await this.sessions.readSession();
    if (session) await this.users.clearApiKey(session.userId);
    await this.sessions.clearSessionCookie();
    return { ok: true as const, redirectTo: "/" as const };
  }
}

export function getAuthService() {
  return new AuthService();
}
