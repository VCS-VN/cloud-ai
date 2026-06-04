import { loadPromptDoc, renderPromptDoc } from "../agent/prompt-template-store.server";

export const THINKING_LAYER_SYSTEM_PROMPT = loadPromptDoc("templates/thinking/system.md");

export const THINKING_RESULT_FORMAT_CONTRACT = loadPromptDoc("templates/thinking/result-format.md");

export const THINKING_LAYER_DEVELOPER_PROMPT = renderPromptDoc(
  "templates/thinking/developer.md",
  { resultFormatContract: THINKING_RESULT_FORMAT_CONTRACT },
);
