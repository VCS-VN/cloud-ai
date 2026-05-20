export type PackageInstallType = "dependencies" | "devDependencies";

export type InitialProjectPackage = {
  name: string;
  version: string;
  installType: PackageInstallType;
  reason?: string;
  canOverride?: boolean;
};

export type PackageVersionOverride = {
  name: string;
  version: string;
};

export const INITIAL_PROJECT_PACKAGES: InitialProjectPackage[] = [
  { name: "@hookform/resolvers", version: "^5.2.2", installType: "dependencies", reason: "Resolver layer for forms." },
  { name: "@radix-ui/react-dialog", version: "^1.1.6", installType: "dependencies", reason: "shadcn Dialog/Sheet primitive." },
  { name: "@radix-ui/react-label", version: "^2.1.2", installType: "dependencies", reason: "shadcn Label primitive." },
  { name: "@radix-ui/react-radio-group", version: "^1.2.3", installType: "dependencies", reason: "shadcn Radio Group primitive." },
  { name: "@radix-ui/react-select", version: "^2.1.6", installType: "dependencies", reason: "shadcn Select primitive." },
  { name: "@radix-ui/react-separator", version: "^1.1.2", installType: "dependencies", reason: "shadcn Separator primitive." },
  { name: "@radix-ui/react-slot", version: "^1.1.2", installType: "dependencies", reason: "shadcn Button slot primitive." },
  { name: "@tanstack/react-query", version: "^5.100.9", installType: "dependencies", reason: "Server-state/cache layer." },
  { name: "@tanstack/react-router", version: "^1.169.1", installType: "dependencies", reason: "Routing for generated app." },
  { name: "@tanstack/react-start", version: "^1.167.62", installType: "dependencies", reason: "Full-stack React framework." },
  { name: "@vitejs/plugin-react", version: "6.0.1", installType: "dependencies", reason: "React plugin per policy." },
  { name: "axios", version: "^1.16.0", installType: "dependencies", reason: "HTTP client." },
  { name: "class-variance-authority", version: "^0.7.1", installType: "dependencies", reason: "shadcn component variants." },
  { name: "clsx", version: "^2.1.1", installType: "dependencies", reason: "Classname utility for shadcn." },
  { name: "dompurify", version: "^3.4.2", installType: "dependencies", reason: "HTML sanitization." },
  { name: "firebase", version: "^12.12.1", installType: "dependencies", reason: "Optional Firebase client SDK." },
  { name: "firebase-admin", version: "^13.8.0", installType: "dependencies", reason: "Optional server Firebase SDK." },
  { name: "jotai", version: "^2.20.0", installType: "dependencies", reason: "Lightweight client state." },
  { name: "lodash", version: "^4.17.21", installType: "dependencies", reason: "Safe-access and arithmetic helpers (get, divide, round) for price formatting." },
  { name: "lucide-react", version: "^1.14.0", installType: "dependencies", reason: "Icons." },
  { name: "react", version: "^19.2.6", installType: "dependencies", reason: "React runtime." },
  { name: "react-dom", version: "^19.2.6", installType: "dependencies", reason: "React DOM runtime." },
  { name: "react-hook-form", version: "^7.75.0", installType: "dependencies", reason: "Form handling." },
  { name: "sonner", version: "^2.0.7", installType: "dependencies", reason: "Toast notifications for checkout and cart feedback." },
  { name: "tailwind-merge", version: "^2.6.0", installType: "dependencies", reason: "Tailwind class merge utility for shadcn." },
  { name: "vaul", version: "^1.1.2", installType: "dependencies", reason: "Bottom-sheet drawer primitive used by product-detail mobile model picker." },
  { name: "zod", version: "^4.4.3", installType: "dependencies", reason: "Runtime validation." },
  { name: "@tanstack/router-cli", version: "1.77.7", installType: "devDependencies", reason: "Route generation." },
  { name: "@tanstack/router-plugin", version: "^1.167.22", installType: "devDependencies", reason: "Router Vite plugin." },
  { name: "@types/node", version: "25.6.0", installType: "devDependencies", reason: "Node types." },
  { name: "@types/lodash", version: "^4.17.13", installType: "devDependencies", reason: "Types for lodash." },
  { name: "@types/react", version: "19.2.14", installType: "devDependencies", reason: "React types." },
  { name: "@types/react-dom", version: "19.2.3", installType: "devDependencies", reason: "React DOM types." },
  { name: "autoprefixer", version: "^10.4.21", installType: "devDependencies", reason: "PostCSS plugin." },
  { name: "postcss", version: "^8.5.6", installType: "devDependencies", reason: "CSS pipeline." },
  { name: "tailwindcss", version: "^3.4.17", installType: "devDependencies", reason: "CSS framework." },
  { name: "tsx", version: "^4.21.0", installType: "devDependencies", reason: "TS scripts." },
  { name: "typescript", version: "^6.0.3", installType: "devDependencies", reason: "Compiler." },
  { name: "vite", version: "^8.0.11", installType: "devDependencies", reason: "Vite bundler." },
];

export function resolvePackageRegistry(args: { basePackages?: InitialProjectPackage[]; overrides?: PackageVersionOverride[] }) {
  const basePackages = args.basePackages ?? INITIAL_PROJECT_PACKAGES;
  const overrideMap = new Map((args.overrides ?? []).map((item) => [item.name, item.version]));
  return basePackages.map((pkg) => ({ ...pkg, version: (pkg.canOverride ?? true) ? (overrideMap.get(pkg.name) ?? pkg.version) : pkg.version }));
}

export function validatePackageRegistry(packages: InitialProjectPackage[]) {
  const seen = new Set<string>();
  for (const pkg of packages) {
    if (!pkg.name.trim()) throw new Error("Package registry contains an empty package name.");
    if (!pkg.version.trim()) throw new Error(`Package "${pkg.name}" is missing a version.`);
    if (pkg.installType !== "dependencies" && pkg.installType !== "devDependencies") throw new Error(`Package "${pkg.name}" has invalid installType: ${pkg.installType}`);
    if (seen.has(pkg.name)) throw new Error(`Duplicate package detected: ${pkg.name}`);
    seen.add(pkg.name);
  }
}

export function buildDependencyMaps(packages: InitialProjectPackage[]) {
  validatePackageRegistry(packages);
  return packages.reduce(
    (acc, pkg) => {
      acc[pkg.installType][pkg.name] = pkg.version;
      return acc;
    },
    { dependencies: {} as Record<string, string>, devDependencies: {} as Record<string, string> },
  );
}
