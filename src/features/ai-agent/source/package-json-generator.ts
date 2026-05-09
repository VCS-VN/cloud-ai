import type { ProjectState } from "../project/project-state.schema";
import { buildDependencyMaps, resolvePackageRegistry, type InitialProjectPackage, type PackageVersionOverride } from "./package-registry";

export function createInitialPackageJson(args: {
  projectName: string;
  packageManager: ProjectState["stack"]["packageManager"];
  packages?: InitialProjectPackage[];
  overrides?: PackageVersionOverride[];
}) {
  const resolvedPackages = resolvePackageRegistry({ basePackages: args.packages, overrides: args.overrides });
  const { dependencies, devDependencies } = buildDependencyMaps(resolvedPackages);
  return {
    name: args.projectName,
    private: true,
    type: "module",
    scripts: {
      dev: "tsr generate && vite dev",
      build: "tsr generate && vite build",
      preview: "vite preview",
      typecheck: "tsc --noEmit",
      "routes:generate": "tanstack-router generate",
    },
    dependencies,
    devDependencies,
  };
}
