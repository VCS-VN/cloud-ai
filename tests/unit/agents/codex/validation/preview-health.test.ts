import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CORE_HARD_GATE_ROUTES,
  runPreviewHealth,
} from "@/features/agents/codex/validation/preview-health.server";
import { getPm2Instance } from "@/features/agents/codex/validation/pm2-status.server";

vi.mock("@/features/agents/codex/validation/pm2-status.server", () => ({
  getPm2Instance: vi.fn(),
}));

const mockedGetPm2Instance = vi.mocked(getPm2Instance);

const BASE_URL = "http://localhost:3000";

function makeFetch(handler: (url: string) => number) {
  return vi.fn().mockImplementation(async (url: string) => ({
    status: handler(url),
  })) as unknown as typeof fetch;
}

describe("runPreviewHealth", () => {
  beforeEach(() => {
    mockedGetPm2Instance.mockReset();
  });

  it("returns pm2_status_missing when pm2 instance is missing", async () => {
    mockedGetPm2Instance.mockResolvedValue({ name: "app", status: "missing" });

    const result = await runPreviewHealth({
      baseUrl: BASE_URL,
      pm2Name: "app",
      fetchImpl: makeFetch(() => 200),
    });

    expect(result.ok).toBe(false);
    expect(result.failureReason).toBe("pm2_status_missing");
  });

  it("returns root_not_ok when root returns 500", async () => {
    mockedGetPm2Instance.mockResolvedValue({ name: "app", status: "online" });

    const result = await runPreviewHealth({
      baseUrl: BASE_URL,
      pm2Name: "app",
      fetchImpl: makeFetch(() => 500),
    });

    expect(result.ok).toBe(false);
    expect(result.failureReason).toBe("root_not_ok");
    expect(result.rootStatus).toBe(500);
  });

  it("returns ok when root and all core routes return 200", async () => {
    mockedGetPm2Instance.mockResolvedValue({ name: "app", status: "online" });

    const result = await runPreviewHealth({
      baseUrl: BASE_URL,
      pm2Name: "app",
      fetchImpl: makeFetch(() => 200),
    });

    expect(result.ok).toBe(true);
    expect(result.failureReason).toBeUndefined();
    for (const route of CORE_HARD_GATE_ROUTES) {
      expect(
        result.routes.find((r) => r.url === route && r.required),
      ).toBeDefined();
    }
  });

  it("includes /products/:id when sampleProductId is provided", async () => {
    mockedGetPm2Instance.mockResolvedValue({ name: "app", status: "online" });

    const result = await runPreviewHealth({
      baseUrl: BASE_URL,
      pm2Name: "app",
      sampleProductId: "p1",
      fetchImpl: makeFetch(() => 200),
    });

    expect(result.ok).toBe(true);
    const detail = result.routes.find((r) => r.url === "/products/p1");
    expect(detail).toBeDefined();
    expect(detail?.required).toBe(true);
  });

  it("includes extraRoutes as required and passes when all 200", async () => {
    mockedGetPm2Instance.mockResolvedValue({ name: "app", status: "online" });

    const result = await runPreviewHealth({
      baseUrl: BASE_URL,
      pm2Name: "app",
      extraRoutes: ["/about"],
      fetchImpl: makeFetch(() => 200),
    });

    expect(result.ok).toBe(true);
    const about = result.routes.find((r) => r.url === "/about");
    expect(about).toBeDefined();
    expect(about?.required).toBe(true);
  });

  it("fails with required_route_failed when a core route returns 404", async () => {
    mockedGetPm2Instance.mockResolvedValue({ name: "app", status: "online" });

    const result = await runPreviewHealth({
      baseUrl: BASE_URL,
      pm2Name: "app",
      fetchImpl: makeFetch((url) => (url.endsWith("/cart") ? 404 : 200)),
    });

    expect(result.ok).toBe(false);
    expect(result.failureReason?.startsWith("required_route_failed:")).toBe(
      true,
    );
  });

  it("treats optional route 404 as non-fatal and records optionalFailures", async () => {
    mockedGetPm2Instance.mockResolvedValue({ name: "app", status: "online" });

    const result = await runPreviewHealth({
      baseUrl: BASE_URL,
      pm2Name: "app",
      optionalRoutes: ["/blog"],
      fetchImpl: makeFetch((url) => (url.endsWith("/blog") ? 404 : 200)),
    });

    expect(result.ok).toBe(true);
    expect(result.optionalFailures).toEqual(["/blog"]);
  });
});
