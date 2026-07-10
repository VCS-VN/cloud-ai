import { Monitor, Moon, Sun } from "lucide-react";
import type { AppTheme } from "@/theme";

export const activatedAtFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const themeOptions: Array<{
  value: AppTheme;
  label: string;
  icon: typeof Moon;
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function getFirstName(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return "there";
  const firstToken = trimmed.split(/\s+/)[0];
  return firstToken.includes("@") ? firstToken.split("@")[0] : firstToken;
}
