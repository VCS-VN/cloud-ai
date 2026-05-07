import { ChatPanel } from "./chat-panel"
import { PreviewPanel } from "./preview-panel"
import { Splitter } from "./splitter"

interface ProjectLayoutProps {
  projectName?: string
}

export function ProjectLayout({ projectName = "Untitled Project" }: ProjectLayoutProps) {
  return (
    <div className="h-screen w-full overflow-hidden bg-[var(--app-page-bg)]">
      <Splitter>
        <ChatPanel projectName={projectName} />
        <PreviewPanel />
      </Splitter>
    </div>
  )
}
