import { getPm2Instance, type Pm2InstanceSummary } from "./pm2-status.server";

export const CORE_HARD_GATE_ROUTES: readonly string[] = [
  "/",
  "/products",
  "/cart",
  "/checkout",
];

export type PreviewHealthInput = {
  baseUrl: string;
  pm2Name: string;
  sampleProductId?: string;
  extraRoutes?: string[];
  optionalRoutes?: string[];
  fetchImpl?: typeof fetch;
};

export type PreviewHealthOutcome = {
  ok: boolean;
  pm2: Pm2InstanceSummary;
  rootStatus: number | "unreachable";
  routes: { url: string; status: number | "unreachable"; required: boolean; ok: boolean }[];
  optionalFailures: string[];
  failureReason?: string;
};

async function probe(
  url: string,
  fetchImpl: typeof fetch,
): Promise<number | "unreachable"> {
  try {
    const response = await fetchImpl(url, { method: "GET", redirect: "manual" });
    return response.status;
  } catch {
    return "unreachable";
  }
}

export async function runPreviewHealth(
  input: PreviewHealthInput,
): Promise<PreviewHealthOutcome> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const pm2 = await getPm2Instance(input.pm2Name);
  if (pm2.status !== "online") {
    return {
      ok: false,
      pm2,
      rootStatus: "unreachable",
      routes: [],
      optionalFailures: [],
      failureReason: `pm2_status_${pm2.status}`,
    };
  }

  const rootStatus = await probe(input.baseUrl.replace(/\/$/, "") + "/", fetchImpl);
  if (rootStatus !== 200) {
    return {
      ok: false,
      pm2,
      rootStatus,
      routes: [],
      optionalFailures: [],
      failureReason: "root_not_ok",
    };
  }

  const required: string[] = [];
  for (const route of CORE_HARD_GATE_ROUTES) required.push(route);
  if (input.sampleProductId) {
    required.push(`/products/${input.sampleProductId}`);
  }
  for (const extra of input.extraRoutes ?? []) {
    if (!required.includes(extra)) required.push(extra);
  }

  const optional = input.optionalRoutes ?? [];

  const baseUrl = input.baseUrl.replace(/\/$/, "");
  const routes: PreviewHealthOutcome["routes"] = [];

  for (const route of required) {
    const status = await probe(baseUrl + route, fetchImpl);
    routes.push({
      url: route,
      status,
      required: true,
      ok: status === 200,
    });
  }
  const optionalFailures: string[] = [];
  for (const route of optional) {
    const status = await probe(baseUrl + route, fetchImpl);
    routes.push({
      url: route,
      status,
      required: false,
      ok: status === 200,
    });
    if (status !== 200) optionalFailures.push(route);
  }

  const requiredFailed = routes.find((r) => r.required && !r.ok);
  if (requiredFailed) {
    return {
      ok: false,
      pm2,
      rootStatus,
      routes,
      optionalFailures,
      failureReason: `required_route_failed:${requiredFailed.url}`,
    };
  }

  return {
    ok: true,
    pm2,
    rootStatus,
    routes,
    optionalFailures,
  };
}
