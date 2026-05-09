const GENERATED_SOURCE_PATTERNS = [
  /^\.\.\/.*projects\//,
  /^\.\/projects\//,
  /^projects\//,
  /\/projects\/[^/]+\/src\//,
];

export function assertNoGeneratedStorefrontImports(importerPath: string, importSource: string) {
  const normalizedSource = importSource.replace(/\\/g, "/");
  if (importerPath.startsWith("src/") && GENERATED_SOURCE_PATTERNS.some((pattern) => pattern.test(normalizedSource))) {
    throw new Error("Builder Web source must not import generated storefront source directly.");
  }
}
