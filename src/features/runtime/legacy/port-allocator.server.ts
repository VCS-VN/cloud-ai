import net from "node:net";
import { getPreviewRuntimeConfig } from "./preview-runtime-config.server";

export type PortAllocator = {
  allocate(input: AllocateInput): Promise<number>;
  release(port: number | null | undefined): Promise<void>;
};

export type AllocateInput = {
  projectId: string;
  preferredPort?: number | null;
  reservedPorts: ReadonlySet<number>;
};

export class InMemoryPortAllocator implements PortAllocator {
  private readonly inUse = new Set<number>();

  constructor(private readonly isPortFree: (port: number) => Promise<boolean> = isLocalPortFree) {}

  async allocate({ preferredPort, reservedPorts }: AllocateInput): Promise<number> {
    const { portMin, portMax } = getPreviewRuntimeConfig();
    const taken = new Set<number>([...reservedPorts, ...this.inUse]);

    if (preferredPort && preferredPort >= portMin && preferredPort <= portMax && !taken.has(preferredPort) && (await this.isPortFree(preferredPort))) {
      this.inUse.add(preferredPort);
      return preferredPort;
    }

    for (let port = portMin; port <= portMax; port += 1) {
      if (taken.has(port)) continue;
      if (!(await this.isPortFree(port))) continue;
      this.inUse.add(port);
      return port;
    }

    throw new Error("No preview port available in the configured range.");
  }

  async release(port: number | null | undefined) {
    if (typeof port !== "number") return;
    this.inUse.delete(port);
  }


}

function isLocalPortFree(port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const tester = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        tester.close(() => resolve(true));
      });
    tester.listen(port, "127.0.0.1");
  });
}
