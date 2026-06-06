import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parseProductsSample } from "@/features/agents/codex/validation/product-sample-parser.server";

const REL = "src/shared/sample-data/products.ts";

const tmpDirs: string[] = [];

async function makeWorkspace(contents: string | null): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "product-sample-parser-"));
  tmpDirs.push(tmp);
  if (contents !== null) {
    const full = path.join(tmp, REL);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, contents, "utf8");
  }
  return tmp;
}

afterEach(async () => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (!dir) continue;
    await fs.rm(dir, { recursive: true, force: true });
  }
});

describe("parseProductsSample", () => {
  it("returns ok for a valid JSON-compatible export with picsum image", async () => {
    const src = `export const productsListSample = {
  total: 1,
  data: [
    {
      id: "p1",
      store: { slug: "acme" },
      image: "https://picsum.photos/seed/p1/600/600",
    },
  ],
};
`;
    const tmp = await makeWorkspace(src);
    const result = await parseProductsSample(tmp);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.productId).toBe("p1");
    expect(result.storeSlug).toBe("acme");
    expect(result.total).toBe(1);
    expect(result.productCount).toBe(1);
    expect(result.imageViolations).toEqual([]);
  });

  it("falls back to entityId when id is missing", async () => {
    const src = `export const productsListSample = {
  total: 1,
  data: [
    { entityId: "e2", store: { slug: "acme" } },
  ],
};
`;
    const tmp = await makeWorkspace(src);
    const result = await parseProductsSample(tmp);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.productId).toBe("e2");
  });

  it("falls back to defaultModel.productId when id and entityId are missing", async () => {
    const src = `export const productsListSample = {
  total: 1,
  data: [
    { defaultModel: { productId: "d3" }, store: { slug: "acme" } },
  ],
};
`;
    const tmp = await makeWorkspace(src);
    const result = await parseProductsSample(tmp);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.productId).toBe("d3");
  });

  it("rejects function calls inside the export", async () => {
    const src = `export const productsListSample = {
  total: 1,
  data: makeProducts(),
};
`;
    const tmp = await makeWorkspace(src);
    const result = await parseProductsSample(tmp);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("function_call_used");
  });

  it("rejects disallowed image URLs", async () => {
    const src = `export const productsListSample = {
  total: 1,
  data: [
    {
      id: "p1",
      store: { slug: "acme" },
      image: "https://example.com/foo.jpg",
    },
  ],
};
`;
    const tmp = await makeWorkspace(src);
    const result = await parseProductsSample(tmp);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("image_url_disallowed");
  });

  it("rejects missing total field as shape_invalid", async () => {
    const src = `export const productsListSample = {
  data: [
    { id: "p1", store: { slug: "acme" } },
  ],
};
`;
    const tmp = await makeWorkspace(src);
    const result = await parseProductsSample(tmp);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("shape_invalid");
  });

  it("returns file_not_found when the products file is missing", async () => {
    const tmp = await makeWorkspace(null);
    const result = await parseProductsSample(tmp);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("file_not_found");
  });
});
