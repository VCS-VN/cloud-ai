import { createInitialPackageJson } from "./package-json-generator";

describe("createInitialPackageJson", () => {
  it("generates routes before dev and build commands", () => {
    const packageJson = createInitialPackageJson({
      projectName: "route-generation-storefront",
      packageManager: "pnpm",
    });

    expect(packageJson.scripts.dev).toBe("tsr generate && vite dev");
    expect(packageJson.scripts.build).toBe("tsr generate && vite build");
    expect(packageJson.scripts["routes:generate"]).toBe("tanstack-router generate");
  });
});
