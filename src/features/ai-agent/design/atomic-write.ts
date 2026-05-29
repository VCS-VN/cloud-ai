import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

export async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const suffix = randomBytes(6).toString("hex");
  const tmpPath = `${filePath}.tmp-${suffix}`;
  let handle: import("node:fs").promises.FileHandle | undefined;
  try {
    handle = await fs.open(tmpPath, "w");
    await handle.writeFile(content, "utf8");
    try {
      await handle.sync();
    } catch {
      // sync may not be supported on every platform; ignore
    }
  } finally {
    if (handle) await handle.close();
  }
  try {
    await fs.rename(tmpPath, filePath);
  } catch (error) {
    await fs.unlink(tmpPath).catch(() => undefined);
    throw error;
  }
}
