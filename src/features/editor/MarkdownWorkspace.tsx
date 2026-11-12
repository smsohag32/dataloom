import { useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Panel, PanelGroup } from "react-resizable-panels";
import { Columns2, Eye, FileCode, RefreshCw, Table2, WandSparkles } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { workspaceActions } from "@/store/slices/workspaceSlice";
import { openTableQuery, resyncMarkdown } from "@/store/thunks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatMarkdown, parseMarkdownTables } from "@/engine/parsers/parseMarkdownTables";
import { EDITOR_OPTIONS, ensureMonaco } from "./SqlEditor";
import { cn } from "@/lib/utils";
import { ResizeHandle } from "@/features/shell/ResizeHandle";

type Mode = "split" | "editor" | "preview";

export function MarkdownWorkspace({ tabId }: { tabId: string }) {
  const dispatch = useAppDispatch();
  const text = useAppSelector((s) => s.workspace.markdownDocs[tabId] ?? "");
  const tab = useAppSelector((s) => s.workspace.tabs.find((t) => t.id === tabId));
  const tables = useAppSelector((s) => s.workspace.tables.filter((t) => t.fileId && t.fileId === tab?.fileId));
  const resolved = useAppSelector((s) => s.ui.resolvedTheme);
  const [mode, setMode] = useState<Mode>("split");
  const found = useMemo(() => parseMarkdownTables(text).length, [text]);
  const stale = found !== tables.length;

  const set = (t: string) => dispatch(workspaceActions.markdownChanged({ id: tabId, text: t }));
  const modes: { id: Mode; icon: typeof Columns2; label: string }[] = [
    { id: "editor", icon: FileCode, label: "Editor" },
    { id: "split", icon: Columns2, label: "Split" },
    { id: "preview", icon: Eye, label: "Reader" },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center gap-1.5 border-b px-2">
        <div className="flex gap-0.5 rounded-md border bg-muted/50 p-0.5">
          {modes.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-[5px] px-2 text-[11px] text-muted-foreground hover:text-foreground",
                mode === id && "bg-background text-foreground shadow-sm ring-1 ring-border",
              )}
            >
              <Icon className="size-3" />
              {label}
            </button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={() => set(formatMarkdown(text))}>
          <WandSparkles /> Format tables
        </Button>
        <Button size="sm" variant={stale ? "default" : "ghost"} onClick={() => void dispatch(resyncMarkdown(tabId))}>
          <RefreshCw /> Re-extract tables
        </Button>
        <div className="ml-auto flex items-center gap-1.5 overflow-x-auto">
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {tables.length} SQL table{tables.length === 1 ? "" : "s"}:
          </span>
          {tables.map((t) => (
            <button key={t.name} onClick={() => void dispatch(openTableQuery(t.name))} title={`Query ${t.name}`}>
              <Badge variant="primary" className="gap-1 hover:bg-primary/20">
                <Table2 className="size-3" />
                {t.name}
                <span className="text-muted-foreground">{t.rowCount}r</span>
              </Badge>
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <PanelGroup direction="horizontal" autoSaveId="dataloom-md-split">
          {mode !== "preview" && (
            <Panel defaultSize={50} minSize={20} order={1}>
              <Editor
                path={`inmemory://dataloom/${tabId}.md`}
                language="markdown"
                theme={resolved === "dark" ? "dataloom-dark" : "dataloom-light"}
                value={text}
                onChange={(v) => set(v ?? "")}
                beforeMount={ensureMonaco}
                options={{ ...EDITOR_OPTIONS, wordWrap: "on", lineNumbers: "off" }}
              />
            </Panel>
          )}
          {mode === "split" && <ResizeHandle />}
          {mode !== "editor" && (
            <Panel defaultSize={50} minSize={20} order={2}>
              <div className="size-full overflow-auto p-6">
                <div className="md-prose mx-auto max-w-3xl">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                </div>
              </div>
            </Panel>
          )}
        </PanelGroup>
      </div>
    </div>
  );
}
