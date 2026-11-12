import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium leading-none",
  {
    variants: {
      variant: {
        default: "bg-muted text-muted-foreground",
        success: "border-success/30 bg-success/10 text-success",
        primary: "border-primary/30 bg-primary/10 text-primary",
        destructive: "border-destructive/30 bg-destructive/10 text-destructive",
        outline: "bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

