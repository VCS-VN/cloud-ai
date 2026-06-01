import { readFile } from "node:fs/promises";
import path from "node:path";
import type { WebsiteSpec } from "../project/project-state.schema";

const INIT_PROMPT_LAYERS_RELATIVE_PATH = "templates/init-prompt";
const MANIFEST_FILE = "manifest.json";

type ManifestEntry = {
  marker: string;
  order: number;
  file?: string;
  type?: "dynamic";
};

type LoadedLayer = {
  marker: string;
  order: number;
  /** Static body loaded from disk (frontmatter stripped). Undefined for dynamic markers. */
  body?: string;
  dynamic: boolean;
};

/**
 * Strip a leading YAML frontmatter block (--- ... ---) used to carry
 * human-facing warnings/metadata that must NOT reach the model. Everything
 * after the closing fence is the prompt body.
 */
function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) return content.trim();
  const end = content.indexOf("\n---", 3);
  if (end === -1) return content.trim();
  const afterFence = content.indexOf("\n", end + 1);
  if (afterFence === -1) return "";
  return content.slice(afterFence + 1).trim();
}

function resolveLayersDir(): string {
  return path.resolve(process.cwd(), INIT_PROMPT_LAYERS_RELATIVE_PATH);
}

/**
 * Loads the layered init-prompt templates from templates/init-prompt/ once at
 * boot and caches them for the whole process. Editing the .md files requires a
 * restart to take effect.
 *
 * Missing/empty layer files are warned-and-skipped (never throw) so a partial
 * edit cannot crash boot — the assembled prompt simply omits that marker.
 */
export class PromptLayerStore {
  private constructor(private readonly layers: LoadedLayer[]) {}

  static async loadFromDisk(): Promise<PromptLayerStore> {
    const dir = resolveLayersDir();
    let manifestRaw: string;
    try {
      manifestRaw = await readFile(path.join(dir, MANIFEST_FILE), "utf8");
    } catch (error) {
      console.warn(
        `[init-prompt] manifest not found at ${path.join(dir, MANIFEST_FILE)}; init prompt will be empty: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return new PromptLayerStore([]);
    }

    let entries: ManifestEntry[];
    try {
      const parsed = JSON.parse(manifestRaw) as { layers?: ManifestEntry[] };
      entries = Array.isArray(parsed.layers) ? parsed.layers : [];
    } catch (error) {
      console.warn(
        `[init-prompt] manifest is not valid JSON; init prompt will be empty: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return new PromptLayerStore([]);
    }

    const layers: LoadedLayer[] = [];
    for (const entry of entries) {
      if (entry.type === "dynamic") {
        layers.push({ marker: entry.marker, order: entry.order, dynamic: true });
        continue;
      }
      if (!entry.file) {
        console.warn(
          `[init-prompt] layer ${entry.marker} has no file and is not dynamic; skipped.`,
        );
        continue;
      }
      try {
        const raw = await readFile(path.join(dir, entry.file), "utf8");
        const body = stripFrontmatter(raw);
        if (!body) {
          console.warn(
            `[init-prompt] layer ${entry.marker} (${entry.file}) is empty after frontmatter strip; skipped.`,
          );
          continue;
        }
        layers.push({
          marker: entry.marker,
          order: entry.order,
          body,
          dynamic: false,
        });
      } catch (error) {
        console.warn(
          `[init-prompt] failed to read layer ${entry.marker} (${entry.file}); skipped: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    layers.sort((a, b) => a.order - b.order);
    return new PromptLayerStore(layers);
  }

  /**
   * Assemble the init prompt by wrapping each layer body in chunk-cat
   * delimiters. The dynamic BRIEF marker is filled from websiteSpec at call
   * time. Delimiters ARE sent to the model so it can distinguish layers.
   */
  assembleInitPrompt(input: { websiteSpec: WebsiteSpec }): string {
    const blocks: string[] = [];
    for (const layer of this.layers) {
      const body = layer.dynamic
        ? buildBriefBlock(input.websiteSpec)
        : layer.body;
      if (!body) continue;
      blocks.push(
        `=====START_OF_${layer.marker}=====\n${body}\n=====END_OF_${layer.marker}=====`,
      );
    }
    return blocks.join("\n\n");
  }
}

function buildBriefBlock(spec: WebsiteSpec): string {
  const productList = spec.products
    .map(
      (p) =>
        "- " +
        p.name +
        (p.price ? " ($" + p.price + ")" : "") +
        (p.category ? " [" + p.category + "]" : ""),
    )
    .join("\n");
  return [
    "STORE: " + spec.store.name + " (" + spec.store.type + ")",
    "PRODUCTS:",
    productList,
  ].join("\n");
}
