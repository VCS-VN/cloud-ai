import { dumprify } from "@/lib/dumprify";

type PlanMessageContentProps = {
  content: string;
};

/**
 * Plan milestone content is formatted server-side as:
 *   <summary line>
 *
 *   Will update:
 *   - path1
 *   - path2
 *
 * v1 renders only the summary line; the file list is intentionally hidden
 * (data is persisted so a future version can reveal it without a migration).
 */
export function extractPlanSummary(content: string): string {
  const firstLine = content.split(/\r?\n/, 1)[0]?.trim();
  return firstLine || content.trim();
}

export function PlanMessageContent({ content }: PlanMessageContentProps) {
  const summary = extractPlanSummary(content);
  return (
    <div
      className="min-w-0 max-w-full break-words text-[12px] leading-4 text-current [overflow-wrap:anywhere] [&_code]:rounded-sm [&_code]:bg-black/10 [&_code]:px-xxs [&_code]:py-[1px] [&_code]:text-[11px] [&_p]:my-xxs"
      dangerouslySetInnerHTML={{ __html: dumprify(summary) }}
    />
  );
}
