import { useState, useCallback, type ReactNode } from "react";
import type { ProjectFileNode } from "@/shared/project-types";
import { ContentPanel } from "./content-panel";
import { ProductPanel } from "./product-panel";
import { ThemePanel } from "./theme-panel";
import { SectionPanel } from "./section-panel";
import { FileTreeGrid } from "./file-tree-grid";
import { PreviewToolbar } from "./preview-toolbar";
import { PreviewUrlBar } from "./preview-url-bar";
import { PreviewBreadcrumb } from "./preview-breadcrumb";

const tabs = [
  { id: "preview", label: "Preview" },
  { id: "content", label: "Content" },
  { id: "product", label: "Product" },
  { id: "theme", label: "Theme" },
  { id: "section", label: "Section" },
] as const;

type TabId = (typeof tabs)[number]["id"];

// Mock file tree data for demonstration
const mockFileTree: ProjectFileNode[] = [
  {
    id: "1",
    projectId: "demo",
    name: "app",
    type: "folder",
    path: "app",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "2",
    projectId: "demo",
    name: "src",
    type: "folder",
    path: "src",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "3",
    projectId: "demo",
    name: "public",
    type: "folder",
    path: "public",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "4",
    projectId: "demo",
    name: "package.json",
    type: "file",
    path: "package.json",
    contentType: "application/json",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "5",
    projectId: "demo",
    name: "tsconfig.json",
    type: "file",
    path: "tsconfig.json",
    contentType: "application/json",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "6",
    projectId: "demo",
    name: "tailwind.config.ts",
    type: "file",
    path: "tailwind.config.ts",
    contentType: "text/typescript",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "7",
    projectId: "demo",
    name: "vite.config.ts",
    type: "file",
    path: "vite.config.ts",
    contentType: "text/typescript",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "8",
    projectId: "demo",
    name: "README.md",
    type: "file",
    path: "README.md",
    contentType: "text/markdown",
    createdAt: "",
    updatedAt: "",
  },
];

function TabContent({ activeTab }: { activeTab: TabId }) {
  const panelMap: Record<TabId, ReactNode> = {
    preview: <PreviewWorkspace />,
    content: <ContentPanel />,
    product: <ProductPanel />,
    theme: <ThemePanel />,
    section: <SectionPanel />,
  };

  return panelMap[activeTab];
}

function PreviewWorkspace() {
  const [selectedNode, setSelectedNode] = useState<ProjectFileNode>();
  const [currentPath, setCurrentPath] = useState("");

  const handleSelectFolder = useCallback((path: string) => {
    setCurrentPath(path);
  }, []);

  const handleSelectFile = useCallback((node: ProjectFileNode) => {
    setSelectedNode(node);
  }, []);

  const handleNavigateParent = useCallback(() => {
    const segments = currentPath.split("/").filter(Boolean);
    segments.pop();
    setCurrentPath(segments.join("/"));
  }, [currentPath]);

  const handleBreadcrumbNavigate = useCallback((path: string) => {
    setCurrentPath(path);
  }, []);

  // Filter nodes to show only items in current path
  const currentNodes = mockFileTree.filter((node) => {
    if (!currentPath) return true;
    const nodeParent = node.path.includes("/")
      ? node.path.split("/").slice(0, -1).join("/")
      : "";
    return (
      nodeParent === currentPath ||
      (node.type === "folder" && node.path.startsWith(currentPath))
    );
  });

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-panel)] transition-colors duration-300">
      {/* Toolbar */}
      <PreviewToolbar
        onCodeView={() => console.log("code view")}
        onUndo={() => console.log("undo")}
        onRedo={() => console.log("redo")}
        onRefresh={() => console.log("refresh")}
        onStop={() => console.log("stop")}
        onPlay={() => console.log("play")}
        onSettings={() => console.log("settings")}
      />

      {/* URL Bar */}
      <PreviewUrlBar onRefresh={() => console.log("reload")} />

      {/* Breadcrumb */}
      <PreviewBreadcrumb
        path={currentPath}
        onNavigate={handleBreadcrumbNavigate}
      />

      {/* File Tree Grid */}
      <FileTreeGrid
        nodes={currentNodes}
        currentPath={currentPath}
        onSelectFolder={handleSelectFolder}
        onSelectFile={handleSelectFile}
        onNavigateParent={currentPath ? handleNavigateParent : undefined}
      />
    </section>
  );
}

export function PreviewPanel() {
  const [activeTab, setActiveTab] = useState<TabId>("preview");

  return (
    <div className="flex h-full flex-col bg-[var(--app-panel)] text-[var(--app-text)]">
      {/* Tab bar */}
      <div className="flex-shrink-0 flex items-center gap-xxs border-b border-[var(--app-border)] px-md py-xs overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 rounded-pill px-md py-xs text-button transition-all duration-150 ${
              activeTab === tab.id
                ? "bg-[var(--app-selected-bg)] text-[var(--app-selected-text)]"
                : "bg-[var(--app-control)] text-[var(--app-text)] hover:bg-[var(--app-surface)]"
            }`}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto" role="tabpanel">
        <TabContent activeTab={activeTab} />
      </div>
    </div>
  );
}
