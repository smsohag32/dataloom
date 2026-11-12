import { useMemo, useState } from "react";
import {
  ChevronDown, ChevronRight, Clock, Database, FileJson, FileSpreadsheet, FileText, History, Bookmark, Search, Trash2, Table2, X,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { queryActions } from "@/store/slices/querySlice";
import { workspaceActions } from "@/store/slices/workspaceSlice";
import { openSqlTab, openTableQuery, removeTable, runTab } from "@/store/thunks";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SourceType, TableSchema } from "@/types";
import { TypePill } from "@/features/results/typeMeta";

const FILE_ICON: Record<SourceType, typeof Database> = {
  csv: FileSpreadsheet,
  tsv: FileSpreadsheet,
  json: FileJson,
  jsonl: FileJson,
  sqlite: Database,
  markdown: FileText,
  derived: Table2,
};

function timeAgo(t: number): string {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Section({ title, icon: Icon, count, action, children, grow }: { title: string; icon: typeof Database; count?: number; action?: React.ReactNode; children: React.ReactNode; grow?: boolean }) {
  return (
    <section className={cn("flex min-h-0 flex-col", grow && "flex-1")}>
      <div className="flex h-8 shrink-0 items-center gap-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3" />
        {title}
        {count !== undefined && <Badge className="ml-0.5">{count}</Badge>}
        <div className="ml-auto">{action}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-1.5 pb-2">{children}</div>
    </section>
  );
}

export function Sidebar() {
  const tables = useAppSelector((s) => s.workspace.tables);
  const files = useAppSelector((s) => s.workspace.files);
  const activeTable = useAppSelector((s) => s.workspace.activeTable);
  const history = useAppSelector((s) => s.query.history);
  const snippets = useAppSelector((s) => s.query.snippets);
  const dispatch = useAppDispatch();
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const f = filter.toLowerCase();
    const match = (t: TableSchema) => !f || t.name.toLowerCase().includes(f) || t.columns.some((c) => c.name.toLowerCase().includes(f));
    const out: { key: string; label: string; kind: SourceType; fileId?: string; tables: TableSchema[] }[] = [];
    for (const file of files) {
      const ts = tables.filter((t) => t.fileId === file.id && match(t));
      if (ts.length) out.push({ key: file.id, label: file.name, kind: file.kind, fileId: file.id, tables: ts });
    }
    const loose = tables.filter((t) => !t.fileId && match(t));
    if (loose.length) out.push({ key: "derived", label: "Created tables", kind: "derived", tables: loose });
    return out;
  }, [tables, files, filter]);

  const reopen = (sql: string) => void dispatch(openSqlTab(sql)).then((id) => dispatch(runTab(id)));

  return (
    <aside className="flex h-full min-h-0 flex-col bg-card">
      <Section title="Schema" icon={Database} count={tables.length} grow>
        <div className="relative mb-1.5 px-1.5">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search tables, columns…"
            className="h-7 w-full rounded-md border bg-background pl-7 pr-2 text-xs outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
          />
        </div>
        {groups.length === 0 && (
          <p className="px-3 py-6 text-center text-[11px] leading-relaxed text-muted-foreground">
            {tables.length === 0 ? "No data yet. Drop files anywhere or load a sample." : "No matches."}
          </p>
        )}
        {groups.map((g) => {
          const Icon = FILE_ICON[g.kind];
          const isOpen = open[g.key] !== false;
          return (
            <div key={g.key} className="mb-0.5">
              <button
                onClick={() => setOpen((o) => ({ ...o, [g.key]: !isOpen }))}
                className="group/f flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs font-medium hover:bg-accent"
              >
                {isOpen ? <ChevronDown className="size-3 text-muted-foreground" /> : <ChevronRight className="size-3 text-muted-foreground" />}
                <Icon className="size-3.5 text-primary" />
                <span className="truncate">{g.label}</span>
                {g.fileId && (
                  <span
                    role="button"
                    title="Remove file"
                    onClick={(e) => {
                      e.stopPropagation();
                      g.tables.forEach((t) => void dispatch(removeTable(t.name)));
                      dispatch(workspaceActions.fileRemoved(g.fileId!));
                    }}
                    className="ml-auto rounded p-0.5 text-muted-foreground opacity-0 hover:text-destructive group-hover/f:opacity-100"
                  >
                    <X className="size-3" />
                  </span>
                )}
              </button>
              {isOpen &&
                g.tables.map((t) => (
                  <TableNode key={t.name} t={t} active={t.name === activeTable} filter={filter} />
                ))}
            </div>
          );
        })}
      </Section>

      <div className="h-px shrink-0 bg-border" />
      <div className="flex max-h-[42%] min-h-[120px] flex-col">
        <Section
          title="History"
          icon={History}
          count={history.length}
          action={
            history.length > 0 && (
              <button title="Clear history" className="text-muted-foreground hover:text-destructive" onClick={() => dispatch(queryActions.historyCleared())}>
                <Trash2 className="size-3" />
              </button>
            )
          }
          grow
        >
          {history.length === 0 && <p className="px-3 py-2 text-[11px] text-muted-foreground">Queries you run appear here.</p>}
          {history.slice(0, 40).map((h) => (
            <button key={h.id} onClick={() => reopen(h.sql)} className="mb-0.5 block w-full rounded-md px-2 py-1.5 text-left hover:bg-accent">
              <div className="flex items-center gap-1.5">
                <Badge variant={h.ok ? "primary" : "destructive"}>{h.sql.trim().split(/\s+/)[0]?.toUpperCase().slice(0, 7)}</Badge>
                <span className="truncate font-mono text-[11px]">{h.sql.replace(/\s+/g, " ")}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                <Clock className="size-2.5" />
                {timeAgo(h.at)}
                {h.ok && (
                  <>
                    <span>{h.rows.toLocaleString()} rows</span>
                    <span>{h.durationMs.toFixed(0)}ms</span>
                  </>
                )}
              </div>
            </button>
          ))}
        </Section>
      </div>

      <div className="h-px shrink-0 bg-border" />
      <div className="flex max-h-[24%] min-h-[72px] flex-col">
        <Section title="Saved Queries" icon={Bookmark} count={snippets.length} grow>
          {snippets.length === 0 && <p className="px-3 py-2 text-[11px] text-muted-foreground">No saved queries yet.</p>}
          {snippets.map((s) => (
            <div key={s.id} className="group/s flex items-center rounded-md hover:bg-accent">
              <button onClick={() => reopen(s.sql)} className="min-w-0 flex-1 truncate px-2 py-1.5 text-left font-mono text-[11px]">
                {s.name}
              </button>
              <button
                title="Delete snippet"
                onClick={() => dispatch(queryActions.snippetRemoved(s.id))}
                className="mr-1 rounded p-0.5 text-muted-foreground opacity-0 hover:text-destructive group-hover/s:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </Section>
      </div>
    </aside>
  );
}

function TableNode({ t, active, filter }: { t: TableSchema; active: boolean; filter: string }) {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const expanded = open || (!!filter && t.columns.some((c) => c.name.toLowerCase().includes(filter.toLowerCase())));
  return (
    <div className="ml-3 border-l pl-1">
      <div className={cn("group/t flex items-center rounded-md hover:bg-accent", active && "bg-accent")}>
        <button onClick={() => setOpen(!open)} className="p-1 text-muted-foreground" aria-label="Toggle columns">
          {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        </button>
        <button
          onClick={() => void dispatch(openTableQuery(t.name))}
          onContextMenu={(e) => {
            e.preventDefault();
            dispatch(workspaceActions.activeTableSet(t.name));
          }}
          title="Open in a new query tab"
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left font-mono text-xs"
        >
          <Table2 className="size-3 shrink-0 text-muted-foreground" />
          <span className="truncate">{t.name}</span>
          <span className="ml-auto pr-1 text-[10px] text-muted-foreground">{t.rowCount.toLocaleString()}</span>
        </button>
      </div>
      {expanded &&
        t.columns.map((c) => (
          <div key={c.name} className="flex items-center gap-1.5 py-0.5 pl-6 pr-2 font-mono text-[11px] text-muted-foreground">
            <span className="min-w-0 flex-1 truncate" title={c.name}>
              {c.name}
            </span>
            <TypePill type={c.type} raw={c.rawType} />
          </div>
        ))}
    </div>
  );
}
