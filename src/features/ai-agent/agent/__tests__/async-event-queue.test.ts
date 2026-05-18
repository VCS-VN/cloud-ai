import { describe, expect, it } from "vitest";
import { AsyncEventQueue } from "../async-event-queue";

describe("AsyncEventQueue", () => {
  it("yields events pushed before drain begins", async () => {
    const queue = new AsyncEventQueue<number>();
    queue.push(1);
    queue.push(2);
    queue.close();
    const collected: number[] = [];
    for await (const event of queue.drain()) {
      collected.push(event);
    }
    expect(collected).toEqual([1, 2]);
  });

  it("yields events pushed after drain has started", async () => {
    const queue = new AsyncEventQueue<string>();
    const collected: string[] = [];
    const drainPromise = (async () => {
      for await (const event of queue.drain()) {
        collected.push(event);
      }
    })();
    queue.push("a");
    await new Promise((r) => setTimeout(r, 5));
    queue.push("b");
    queue.close();
    await drainPromise;
    expect(collected).toEqual(["a", "b"]);
  });

  it("close terminates drain even with no events", async () => {
    const queue = new AsyncEventQueue<number>();
    setTimeout(() => queue.close(), 5);
    const collected: number[] = [];
    for await (const event of queue.drain()) {
      collected.push(event);
    }
    expect(collected).toEqual([]);
  });

  it("ignores push after close", async () => {
    const queue = new AsyncEventQueue<number>();
    queue.push(1);
    queue.close();
    queue.push(2);
    const collected: number[] = [];
    for await (const event of queue.drain()) {
      collected.push(event);
    }
    expect(collected).toEqual([1]);
  });

  it("preserves event ordering when interleaved with awaits", async () => {
    const queue = new AsyncEventQueue<number>();
    const collected: number[] = [];
    const drainPromise = (async () => {
      for await (const event of queue.drain()) {
        collected.push(event);
        await new Promise((r) => setTimeout(r, 1));
      }
    })();
    for (let i = 0; i < 10; i++) queue.push(i);
    queue.close();
    await drainPromise;
    expect(collected).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
