import { useState } from "react";
import type { TokenContext } from "@/shared/project-types";

type TokenBarProps = {
  tokenContext: TokenContext | null;
};

/**
 * T060-T061: Circular SVG badge showing context window usage.
 * Color: xanh (<50%), vàng (50-85%), đỏ (>85%).
 * Hover popover shows "N/N tokens (X%)".
 */
export function TokenBar({ tokenContext }: TokenBarProps) {
  const [showPopover, setShowPopover] = useState(false);

  if (!tokenContext) return null;

  const { used, total, percent } = tokenContext;

  // Color based on usage threshold
  let color = "var(--app-accent)"; // xanh / green
  if (percent >= 85) {
    color = "var(--app-danger-text, #ef4444)"; // đỏ
  } else if (percent >= 50) {
    color = "var(--app-icon-selected, #f59e0b)"; // vàng
  }

  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - Math.min(percent, 100) / 100);

  const formattedUsed = used.toLocaleString();
  const formattedTotal = total.toLocaleString();

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setShowPopover(true)}
      onMouseLeave={() => setShowPopover(false)}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        className="-rotate-90"
        aria-label={`${percent}% context window used`}
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* Background circle */}
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          stroke="var(--app-border)"
          strokeWidth="3"
        />
        {/* Foreground arc */}
        <circle
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>

      {/* Hover popover */}
      {showPopover && (
        <div
          className="absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--app-border-strong)] bg-[var(--app-panel-bg)] px-sm py-xxs text-[11px] text-[var(--app-panel-text)] shadow-lg"
          role="tooltip"
        >
          {formattedUsed} / {formattedTotal} tokens ({percent}%)
        </div>
      )}
    </div>
  );
}
