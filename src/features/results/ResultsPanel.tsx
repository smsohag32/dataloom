import { AlertCircle, BarChart3, Columns3, Download, FileText, Loader2, Search, Sparkles, Table2, Copy, Eraser, DatabaseZap } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { gridActions } from "@/store/slices/gridSlice";
import { applyTransform, materializeResult } from "@/store/thunks";
import { useResult } from "@/engine/resultStore";
import { detectSourceTable } from "@/engine/transforms/transforms";
import { formatBytes } from "@/lib/utils";
import type { OutputView } from "@/types";
import { DataGrid, Empty } from "./DataGrid";
import { ChartBuilder } from "./ChartBuilder";
import { ExportPanel, MarkdownResultPreview, useExporter } from "./ExportPanel";
import { CellInspector } from "./CellInspector";

export function ResultsPanel({ tabId }: { tabId: string }) {
  const dispatch = useAppDispatch();
  const view = useAppSelector((s) => s.grid.outputView);
  const meta = useAppSelector((s) => s.query.metaByTab[tabId]);
  const result = useResult(tabId);
  const status = meta?.status ?? "idle";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-2">
        <Tabs value={view} onValueChange={(v) => dispatch(gridActions.outputViewChanged(v as OutputView))}>
          <TabsList>
            <TabsTrigger value="table"><Table2 />Data Grid</TabsTrigger>
            <TabsTrigger value="chart"><BarChart3 />Visual Chart</TabsTrigger>
            <TabsTrigger value="markdown"><FileText />Markdown Preview</TabsTrigger>
            <TabsTrigger value="export"><Download />Export</TabsTrigger>
          </TabsList>
        </Tabs>
        {view === "table" && result && result.columns.length > 0 && <GridToolbar tabId={tabId} />}
      </div>

      <div className="relative min-h-0 flex-1">
        {status === "error" && (
          <div className="m-3 flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <pre className="whitespace-pre-wrap break-words font-mono text-destructive">{meta?.error}</pre>
          </div>
        )}
        {status !== "error" && !result && (
          <Empty>
            {status === "running" ? (
              <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Running query…</span>
            ) : (
              <span>
                Write a query and press <kbd className="rounded border bg-muted px-1 font-mono">Ctrl/⌘ ↵</kbd> to see results.
              </span>
            )}
          </Empty>
        )}
        {status !== "error" && result && (
          <>
            {view === "table" && <DataGrid result={result} tabId={tabId} />}
            {view === "chart" && <ChartBuilder result={result} />}
            {view === "markdown" && <MarkdownResultPreview result={result} />}
            {view === "export" && <ExportPanel result={result} />}
          </>
        )}
        {status === "running" && result && (
          <div className="absolute right-3 top-2 z-30 flex items-center gap-1.5 rounded-md border bg-popover px-2 py-1 text-[11px] shadow">
            <Loader2 className="size-3 animate-spin" /> Running…
          </div>
        )}
      </div>

      <MetricsBar tabId={tabId} />
      <CellInspector />
    </div>
  );
}

function GridToolbar({ tabId }: { tabId: string }) {
  const dispatch = useAppDispatch();
  const filter = useAppSelector((s) => s.grid.globalFilter);
  const visibility = useAppSelector((s) => s.grid.columnVisibility);
  const tables = useAppSelector((s) => s.workspace.tables);
  const result = useResult(tabId);
  const [open, setOpen] = useState(false);
  if (!result) return null;
  const source = detectSourceTable(result.sql, tables.map((t) => t.name));
  const srcSchema = tables.find((t) => t.name === source);
  const hidden = Object.values(visibility).filter((v) => v === false).length;

  return (
    <div className="ml-auto flex items-center gap-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={filter}
          onChange={(e) => dispatch(gridActions.filterChanged(e.target.value))}
          placeholder="Search results…"
          className="h-7 w-44 rounded-md border bg-background pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline">
            <Columns3 /> Columns{hidden > 0 && <Badge variant="primary">{result.columns.length - hidden}/{result.columns.length}</Badge>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="max-h-72 w-56 overflow-auto p-1.5">
          {result.columns.map((c, i) => {
            const id = `c${i}`;
            return (
              <label key={id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-accent">
                <input
                  type="checkbox"
                  className="accent-[hsl(var(--primary))]"
                  checked={visibility[id] !== false}
                  onChange={(e) => dispatch(gridActions.visibilityChanged({ ...visibility, [id]: e.target.checked }))}
                />
                <span className="truncate font-mono">{c.name}</span>
              </label>
            );
          })}
        </PopoverContent>
      </Popover>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline">
            <Sparkles /> Clean
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-1 p-2">
          <p className="px-1 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            One-click transforms {source && <span className="normal-case">· {source}</span>}
          </p>
          {source && srcSchema ? (
            <>
              <MenuItem
                icon={<Copy />}
                label="Drop duplicate rows"
                hint="SELECT DISTINCT *"
                onClick={() => (setOpen(false), void dispatch(applyTransform({ kind: "dedupe", table: source }, tabId)))}
              />
              <MenuItem
                icon={<Eraser />}
                label="Remove rows with NULLs"
                hint={`any of ${srcSchema.columns.length} columns`}
                onClick={() =>
                  (setOpen(false),
                  void dispatch(applyTransform({ kind: "dropNulls", table: source, columns: srcSchema.columns.map((c) => c.name) }, tabId)))
                }
              />
              <p className="px-1 pt-1 text-[11px] text-muted-foreground">
                Trim, case, rename and drop live in each column header (ⓘ). Transforms rewrite the table; the generated SQL is
                recorded in History.
              </p>
            </>
          ) : (
            <p className="px-1 text-[11px] text-muted-foreground">
              This result isn't a single table. Save it as a table to enable transforms.
            </p>
          )}
          <div className="border-t pt-1">
            <MenuItem
              icon={<DatabaseZap />}
              label="Save result as table"
              hint="CREATE TABLE … AS"
              onClick={() => {
                setOpen(false);
                const name = window.prompt("Table name", "cleaned_result");
                if (name?.trim()) void dispatch(materializeResult(tabId, name.trim().replace(/[^\w]+/g, "_")));
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function MenuItem({ icon, label, hint, onClick }: { icon: React.ReactNode; label: string; hint: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent [&_svg]:size-3.5 [&_svg]:text-muted-foreground">
      {icon}
      <span>{label}</span>
      <span className="ml-auto font-mono text-[10px] text-muted-foreground">{hint}</span>
    </button>
  );
}

function MetricsBar({ tabId }: { tabId: string }) {
  const meta = useAppSelector((s) => s.query.metaByTab[tabId]);
  const result = useResult(tabId);
  const ex = useExporter(result);
  const ok = meta?.status === "success";
  return (
    <div className="flex h-8 shrink-0 items-center gap-3 border-t bg-card px-3 font-mono text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span
          className={`size-1.5 rounded-full ${meta?.status === "error" ? "bg-destructive" : ok ? "bg-success" : meta?.status === "running" ? "animate-pulse bg-amber-500" : "bg-muted-foreground/40"}`}
        />
        {ok ? (
          <>
            <span className="text-foreground">{meta!.rowCount!.toLocaleString()}</span> rows returned
            {meta!.truncated && <span title="Only the first rows are held in memory"> (showing {result?.rows.length.toLocaleString()})</span>}
          </>
        ) : meta?.status === "error" ? (
          "Query failed"
        ) : meta?.status === "running" ? (
          "Running…"
        ) : (
          "Ready"
        )}
      </span>
      {ok && (
        <>
          <Badge variant="success" title="Wall-clock execution time of the query inside DuckDB">
            {meta!.durationMs!.toFixed(1)} ms
          </Badge>
          <Badge title="Estimated size of the result's Arrow buffers (browsers expose no exact per-query memory)">
            ≈ {formatBytes(meta!.bytes!)}
          </Badge>
        </>
      )}
      {ok && ex && (
        <Button size="xs" variant="ghost" className="ml-auto" onClick={() => void ex.copy("md")}>
          <Copy /> Copy as Markdown
        </Button>
      )}
    </div>
  );
}

