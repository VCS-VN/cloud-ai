import { projectSearchCodeTool } from "./project-search-code.tool.server";

export const grepTool = {
  ...projectSearchCodeTool,
  name: "grep",
};

export const createGrepTool = () => grepTool;
export { projectSearchCodeTool };
