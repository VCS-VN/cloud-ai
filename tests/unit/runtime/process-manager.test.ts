import { describe, expect, it } from "vitest";
import { buildDevServerArgs, parseViteReady } from "@/features/runtime/legacy/process-manager.server";
import { buildPreviewPm2Args } from "@/features/runtime/legacy/pm2-driver.server";

describe("legacy ProcessManager helpers", () => {
  it("builds preview dev args with allocated port and localhost host binding", () => {
    expect(buildDevServerArgs(4317)).toEqual([
      "dev",
      "--port",
      "4317",
      "--host",
      "127.0.0.1",
    ]);
  });

  it("binds localhost even when no explicit port is passed", () => {
    expect(buildDevServerArgs(null)).toEqual(["dev", "--host", "127.0.0.1"]);
  });

  it("builds PM2 preview args without a script-argument separator", () => {
    expect(buildPreviewPm2Args(4317)).toEqual([
      "dev",
      "--port",
      "4317",
      "--host",
      "127.0.0.1",
    ]);
  });

  it("keeps parsing Vite ready output", () => {
    expect(parseViteReady("  ➜  Local:   http://127.0.0.1:4317/")).toEqual({
      ready: true,
      url: "http://127.0.0.1:4317/",
      port: 4317,
    });
  });
});
