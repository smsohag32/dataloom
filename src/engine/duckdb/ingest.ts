import type { ColumnInfo, SourceType, TableSchema } from "@/types";
import { qi, ql, sanitizeIdentifier, uid } from "@/lib/utils";
import { getDuckDB, duckdb } from "./client";
import { duckTypeToColType, execute } from "./query";
import { flattenToNdjson } from "../parsers/flattenJson";
import { parseMarkdownTables } from "../parsers/parseMarkdownTables";
import { toCsv } from "../export/formats";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";

export interface IngestOptions {
  flattenJson: boolean;
}

export interface IngestResult {
  fileId: string;
  kind: SourceType;
  tables: TableSchema[];
  /** Raw text for markdown files, so the editor can open them. */
  markdownText?: string;
}

export function detectKind(filename: string): SourceType | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "csv":
      return "csv";
    case "tsv":
    case "tab":
      return "tsv";
    case "json":
      return "json";
    case "jsonl":
    case "ndjson":
      return "jsonl";
    case "sqlite":
    case "sqlite3":
    case "db":
      return "sqlite";
    case "md":
    case "markdown":
      return "markdown";
    default:
      return null;
  }
}

export async function describeTable(name: string, sourceType: SourceType, fileId?: string): Promise<TableSchema> {
  const { conn } = await getDuckDB();
  const desc = await conn.query(`DESCRIBE ${qi(name)}`);
  const columns: ColumnInfo[] = desc.toArray().map((r) => ({
    name: String(r.column_name),
    rawType: String(r.column_type),
    type: duckTypeToColType(String(r.column_type)),
  }));
  const cnt = await conn.query(`SELECT count(*)::INTEGER AS n FROM ${qi(name)}`);
  const rowCount = Number(cnt.get(0)?.n ?? 0);
  return { name, columns, rowCount, sourceType, fileId };
}

/** Pick a table name that isn't already registered. */
export async function uniqueTableName(base: string, taken: Iterable<string>): Promise<string> {
  const set = new Set([...taken].map((t) => t.toLowerCase()));
  let name = base;
  let i = 2;
  while (set.has(name.toLowerCase())) name = `${base}_${i++}`;
  return name;
}

export async function ingestFile(file: File, existing: string[], opts: IngestOptions): Promise<IngestResult> {
  const kind = detectKind(file.name);
  if (!kind) throw new Error(`Unsupported file type: ${file.name}`);
  const text = kind === "markdown" ? await file.text() : undefined;
  return ingestSource({ name: file.name, kind, file, text }, existing, opts);
}

export interface Source {
  name: string;
  kind: SourceType;
  file?: File;
  text?: string;
}

export async function ingestSource(src: Source, existing: string[], opts: IngestOptions): Promise<IngestResult> {
  const { db } = await getDuckDB();
  const fileId = uid("file");
  const virtualName = `${fileId}_${src.name}`;
  const base = sanitizeIdentifier(src.name);
  const taken = [...existing];
  const tables: TableSchema[] = [];

  const finish = async (tableName: string, kind: SourceType) => {
    tables.push(await describeTable(tableName, kind, fileId));
    taken.push(tableName);
  };

  switch (src.kind) {
    case "csv":
    case "tsv": {
      if (src.file) await db.registerFileHandle(virtualName, src.file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
      else await db.registerFileText(virtualName, src.text ?? "");
      const name = await uniqueTableName(base, taken);
      const delim = src.kind === "tsv" ? ", delim='\\t'" : "";
      await execute(
        `CREATE OR REPLACE TABLE ${qi(name)} AS SELECT * FROM read_csv_auto(${ql(virtualName)}, header=true, sample_size=20480${delim})`,
      );
      await finish(name, src.kind);
      break;
    }
    case "json":
    case "jsonl": {
      const name = await uniqueTableName(base, taken);
      const isLines = src.kind === "jsonl";
      const raw = src.text ?? (await src.file!.text());
      if (opts.flattenJson) {
        await db.registerFileText(virtualName + ".jsonl", flattenToNdjson(raw, isLines));
        await execute(
          `CREATE OR REPLACE TABLE ${qi(name)} AS SELECT * FROM read_json_auto(${ql(virtualName + ".jsonl")}, format='newline_delimited', sample_size=-1)`,
        );
      } else {
        await db.registerFileText(virtualName, raw);
        await execute(
          `CREATE OR REPLACE TABLE ${qi(name)} AS SELECT * FROM read_json_auto(${ql(virtualName)}, format='${isLines ? "newline_delimited" : "auto"}', sample_size=-1)`,
        );
      }
      await finish(name, src.kind);
      break;
    }
    case "markdown": {
      const text = src.text ?? "";
      const synced = await syncMarkdownTables(fileId, src.name, text, taken);
      return { fileId, kind: "markdown", tables: synced, markdownText: text };
    }
    case "sqlite": {
      const buf = new Uint8Array(await (src.file as File).arrayBuffer());
      const { default: initSqlJs } = await import("sql.js");
      const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
      const sdb = new SQL.Database(buf);
      try {
        const list = sdb.exec(
          "SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name",
        );
        const names = (list[0]?.values ?? []).map((r) => String(r[0]));
        for (const t of names) {
          const res = sdb.exec(`SELECT * FROM "${t.replace(/"/g, '""')}"`);
          const name = await uniqueTableName(sanitizeIdentifier(t), taken);
          const cols = res[0]?.columns ?? (sdb.exec(`PRAGMA table_info("${t.replace(/"/g, '""')}")`)[0]?.values ?? []).map((r) => String(r[1]));
          const values = res[0]?.values ?? [];
          if (values.length === 0) {
            await execute(`CREATE OR REPLACE TABLE ${qi(name)} (${cols.map((c) => `${qi(c)} VARCHAR`).join(", ")})`);
          } else {
            const nd = values
              .map((row) =>
                JSON.stringify(
                  Object.fromEntries(
                    cols.map((c, i) => [c, row[i] instanceof Uint8Array ? `<blob ${row[i]!.length} bytes>` : row[i]]),
                  ),
                ),
              )
              .join("\n");
            const vf = `${virtualName}_${name}.jsonl`;
            await db.registerFileText(vf, nd);
            await execute(
              `CREATE OR REPLACE TABLE ${qi(name)} AS SELECT * FROM read_json_auto(${ql(vf)}, format='newline_delimited', sample_size=-1)`,
            );
          }
          await finish(name, "sqlite");
        }
      } finally {
        sdb.close();
      }
      break;
    }
  }
  return { fileId, kind: src.kind, tables };
}

/** Create a table from string cells by round-tripping through CSV so DuckDB infers types. */
async function registerRows(name: string, headers: string[], rows: string[][], virtualCsv: string): Promise<void> {
  const { db } = await getDuckDB();
  await db.registerFileText(virtualCsv, toCsv(headers, rows));
  await execute(
    `CREATE OR REPLACE TABLE ${qi(name)} AS SELECT * FROM read_csv_auto(${ql(virtualCsv)}, header=true, all_varchar=false, sample_size=-1)`,
  );
}

/**
 * (Re-)register every GFM table of a markdown document as `<file>_table_N`.
 * `taken` must exclude the file's own previous tables when re-syncing.
 */
export async function syncMarkdownTables(
  fileId: string,
  filename: string,
  text: string,
  taken: string[],
): Promise<TableSchema[]> {
  const base = sanitizeIdentifier(filename);
  const used = [...taken];
  const out: TableSchema[] = [];
  for (const t of parseMarkdownTables(text)) {
    const name = await uniqueTableName(`${base}_table_${t.index}`, used);
    await registerRows(name, t.headers, t.rows, `${fileId}_${filename}_${t.index}_${Date.now()}.csv`);
    out.push(await describeTable(name, "markdown", fileId));
    used.push(name);
  }
  return out;
}

export async function dropTable(name: string): Promise<void> {
  await execute(`DROP TABLE IF EXISTS ${qi(name)}`);
}
