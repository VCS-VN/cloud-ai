import "@tanstack/react-start/server-only";
import axios, { AxiosError } from "axios";
import { AuthError } from "./auth-errors";
import {
  getEpisCloudBaseUrl,
  getEpisCloudGatewayBaseUrl,
  getEpisCloudPartnerToken,
} from "./episcloud-config";
import type {
  BalanceSummary,
  EpisCloudModel,
  PaymentConfig,
  PaymentMethodsResult,
  TopupBalanceResult,
} from "./types";

const EPISCLOUD_ALLOWED_MODEL_IDS = new Set<string>([
  "episcloud-ai-coder",
  "episcloud-ai-coder-max",
]);

// "episcloud-ai-coder-max" -> "AI Coder Max": drop the episcloud- prefix,
// title-case each segment, and uppercase the "ai" acronym.
function formatEpisCloudModelName(id: string): string {
  return id
    .replace(/^episcloud-/, "")
    .split("-")
    .map((part) =>
      part === "ai" ? "AI" : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join(" ");
}

type EpisCloudAccount = {
  tenant_id: string;
  slug: string;
  display_name: string;
  status: string;
  created_at: number;
};

type EpisCloudApiKey = {
  id: string;
  raw_secret: string;
  prefix: string;
  name: string;
  monthly_cap_cents: number;
  created_at: number;
};

type EpisCloudErrorEnvelope = {
  error?: { code?: string; message?: string };
};

function logEpisCloudError(event: string, error: unknown) {
  if (error instanceof AxiosError) {
    const data = error.response?.data as EpisCloudErrorEnvelope | undefined;
    console.error(
      JSON.stringify({
        event,
        status: error.response?.status,
        code: data?.error?.code,
        message: data?.error?.message,
        reason: error.message,
      }),
    );
    return;
  }
  console.error(
    JSON.stringify({
      event,
      reason: error instanceof Error ? error.message : "unknown",
    }),
  );
}

export class EpisCloudClient {
  async createAccount(input: {
    externalRef: string;
    displayName: string;
  }): Promise<EpisCloudAccount> {
    console.log(
      "jasodfjoasjodf",
      `Bearer ${getEpisCloudPartnerToken()}`,
      `${getEpisCloudBaseUrl()}/v1/partner/accounts`,
      JSON.stringify({
        external_ref: input.externalRef,
        display_name: input.displayName,
      }),
    );
    try {
      const response = await axios.post<EpisCloudAccount>(
        `${getEpisCloudBaseUrl()}/v1/partner/accounts`,
        { external_ref: input.externalRef, display_name: input.displayName },
        {
          headers: {
            Authorization: `Bearer ${getEpisCloudPartnerToken()}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (!response.data?.tenant_id)
        throw new AuthError("episcloud-activation-failed");
      return response.data;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      logEpisCloudError("episcloud_create_account_failed", error);
      throw new AuthError("episcloud-activation-failed");
    }
  }

  async createApiKey(input: {
    tenantId: string;
    name: string;
    monthlyCapCents?: number;
  }): Promise<EpisCloudApiKey> {
    try {
      const response = await axios.post<EpisCloudApiKey>(
        `${getEpisCloudBaseUrl()}/v1/partner/accounts/${encodeURIComponent(input.tenantId)}/api-keys`,
        { name: input.name, monthly_cap_cents: input.monthlyCapCents ?? 0 },
        {
          headers: {
            Authorization: `Bearer ${getEpisCloudPartnerToken()}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (!response.data?.raw_secret || !response.data?.id)
        throw new AuthError("episcloud-api-key-failed");
      return response.data;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      logEpisCloudError("episcloud_create_api_key_failed", error);
      throw new AuthError("episcloud-api-key-failed");
    }
  }

  async listModels(apiKey: string): Promise<EpisCloudModel[]> {
    try {
      const response = await axios.get<{
        data?: Array<{ id?: string; owned_by?: string }>;
      }>(`${getEpisCloudGatewayBaseUrl()}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const rows = response.data?.data;
      if (!Array.isArray(rows)) throw new AuthError("episcloud-models-failed");
      return rows
        .filter((row): row is { id: string; owned_by?: string } =>
          Boolean(row?.id) && EPISCLOUD_ALLOWED_MODEL_IDS.has(row.id as string),
        )
        .map((row) => ({
          id: row.id,
          name: formatEpisCloudModelName(row.id),
          ownedBy: row.owned_by,
        }));
    } catch (error) {
      if (error instanceof AuthError) throw error;
      logEpisCloudError("episcloud_list_models_failed", error);
      throw new AuthError("episcloud-models-failed");
    }
  }

  async getPaymentConfig(intentId: string): Promise<PaymentConfig> {
    try {
      const response = await axios.get<PaymentConfig>(
        `${getEpisCloudBaseUrl()}/v1/partner/accounts/${encodeURIComponent(intentId)}/payment-config`,
        {
          headers: {
            Authorization: `Bearer ${getEpisCloudPartnerToken()}`,
          },
        },
      );
      if (!response.data?.stripe && !response.data?.paypal)
        throw new AuthError("payment-config-failed");
      return response.data;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      logEpisCloudError("episcloud_payment_config_failed", error);
      throw new AuthError("payment-config-failed");
    }
  }

  async listPaymentMethods(intentId: string): Promise<PaymentMethodsResult> {
    try {
      const response = await axios.get<PaymentMethodsResult>(
        `${getEpisCloudBaseUrl()}/v1/partner/accounts/${encodeURIComponent(intentId)}/payment-methods`,
        {
          headers: {
            Authorization: `Bearer ${getEpisCloudPartnerToken()}`,
          },
        },
      );
      if (!Array.isArray(response.data?.payment_methods))
        throw new AuthError("payment-methods-failed");
      return response.data;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      logEpisCloudError("episcloud_payment_methods_failed", error);
      throw new AuthError("payment-methods-failed");
    }
  }

  async topupBalance(
    intentId: string,
    input: {
      amountMicroUsd: number;
      reason: string;
      paymentMethodId?: string;
    },
  ): Promise<TopupBalanceResult> {
    try {
      const response = await axios.post<TopupBalanceResult>(
        `${getEpisCloudBaseUrl()}/v1/partner/accounts/${encodeURIComponent(intentId)}/balance/topup`,
        {
          amount_micro_usd: input.amountMicroUsd,
          currency: "USD",
          reason: input.reason,
          ...(input.paymentMethodId
            ? { payment_method_id: input.paymentMethodId }
            : {}),
        },
        {
          headers: {
            Authorization: `Bearer ${getEpisCloudPartnerToken()}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (typeof response.data?.balance_micro_usd_after !== "number")
        throw new AuthError("topup-failed");
      return response.data;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      logEpisCloudError("episcloud_topup_failed", error);
      throw new AuthError("topup-failed");
    }
  }

  async getBalanceSummary(intentId: string): Promise<BalanceSummary> {
    try {
      const response = await axios.get<BalanceSummary>(
        `${getEpisCloudBaseUrl()}/v1/partner/accounts/${encodeURIComponent(intentId)}/balance/summary`,
        {
          headers: {
            Authorization: `Bearer ${getEpisCloudPartnerToken()}`,
          },
        },
      );
      if (typeof response.data?.remaining_micro_usd !== "number")
        throw new AuthError("balance-summary-failed");
      return response.data;
    } catch (error) {
      if (error instanceof AuthError) throw error;
      logEpisCloudError("episcloud_balance_summary_failed", error);
      throw new AuthError("balance-summary-failed");
    }
  }
}
