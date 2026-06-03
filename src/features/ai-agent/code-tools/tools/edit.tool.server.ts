import { createProjectApplyPatchTool } from "./project-apply-patch.tool.server";

export const editTool = {
  ...createProjectApplyPatchTool(),
  name: "edit",
};

export const createEditTool = () => editTool;
export { createProjectApplyPatchTool };
