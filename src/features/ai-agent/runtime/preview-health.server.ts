import axios from "axios";

export type PreviewHealthOptions = {
  timeoutMs?: number;
  intervalMs?: number;
  request?: (url: string) => Promise<{ status: number }>;
};

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_INTERVAL_MS = 500;

export async function waitForPreviewHealthy(
  previewUrl: string,
  options: PreviewHealthOptions = {},
): Promise<boolean> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const request = options.request ?? defaultRequest;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    try {
      const response = await request(previewUrl);
      if (response.status < 500) return true;
    } catch {
      // Retry until timeout. Dev servers often accept sockets before bundles are ready.
    }
    if (Date.now() > deadline) break;
    await sleep(Math.min(intervalMs, Math.max(0, deadline - Date.now())));
  }

  return false;
}

async function defaultRequest(url: string) {
  return axios.get(url, { validateStatus: () => true });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
