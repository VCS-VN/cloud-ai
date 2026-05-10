ALTER TABLE project_states
ADD COLUMN IF NOT EXISTS dev_runtime JSON
DEFAULT '{"status":"stopped","pid":null,"port":null,"installStartedAt":null,"installCompletedAt":null,"devStartedAt":null,"previewUrl":null,"installLog":null,"devLog":null,"lastError":null,"lastErrorTier":null,"retryCount":0,"maxRetries":3,"fixAttempts":[]}'::json;
