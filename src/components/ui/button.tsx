import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const buttonVariants = cva(
  "motion-press inline-flex items-center justify-center whitespace-nowrap rounded-pill text-body-sm font-[580] outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--app-text)] text-[var(--app-bg)] hover:opacity-90",
        outline:
          "border border-[var(--app-border)] bg-[var(--app-bg)] text-[var(--app-text)] hover:border-[var(--app-border-strong)]",
        ghost:
          "text-[var(--app-text)] hover:bg-[var(--app-control)]",
      },
      size: {
        default: "h-11 px-md py-xs",
        sm: "h-9 px-sm",
        icon: "h-9 w-9 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
