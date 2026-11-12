import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive ref={ref} className={cn("flex size-full flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground", className)} {...props} />
));
Command.displayName = "Command";

export function CommandDialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[16vh] z-50 w-[min(640px,92vw)] -translate-x-1/2 overflow-hidden rounded-xl border shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <Command loop className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground">
            {children}
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center gap-2 border-b px-3">
    <Search className="size-4 shrink-0 text-muted-foreground" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn("h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground", className)}
      {...props}
    />
  </div>
));
CommandInput.displayName = "CommandInput";

export const CommandList = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>) => (
  <CommandPrimitive.List className={cn("max-h-[360px] overflow-y-auto overflow-x-hidden p-1.5", className)} {...props} />
);
export const CommandEmpty = (props: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>) => (
  <CommandPrimitive.Empty className="py-8 text-center text-xs text-muted-foreground" {...props} />
);
export const CommandGroup = CommandPrimitive.Group;
export const CommandItem = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>) => (
  <CommandPrimitive.Item
    className={cn(
      "flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-2 text-xs outline-none data-[selected=true]:bg-accent data-[disabled=true]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground",
      className,
    )}
    {...props}
  />
);
export const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("ml-auto font-mono text-[10px] text-muted-foreground", className)} {...props} />
);

