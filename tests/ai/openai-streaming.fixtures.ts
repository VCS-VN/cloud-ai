import type {
  Message,
  MessageDeltaEvent,
  MessageStartedEvent,
  MessageTerminalEvent,
  Project,
} from "@/shared/project-types";

export const openAIEnvFixture = {
  OPENAI_API_KEY: "sk-test",
  OPENAI_MODEL: "gpt-test",
  OPENAI_TIMEOUT_MS: "1200",
};

export const projectFixture: Project = {
  id: "project-1",
  userId: "user-1",
  name: "Streaming project",
  description: "Streaming project",
  initialPrompt: "Build a project",
  status: "ready",
  processingStatus: "idle",
  createdAt: "2026-05-06T00:00:00.000Z",
  updatedAt: "2026-05-06T00:00:00.000Z",
  pwa: {
    enabled: false,
    name: "Streaming project",
    shortName: "Streaming",
    themeColor: "#000000",
    backgroundColor: "#ffffff",
    display: "standalone",
    startUrl: "/",
    scope: "/",
    icons: [],
    offlineFallbackEnabled: false,
  },
};

export const userMessageFixture: Message = {
  id: "user-message-1",
  userId: "user-1",
  projectId: "project-1",
  role: "user",
  content: "Build a project",
  status: "completed",
  processingStatus: "completed",
  createdAt: "2026-05-06T00:00:00.000Z",
  updatedAt: "2026-05-06T00:00:00.000Z",
};

export const startedEventFixture: MessageStartedEvent = {
  type: "message.started",
  projectId: "project-1",
  messageId: "agent-message-1",
  processingStatus: "streaming",
};

export const deltaEventFixture: MessageDeltaEvent = {
  type: "message.delta",
  messageId: "agent-message-1",
  sequence: 1,
  delta: "Hello",
};

export const completedEventFixture: MessageTerminalEvent = {
  type: "message.completed",
  messageId: "agent-message-1",
  content: "Hello world",
  processingStatus: "completed",
  projectProcessingStatus: "idle",
};
