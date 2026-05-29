import { loadBlockLibrary, loadCategoryTaxonomy, loadReferencePool, clearLoaderCache } from "../src/features/ai-agent/design/library-loader.server";

async function main() {
  clearLoaderCache();
  try {
    const taxonomy = await loadCategoryTaxonomy();
    const pool = await loadReferencePool();
    const library = await loadBlockLibrary();
    const subTotal = taxonomy.primary.reduce((s, p) => s + p.subcategories.length, 0);
    console.log(`PASS — categories: ${taxonomy.primary.length} primary / ${subTotal} subcategories`);
    console.log(`PASS — reference pool: ${pool.anchors.length} anchors / ${pool.examples.length} examples`);
    console.log(`PASS — block library: ${library.blocks.length} blocks`);
    process.exit(0);
  } catch (err) {
    console.error("FAIL —", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
