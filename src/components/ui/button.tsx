import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/utils/cn";

const buttonVariants = cva("", {
  variants: {
    variant: {
      default: "btn btn-primary",
      outline: "btn btn-outline",
      ghost: "btn btn-ghost",
      icon: "btn-icon",
      nav: "flex w-full min-w-0 items-center gap-3 rounded-md border border-transparent px-3 text-left text-ui-sm transition-colors duration-base focus-ring text-muted hover:bg-chalk hover:text-ink",
      "nav-active":
        "flex w-full min-w-0 items-center gap-3 rounded-md border border-transparent px-3 text-left text-ui-sm transition-colors duration-base focus-ring bg-chalk text-ink font-medium",
      unstyled: "",
    },
    size: {
      default: "",
      sm: "btn-sm",
      icon: "",
      navItem: "h-9",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

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
