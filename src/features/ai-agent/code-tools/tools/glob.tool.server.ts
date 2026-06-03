import { projectGetFileTreeTool } from "./project-get-file-tree.tool.server";

export const globTool = {
  ...projectGetFileTreeTool,
  name: "glob",
};

export const createGlobTool = () => globTool;
export { projectGetFileTreeTool };
