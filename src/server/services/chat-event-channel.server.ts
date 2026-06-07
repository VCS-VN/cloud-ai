import type { RunStreamEvent } from "@/shared/project-types";

type Subscriber = (event: RunStreamEvent) => void;

type Channel = {
  events: RunStreamEvent[];
  subscribers: Set<Subscriber>;
  terminal: boolean;
  evictAt: number | null;
};

const TERMINAL_TYPES: ReadonlySet<RunStreamEvent["type"]> = new Set([
  "run.completed",
  "run.failed",
  "run.stopped",
]);

const TERMINAL_RETENTION_MS = 5 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

const channels = new Map<string, Channel>();
let sweepTimer: ReturnType<typeof setInterval> | null = null;

function ensureSweep(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [runId, channel] of channels) {
      if (channel.evictAt !== null && now >= channel.evictAt && channel.subscribers.size === 0) {
        channels.delete(runId);
      }
    }
  }, SWEEP_INTERVAL_MS);
  if (typeof sweepTimer.unref === "function") sweepTimer.unref();
}

function getOrCreate(runId: string): Channel {
  let channel = channels.get(runId);
  if (!channel) {
    channel = { events: [], subscribers: new Set(), terminal: false, evictAt: null };
    channels.set(runId, channel);
    ensureSweep();
  }
  return channel;
}

/**
 * Push a translated RunStreamEvent to the channel for a run. Buffers the event
 * for late SSE consumers and fans out to live subscribers. On terminal events,
 * marks the channel evictable after TERMINAL_RETENTION_MS.
 */
export function publishChatEvent(runId: string, event: RunStreamEvent): void {
  const channel = getOrCreate(runId);
  channel.events.push(event);
  if (TERMINAL_TYPES.has(event.type)) {
    channel.terminal = true;
    channel.evictAt = Date.now() + TERMINAL_RETENTION_MS;
  }
  for (const listener of channel.subscribers) {
    try {
      listener(event);
    } catch {
      // ignore listener errors
    }
  }
}

/**
 * Open an SSE-style subscription. The handler is called with every buffered
 * event in order, then live for new events. Returns an unsubscribe function.
 */
export function subscribeChatEvents(
  runId: string,
  listener: Subscriber,
): { unsubscribe: () => void; terminal: boolean } {
  const channel = getOrCreate(runId);
  for (const buffered of channel.events) {
    try {
      listener(buffered);
    } catch {
      // ignore replay errors
    }
  }
  if (channel.terminal) {
    return { unsubscribe: () => undefined, terminal: true };
  }
  channel.subscribers.add(listener);
  return {
    unsubscribe: () => {
      channel.subscribers.delete(listener);
    },
    terminal: false,
  };
}

export function getChatChannelStatus(
  runId: string,
): { exists: boolean; eventCount: number; terminal: boolean; subscriberCount: number } {
  const channel = channels.get(runId);
  if (!channel) return { exists: false, eventCount: 0, terminal: false, subscriberCount: 0 };
  return {
    exists: true,
    eventCount: channel.events.length,
    terminal: channel.terminal,
    subscriberCount: channel.subscribers.size,
  };
}

export function resetChatChannelsForTest(): void {
  channels.clear();
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}
