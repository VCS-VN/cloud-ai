import { projectReadFileTool } from "./project-read-file.tool.server";

export const readTool = {
  ...projectReadFileTool,
  name: "read",
};

export const createReadTool = () => readTool;
export { projectReadFileTool };
