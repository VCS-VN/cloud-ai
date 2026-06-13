export type DevInstallStartedEvent = {
  type: "dev_install_started";
  runId: string;
  projectId: string;
};

export type DevInstallCompletedEvent = {
  type: "dev_install_completed";
  runId: string;
  projectId: string;
  durationMs: number;
};

export type DevInstallFailedEvent = {
  type: "dev_install_failed";
  runId: string;
  projectId: string;
  error: string;
  tier: "system";
};

export type DevStartingEvent = {
  type: "dev_starting";
  runId: string;
  projectId: string;
};

export type DevReadyEvent = {
  type: "dev_ready";
  runId: string;
  projectId: string;
  previewUrl: string;
  port: number;
};

export type DevErrorEvent = {
  type: "dev_error";
  runId: string;
  projectId: string;
  error: string;
  tier: "code" | "config" | "system";
};

export type DevFixAttemptEvent = {
  type: "dev_fix_attempt";
  runId: string;
  projectId: string;
  attempt: number;
  error: string;
};

export type DevFixAppliedEvent = {
  type: "dev_fix_applied";
  runId: string;
  projectId: string;
  attempt: number;
  changedFiles: string[];
};

export type DevFixFailedEvent = {
  type: "dev_fix_failed";
  runId: string;
  projectId: string;
  reason: string;
};

export type DevStoppedEvent = {
  type: "dev_stopped";
  projectId: string;
};

export type PreviewReloadRequestedEvent = {
  type: "preview_reload_requested";
  projectId: string;
  reason: "store_slug_synced";
  delayMs: number;
  at: string;
};

export type DevRuntimeEvent =
  | DevInstallStartedEvent
  | DevInstallCompletedEvent
  | DevInstallFailedEvent
  | DevStartingEvent
  | DevReadyEvent
  | DevErrorEvent
  | DevFixAttemptEvent
  | DevFixAppliedEvent
  | DevFixFailedEvent
  | DevStoppedEvent
  | PreviewReloadRequestedEvent;
