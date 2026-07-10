import type { AuthUserSummary } from "@/auth/types";

export type FormState = {
  displayName: string;
  bio: string;
  photoUrl: string;
  coverImage: string;
  dateOfBirth: string;
};

export function toForm(user: AuthUserSummary): FormState {
  return {
    displayName: user.displayName ?? "",
    bio: user.bio ?? "",
    photoUrl: user.photoUrl ?? "",
    coverImage: user.coverImage ?? "",
    dateOfBirth: user.dateOfBirth ?? "",
  };
}

export function getInitials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

export function parseDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function toDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});
