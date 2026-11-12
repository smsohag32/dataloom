import { useRef } from "react";
import { PanelLeft, Search, ShieldCheck, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { ThemeSwitcher } from "@/features/theme/Theme";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { uiActions } from "@/store/slices/uiSlice";
import { loadFiles } from "@/store/thunks";
import { modKey } from "@/lib/utils";

export const ACCEPT = ".csv,.tsv,.json,.jsonl,.ndjson,.sqlite,.sqlite3,.db,.md,.markdown";

export function Header() {
  const dispatch = useAppDispatch();
  const collapsed = useAppSelector((s) => s.ui.sidebarCollapsed);
  const input = useRef<HTMLInputElement>(null);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card px-3">
      <Tooltip label={collapsed ? "Show sidebar" : "Hide sidebar"}>
        <Button variant="ghost" size="icon" aria-label="Toggle sidebar" onClick={() => dispatch(uiActions.sidebarToggled())}>
          <PanelLeft className="size-4" />
        </Button>
      </Tooltip>

      <div className="flex items-center gap-2">
        <img
          src="/logo.svg"
          alt="DataLoom"
          className="size-7 object-contain drop-shadow-[0_2px_8px_rgba(99,102,241,0.35)]"
        />
        <span className="text-sm font-semibold tracking-tight">DataLoom</span>
      </div>

      <Badge variant="success" className="hidden gap-1 px-2 py-1 md:inline-flex">
        <ShieldCheck className="size-3" />
        100% Local • Offline Ready
      </Badge>

      <button
        onClick={() => dispatch(uiActions.paletteSet(true))}
        className="mx-auto flex h-8 w-full max-w-md items-center gap-2 rounded-md border bg-background px-2.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
      >
        <Search className="size-3.5" />
        <span>Search commands, tables…</span>
        <kbd className="ml-auto rounded border bg-muted px-1.5 font-mono text-[10px]">{modKey} K</kbd>
      </button>

      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void dispatch(loadFiles(files));
        }}
      />
      <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
        <Upload /> Import
      </Button>
      <ThemeSwitcher />
    </header>
  );
}

