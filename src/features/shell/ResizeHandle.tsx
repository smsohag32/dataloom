import { PanelResizeHandle } from "react-resizable-panels";
import { cn } from "@/lib/utils";

export function ResizeHandle({ direction = "horizontal", className }: { direction?: "horizontal" | "vertical"; className?: string }) {
  return (
    <PanelResizeHandle
      className={cn(
        "group relative flex shrink-0 items-center justify-center bg-border transition-colors hover:bg-primary/50 data-[resize-handle-active]:bg-primary",
        direction === "horizontal" ? "w-px" : "h-px",
        className,
      )}
    >
      <div className={cn("absolute z-10", direction === "horizontal" ? "inset-y-0 -inset-x-1" : "inset-x-0 -inset-y-1")} />
    </PanelResizeHandle>
  );
}

