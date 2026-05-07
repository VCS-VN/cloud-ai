import type {
  AgentMessageChunk,
  Message,
  Project,
} from "@/shared/project-types";

export const projectStreamFixture: Project = {
  id: "project-stream-1",
  userId: "user-1",
  name: "Project stream",
  description: "Streaming test project",
  initialPrompt: "Generate a page",
  status: "ready",
  processingStatus: "processing",
  activeAgentMessageId: "agent-message-1",
  processingStartedAt: "2026-05-06T00:00:01.000Z",
  createdAt: "2026-05-06T00:00:00.000Z",
  updatedAt: "2026-05-06T00:00:01.000Z",
  pwa: {
    enabled: false,
    name: "Project stream",
    shortName: "Project",
    themeColor: "#000000",
    backgroundColor: "#ffffff",
    display: "standalone",
    startUrl: "/",
    scope: "/",
    icons: [],
    offlineFallbackEnabled: false,
  },
};

export const agentMessageFixture: Message = {
  id: "agent-message-1",
  userId: "user-1",
  projectId: "project-stream-1",
  role: "agent",
  content: "",
  status: "pending",
  processingStatus: "pending",
  parentMessageId: "user-message-1",
  provider: "openai",
  createdAt: "2026-05-06T00:00:01.000Z",
  updatedAt: "2026-05-06T00:00:01.000Z",
};

export const chunkFixture: AgentMessageChunk = {
  id: "chunk-1",
  projectId: "project-stream-1",
  messageId: "agent-message-1",
  userId: "user-1",
  sequence: 1,
  content: "First chunk",
  providerEventType: "response.output_text.delta",
  createdAt: "2026-05-06T00:00:02.000Z",
};
