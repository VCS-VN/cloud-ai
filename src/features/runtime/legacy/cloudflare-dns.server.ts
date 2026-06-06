type FetchFn = typeof fetch;

export type CloudflareDnsClientOptions = {
  apiToken: string;
  zoneId: string;
  tunnelId: string;
  hostname: string;
  fetch?: FetchFn;
};

export type CloudflareDnsRecord = {
  recordId: string;
  hostname: string;
  target: string;
  proxied: boolean;
};

export type CloudflareDnsResult =
  | { ok: true; record: CloudflareDnsRecord }
  | { ok: false; error: string; operatorAttentionRequired: boolean };

const MAX_ATTEMPTS = 3;

export class CloudflareDnsClient {
  private readonly fetcher: FetchFn;

  constructor(private readonly options: CloudflareDnsClientOptions) {
    this.fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private get target() {
    return `${this.options.tunnelId}.cfargotunnel.com`;
  }

  async ensureRecord(): Promise<CloudflareDnsResult> {
    return this.runWithRetry("create", async () => {
      const existing = await this.findRecord();
      if (existing) {
        if (existing.target === this.target && existing.proxied) {
          return existing;
        }
        await this.updateRecord(existing.recordId);
        return { ...existing, target: this.target, proxied: true };
      }
      return this.createRecord();
    });
  }

  async deleteRecord(recordId?: string | null): Promise<CloudflareDnsResult> {
    return this.runWithRetry("delete", async () => {
      const target = recordId ?? (await this.findRecord())?.recordId;
      if (!target) {
        return { recordId: "", hostname: this.options.hostname, target: this.target, proxied: true };
      }
      const response = await this.fetcher(this.dnsRecordUrl(target), {
        method: "DELETE",
        headers: this.headers(),
      });
      if (!response.ok && response.status !== 404) {
        const body = await safeReadText(response);
        throw new Error(`Cloudflare DNS delete failed (${response.status}): ${body}`);
      }
      return { recordId: target, hostname: this.options.hostname, target: this.target, proxied: true };
    });
  }

  private async runWithRetry(operation: "create" | "delete", action: () => Promise<CloudflareDnsRecord>): Promise<CloudflareDnsResult> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const record = await action();
        return { ok: true, record };
      } catch (error) {
        lastError = error;
        if (attempt < MAX_ATTEMPTS) {
          await this.delay(2 ** attempt * 200);
        }
      }
    }
    return {
      ok: false,
      error: lastError instanceof Error ? lastError.message : `Cloudflare DNS ${operation} failed`,
      operatorAttentionRequired: true,
    };
  }

  private async findRecord(): Promise<CloudflareDnsRecord | null> {
    const url = new URL(this.zoneRecordsUrl());
    url.searchParams.set("type", "CNAME");
    url.searchParams.set("name", this.options.hostname);
    const response = await this.fetcher(url, { method: "GET", headers: this.headers() });
    if (!response.ok) {
      const body = await safeReadText(response);
      throw new Error(`Cloudflare DNS lookup failed (${response.status}): ${body}`);
    }
    const payload = (await response.json()) as { result?: Array<{ id: string; name: string; content: string; proxied: boolean }> };
    const first = payload.result?.[0];
    if (!first) return null;
    return { recordId: first.id, hostname: first.name, target: first.content, proxied: first.proxied };
  }

  private async createRecord(): Promise<CloudflareDnsRecord> {
    const response = await this.fetcher(this.zoneRecordsUrl(), {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ type: "CNAME", name: this.options.hostname, content: this.target, proxied: true }),
    });
    if (!response.ok) {
      const body = await safeReadText(response);
      throw new Error(`Cloudflare DNS create failed (${response.status}): ${body}`);
    }
    const payload = (await response.json()) as { result?: { id: string; name: string; content: string; proxied: boolean } };
    if (!payload.result) {
      throw new Error("Cloudflare DNS create returned empty result.");
    }
    return { recordId: payload.result.id, hostname: payload.result.name, target: payload.result.content, proxied: payload.result.proxied };
  }

  private async updateRecord(recordId: string) {
    const response = await this.fetcher(this.dnsRecordUrl(recordId), {
      method: "PUT",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ type: "CNAME", name: this.options.hostname, content: this.target, proxied: true }),
    });
    if (!response.ok) {
      const body = await safeReadText(response);
      throw new Error(`Cloudflare DNS update failed (${response.status}): ${body}`);
    }
  }

  private headers() {
    return { Authorization: `Bearer ${this.options.apiToken}` };
  }

  private zoneRecordsUrl() {
    return `https://api.cloudflare.com/client/v4/zones/${this.options.zoneId}/dns_records`;
  }

  private dnsRecordUrl(recordId: string) {
    return `${this.zoneRecordsUrl()}/${recordId}`;
  }

  private delay(ms: number) {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

async function safeReadText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "<no body>";
  }
}
