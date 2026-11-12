import { useMemo, useState } from "react";
import { Copy, Download, FileCode2, FileJson, FileSpreadsheet, FileText, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/store/hooks";
import type { QueryResult } from "@/types";
import { copyText, download, sanitizeIdentifier } from "@/lib/utils";
import { exportToMarkdown } from "@/engine/export/exportToMarkdown";
import { toCsv, toJson, toSqlInsert } from "@/engine/export/formats";
import { detectSourceTable } from "@/engine/transforms/transforms";
import { toast } from "@/lib/toast";
import { Empty } from "./DataGrid";

export type ExportFormat = "md" | "csv" | "json" | "sql";

export function useExporter(result: QueryResult | undefined) {
  const tables = useAppSelector((s) => s.workspace.tables);
  return useMemo(() => {
    if (!result) return null;
    const headers = result.columns.map((c) => c.name);
    const tableName = sanitizeIdentifier(
      detectSourceTable(result.sql, tables.map((t) => t.name)) ?? "result",
      "result",
    );
    const build = (f: ExportFormat): { text: string; filename: string; mime: string } => {
      switch (f) {
        case "md":
          return { text: exportToMarkdown(headers, result.rows) + "\n", filename: `${tableName}.md`, mime: "text/markdown" };
        case "csv":
          return { text: toCsv(headers, result.rows), filename: `${tableName}.csv`, mime: "text/csv" };
        case "json":
          return { text: toJson(headers, result.rows), filename: `${tableName}.json`, mime: "application/json" };
        case "sql":
          return { text: toSqlInsert(tableName, result.columns, result.rows), filename: `${tableName}_inserts.sql`, mime: "application/sql" };
      }
    };
    return {
      build,
      download: (f: ExportFormat) => {
        const o = build(f);
        download(o.filename, o.text, o.mime);
      },
      copy: async (f: ExportFormat) => {
        await copyText(build(f).text);
        toast(f === "md" ? "Markdown table copied" : "Copied to clipboard");
      },
    };
  }, [result, tables]);
}

const FORMATS: { id: ExportFormat; title: string; desc: string; icon: typeof FileText }[] = [
  { id: "md", title: "Markdown table", desc: "GitHub-flavoured, ready for READMEs & issues", icon: FileText },
  { id: "csv", title: "Clean CSV", desc: "RFC 4180 quoting, UTF-8", icon: FileSpreadsheet },
  { id: "json", title: "Formatted JSON", desc: "Array of objects, pretty-printed", icon: FileJson },
  { id: "sql", title: "SQL INSERT", desc: "CREATE TABLE + batched INSERT statements", icon: FileCode2 },
];

export function ExportPanel({ result }: { result: QueryResult }) {
  const ex = useExporter(result);
  const [copied, setCopied] = useState<ExportFormat | null>(null);
  if (!ex) return null;
  return (
    <div className="grid h-full content-start gap-3 overflow-auto p-4 sm:grid-cols-2 xl:grid-cols-4">
      {FORMATS.map(({ id, title, desc, icon: Icon }) => (
        <div key={id} className="flex flex-col gap-3 rounded-lg border bg-card p-3">
          <div className="flex items-start gap-2.5">
            <div className="rounded-md bg-primary/10 p-1.5 text-primary">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{title}</p>
              <p className="text-[11px] text-muted-foreground">{desc}</p>
            </div>
          </div>
          <div className="mt-auto flex gap-1.5">
            <Button size="sm" onClick={() => ex.download(id)}>
              <Download /> Download
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await ex.copy(id);
                setCopied(id);
                setTimeout(() => setCopied(null), 1500);
              }}
            >
              {copied === id ? <Check className="text-success" /> : <Copy />} Copy
            </Button>
          </div>
        </div>
      ))}
      {result.truncated && (
        <p className="col-span-full text-[11px] text-muted-foreground">
          Result was capped at {result.rows.length.toLocaleString()} of {result.rowCount.toLocaleString()} rows in memory — add a
          LIMIT or filter for a complete export.
        </p>
      )}
    </div>
  );
}

export function MarkdownResultPreview({ result }: { result: QueryResult }) {
  const ex = useExporter(result);
  const [raw, setRaw] = useState(false);
  const PREVIEW_ROWS = 200;
  const md = useMemo(
    () =>
      exportToMarkdown(
        result.columns.map((c) => c.name),
        result.rows.slice(0, PREVIEW_ROWS),
      ),
    [result],
  );
  if (!ex || result.columns.length === 0) return <Empty>Nothing to preview.</Empty>;
  return (
    <div className="flex size-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
        <div className="flex gap-0.5">
          {[false, true].map((r) => (
            <button
              key={String(r)}
              onClick={() => setRaw(r)}
              className={`h-7 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground ${raw === r ? "bg-accent text-foreground" : ""}`}
            >
              {r ? "Source" : "Rendered"}
            </button>
          ))}
        </div>
        {result.rows.length > PREVIEW_ROWS && (
          <span className="text-[11px] text-muted-foreground">Preview of first {PREVIEW_ROWS} rows</span>
        )}
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => void ex.copy("md")}>
          <Copy /> Copy full table
        </Button>
        <Button size="sm" variant="outline" onClick={() => ex.download("md")}>
          <Download /> .md
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {raw ? (
          <pre className="font-mono text-xs leading-relaxed">{md}</pre>
        ) : (
          <div className="md-prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

