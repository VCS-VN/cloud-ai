export const MANAGED_DESIGN_NOTICE =
  "<!-- GENERATED DESIGN SYSTEM: managed by Cloud AI agent. Do not edit manually. -->";

export const MANAGED_DESIGN_CHANGE_NOTICE =
  "<!-- To change design, ask in chat. -->";

export const REQUIRED_DESIGN_SECTIONS = [
  { index: 1, heading: "Visual Theme & Atmosphere" },
  { index: 2, heading: "Color Palette & Roles" },
  { index: 3, heading: "Typography Rules" },
  { index: 4, heading: "Spacing System" },
  { index: 5, heading: "Radius, Shadow & Motion" },
  { index: 6, heading: "Component Styling" },
  { index: 7, heading: "Layout Principles" },
  { index: 8, heading: "Responsive Behavior" },
] as const;

export function hasManagedDesignNotice(markdown: string): boolean {
  return (
    markdown.includes(MANAGED_DESIGN_NOTICE) &&
    markdown.includes(MANAGED_DESIGN_CHANGE_NOTICE)
  );
}

export function prependManagedDesignNotice(markdown: string): string {
  const trimmed = markdown.trimStart();
  if (hasManagedDesignNotice(trimmed)) return markdown;
  return `${MANAGED_DESIGN_NOTICE}\n${MANAGED_DESIGN_CHANGE_NOTICE}\n\n${markdown.trimStart()}`;
}
