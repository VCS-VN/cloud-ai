import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildCssVariableMapping,
  replaceOwnedDesignTokenRegion,
} from "./design-token-mapping-service.server";

export async function patchAppCssFromDesignSource(
  workspaceRoot: string,
  designSource: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const appCssPath = path.join(workspaceRoot, "src/styles/app.css");
  try {
    const appCss = await readFile(appCssPath, "utf8");
    const mapping = buildCssVariableMapping(designSource);
    const mapped = replaceOwnedDesignTokenRegion(appCss, mapping);
    if (!mapped.ok) {
      return { ok: false, message: mapped.message };
    }
    await writeFile(appCssPath, mapped.content, "utf8");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message };
  }
}
