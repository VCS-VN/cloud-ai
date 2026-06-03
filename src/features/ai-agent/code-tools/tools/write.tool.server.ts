import { createProjectCreateFileTool } from "./project-create-file.tool.server";

export const writeTool = {
  ...createProjectCreateFileTool(),
  name: "write",
};

export const createWriteTool = () => writeTool;
export { createProjectCreateFileTool };
