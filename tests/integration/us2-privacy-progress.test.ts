import { describe, expect, it } from "vitest";
import { runBuilderBridge } from "@/server/services/builder-run-bridge.server";
import { isPrivacySafe } from "@/server/functions/progress-mapper.server";
import type { BuilderRunEvent } from "@/features/agents/ui/builder-events";
import type { RunStreamEvent } from "@/shared/project-types";

async function* asAsync<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield item;
}

function makeAdapter() {
  const messages: Array<{ kind: string; content: string }> = [];
  const timeline: Array<{ kind: string; payload: unknown }> = [];
  const adapter = {
    messages,
    timeline,
    saveAgentMessage: async (i: { kind: string; content: string }) => {
      messages.push({ kind: i.kind, content: i.content });
    },
    appendProgressTimeline: async (i: { event: unknown }) => {
      timeline.push({ kind: (i.event as { kind: string }).kind, payload: i.event });
    },
    setRunStatus: async () => undefined,
  };
  return adapter;
}

const ADVERSARIAL_FILE_CHANGES = [
  // every file_change here is meant to be either mapped to a section (safe label)
  // or suppressed entirely. Either way the user-visible label MUST be privacy-safe.
  "src/routes/index.tsx",
  "src/routes/products/index.tsx",
  "src/routes/products/$productId.tsx",
  "src/routes/cart.tsx",
  "src/routes/checkout.tsx",
  "src/routes/__root.tsx",
  "src/components/storefront/Hero.tsx",
  "src/components/storefront/ProductCard.tsx",
  "src/components/storefront/Header.tsx",
  "src/components/storefront/Footer.tsx",
  "src/components/storefront/Banner.tsx",
  "src/styles/app.css",
  "DESIGN.md",
  "src/components/some/Misc.tsx",
  // unmapped — should be suppressed
  "src/server/internal-thing.ts",
  "vite.config.ts",
  "package.json",
  "tsconfig.json",
  "src/lib/util.ts",
  "tests/foo.test.ts",
];

const FRIENDLY_TURN_TEXTS = [
  "Đã thêm ảnh vào phần hero ở trang chủ.",
  "Đã đổi màu nút trên phần hero.",
  "Đã thêm banner khuyến mãi vào trang chủ.",
  "Updated the hero section.",
  "Updated the home page.",
];

const LEAKY_TURN_TEXTS = [
  "Updated src/components/storefront/Hero.tsx with the new image.",
  "Patched `<Hero />` and the `useHook` hook in src/routes/index.tsx",
  "Built with Vite and TanStack Router",
  "```ts\nfunction foo() {}\n```",
];

describe("US2 privacy — every user-visible payload is privacy-safe across many runs", () => {
  it("over 10 mixed runs, every emitted skeleton label, message content, and timeline section/summary passes isPrivacySafe", async () => {
    const failures: string[] = [];
    for (let i = 0; i < 10; i++) {
      const adapter = makeAdapter();
      const emitted: RunStreamEvent[] = [];
      const turnText = i % 2 === 0
        ? FRIENDLY_TURN_TEXTS[i % FRIENDLY_TURN_TEXTS.length]
        : LEAKY_TURN_TEXTS[i % LEAKY_TURN_TEXTS.length];
      const events: BuilderRunEvent[] = [
        { type: "milestone", runId: "r", milestone: "loading_context", at: 0 },
        ...ADVERSARIAL_FILE_CHANGES.map(
          (path, idx) => ({ type: "file_change", runId: "r", path, at: idx } as BuilderRunEvent),
        ),
        { type: "milestone", runId: "r", milestone: "publishing", at: 100 },
        { type: "turn_completed", runId: "r", finalResponse: turnText, at: 101 },
        { type: "done", runId: "r", milestone: "done", at: 102 },
      ];
      await runBuilderBridge({
        ctx: { runId: "r", projectId: "p", locale: "vi" },
        events: asAsync(events),
        emit: (e) => emitted.push(e),
        persist: adapter,
      });

      for (const event of emitted) {
        if (event.type === "skeleton.update") {
          if (!isPrivacySafe(event.label)) failures.push(`skeleton.label="${event.label}"`);
          if (event.detail && !isPrivacySafe(event.detail)) failures.push(`skeleton.detail="${event.detail}"`);
        }
        if (event.type === "message.created") {
          if (!isPrivacySafe(event.content)) failures.push(`message.created.content="${event.content}"`);
        }
        if (event.type === "message.completed") {
          if (!isPrivacySafe(event.content)) failures.push(`message.completed.content="${event.content}"`);
        }
        if (event.type === "run.failed") {
          if (!isPrivacySafe(event.error.message)) failures.push(`run.failed.error.message="${event.error.message}"`);
        }
      }
      for (const m of adapter.messages) {
        if (!isPrivacySafe(m.content)) failures.push(`persisted.${m.kind}="${m.content}"`);
      }
      for (const t of adapter.timeline) {
        const payload = t.payload as Record<string, unknown>;
        const text = (payload.text as string | undefined) ?? (payload.section as string | undefined);
        if (text && !isPrivacySafe(text)) failures.push(`timeline.${t.kind}="${text}"`);
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });

  it("over 5 failure runs, the friendly error never reveals the raw cause", async () => {
    const fails: string[] = [];
    const failureCodes = [
      "validation_failed",
      "boundary_violation",
      "preview_failed",
      "codex_runtime_failed",
      "repair_exhausted",
    ] as const;
    for (const code of failureCodes) {
      const adapter = makeAdapter();
      const emitted: RunStreamEvent[] = [];
      const events: BuilderRunEvent[] = [
        {
          type: "failed",
          runId: "r",
          milestone: "failed",
          failureCode: code,
          message: "(internal) src/server/util.ts threw `TypeError`: cannot read 'a'",
          at: 0,
        },
      ];
      await runBuilderBridge({
        ctx: { runId: "r", projectId: "p", locale: "vi" },
        events: asAsync(events),
        emit: (e) => emitted.push(e),
        persist: adapter,
      });
      const failed = emitted.find((e) => e.type === "run.failed") as
        | { error: { message: string } }
        | undefined;
      if (!failed || !isPrivacySafe(failed.error.message)) {
        fails.push(`code=${code} message="${failed?.error.message}"`);
      }
      const persisted = adapter.messages.find((m) => m.kind === "error");
      if (!persisted || !isPrivacySafe(persisted.content)) {
        fails.push(`code=${code} persisted="${persisted?.content}"`);
      }
    }
    expect(fails, fails.join("\n")).toEqual([]);
  });
});
