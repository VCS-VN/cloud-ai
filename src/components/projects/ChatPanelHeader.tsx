import { FileText, History, MessageSquare, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

type ChatPanelTabsProps = {
  activeTab: "chat" | "files" | "versions";
  fileCount?: number;
  versionCount?: number;
  onTabChange: (tab: "chat" | "files" | "versions") => void;
};

export function ChatPanelTabs({
  activeTab,
  fileCount,
  versionCount,
  onTabChange,
}: ChatPanelTabsProps) {
  return (
    <div className="flex-shrink-0 border-b border-hairline px-4 pb-2 pt-3 flex items-center gap-1">
      <Button
        variant="unstyled"
        type="button"
        role="tab"
        aria-selected={activeTab === "chat"}
        onClick={() => onTabChange("chat")}
        className={`project-tab ${activeTab === "chat" ? "project-tab-active" : ""}`}
      >
        <MessageSquare aria-hidden="true" size={12} />
        Chat
      </Button>
      {/* <Button
        variant="unstyled"
        type="button"
        role="tab"
        aria-selected={activeTab === "files"}
        onClick={() => onTabChange("files")}
        className={`project-tab ${activeTab === "files" ? "project-tab-active" : ""}`}
      >
        <FileText aria-hidden="true" size={12} />
        Files
        {typeof fileCount === "number" ? (
          <span className="project-tab-count">{fileCount}</span>
        ) : null}
      </Button>
      <Button
        variant="unstyled"
        type="button"
        role="tab"
        aria-selected={activeTab === "versions"}
        onClick={() => onTabChange("versions")}
        className={`project-tab ${activeTab === "versions" ? "project-tab-active" : ""}`}
      >
        <History aria-hidden="true" size={12} />
        Versions
        {typeof versionCount === "number" ? (
          <span className="project-tab-count">{versionCount}</span>
        ) : null}
      </Button> */}
    </div>
  );
}

type ChatPanelMetaProps = {
  domain?: string | null;
  messageCount: number;
  onOpenMore?: () => void;
};

export function ChatPanelMeta({
  domain,
  messageCount,
  onOpenMore,
}: ChatPanelMetaProps) {
  return (
    <div className="flex-shrink-0 border-b border-hairline px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2 text-[11px] text-subtle min-w-0">
        {domain ? (
          <span className="inline-flex items-center gap-1 truncate font-mono">
            <svg
              className="w-3 h-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
            </svg>
            {domain}
          </span>
        ) : null}
        {domain ? <span aria-hidden="true">·</span> : null}
        <span className="font-mono">
          {messageCount} {messageCount === 1 ? "message" : "messages"}
        </span>
      </div>
      {onOpenMore ? (
        <Button
          variant="unstyled"
          type="button"
          onClick={onOpenMore}
          className="text-subtle hover:text-ink p-1 rounded-md transition-colors duration-base focus-ring"
          aria-label="Options"
          title="Options"
        >
          <MoreHorizontal aria-hidden="true" size={14} />
        </Button>
      ) : null}
    </div>
  );
}
