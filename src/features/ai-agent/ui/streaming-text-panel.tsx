import { useState, useEffect, useRef } from "react";

type StreamingTextPanelProps = {
  text: string;
  isStreaming: boolean;
};

export function StreamingTextPanel({ text, isStreaming }: StreamingTextPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (ref.current && isStreaming) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [text, isStreaming]);

  if (!text && !isStreaming) return null;

  return (
    <div className="bg-lime rounded-lg p-xxl mb-lg">
      <div className="flex items-center justify-between mb-md">
        <span className="font-mono text-caption uppercase tracking-wider text-ink opacity-60">
          Agent Reasoning
        </span>
        {!isStreaming && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="font-mono text-caption uppercase tracking-wider text-ink opacity-40 hover:opacity-60"
          >
            {isCollapsed ? "Expand" : "Collapse"}
          </button>
        )}
      </div>
      {!isCollapsed && (
        <div ref={ref} className="font-sans text-body font-light leading-relaxed text-ink">
          {text.split("\n").map((line, i) => (
            <p key={i} className="mb-xs last:mb-0">
              {line}
            </p>
          ))}
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-ink ml-xxs animate-pulse" />
          )}
        </div>
      )}
    </div>
  );
}
