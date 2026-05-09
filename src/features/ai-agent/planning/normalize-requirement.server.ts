export async function normalizeRequirement(args: { prompt: string }) {
  return args.prompt.replace(/\s+/g, " ").trim();
}
