import { FileText, Plus, TerminalSquare, X } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { workspaceActions } from "@/store/slices/workspaceSlice";
import { closeTab, openSqlTab } from "@/store/thunks";
import { cn } from "@/lib/utils";

export function TabBar() {
  const tabs = useAppSelector((s) => s.workspace.tabs);
  const active = useAppSelector((s) => s.workspace.activeTabId);
  const dispatch = useAppDispatch();
  return (
    <div className="flex h-9 shrink-0 items-end gap-px overflow-x-auto border-b bg-muted/40 px-1 pt-1" role="tablist">
      {tabs.map((t) => {
        const Icon = t.kind === "sql" ? TerminalSquare : FileText;
        const isActive = t.id === active;
        return (
          <div
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => dispatch(workspaceActions.tabActivated(t.id))}
            onAuxClick={(e) => e.button === 1 && void dispatch(closeTab(t.id))}
            className={cn(
              "group/tab relative flex h-8 max-w-[200px] shrink-0 cursor-pointer items-center gap-1.5 rounded-t-md border border-b-0 border-transparent px-2.5 text-xs text-muted-foreground hover:text-foreground",
              isActive && "border-border bg-background text-foreground",
            )}
          >
            {isActive && <span className="absolute inset-x-2 top-0 h-px rounded-full bg-primary" />}
            <Icon className={cn("size-3.5 shrink-0", t.kind === "markdown" && "text-primary")} />
            <span className="truncate font-mono">{t.title}</span>
            <button
              aria-label={`Close ${t.title}`}
              onClick={(e) => {
                e.stopPropagation();
                void dispatch(closeTab(t.id));
              }}
              className="rounded p-0.5 opacity-0 hover:bg-accent group-hover/tab:opacity-100 aria-selected:opacity-100"
            >
              <X className="size-3" />
            </button>
          </div>
        );
      })}
      <button
        aria-label="New query tab"
        onClick={() => void dispatch(openSqlTab())}
        className="mb-0.5 ml-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

