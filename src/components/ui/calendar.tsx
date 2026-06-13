import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { cn } from "@/utils/cn";

export type CalendarProps = DayPickerProps;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-0", className)}
      classNames={{
        months: "flex flex-col gap-4",
        month: "flex flex-col gap-3",
        month_caption: "flex h-8 items-center justify-center px-8",
        caption_label: "text-ui-sm font-medium text-ink",
        dropdowns: "flex items-center justify-center gap-1.5",
        dropdown_root: "relative inline-flex items-center",
        dropdown:
          "h-8 cursor-pointer appearance-none rounded-md border border-hairline bg-surface px-2 pr-6 text-ui-sm font-medium text-ink transition-colors hover:border-ink/30 focus-ring",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous: cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink focus-ring",
        ),
        button_next: cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink focus-ring",
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "w-9 text-caption font-normal text-subtle",
        week: "mt-1 flex w-full",
        day: "h-9 w-9 p-0 text-center",
        day_button: cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md text-ui-sm text-ink transition-colors hover:bg-ink/[0.06] focus-ring aria-selected:opacity-100",
        ),
        selected:
          "[&>button]:bg-ink [&>button]:text-paper [&>button]:hover:bg-deep",
        today: "[&>button]:font-semibold [&>button]:text-ink",
        outside: "[&>button]:text-subtle [&>button]:opacity-50",
        disabled: "[&>button]:text-subtle [&>button]:opacity-40",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClass, ...chevronProps }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return (
            <Icon
              aria-hidden="true"
              className={cn("h-4 w-4", chevronClass)}
              {...chevronProps}
            />
          );
        },
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";
