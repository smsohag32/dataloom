export type ColType = "integer" | "double" | "boolean" | "timestamp" | "varchar" | "json";

export interface ColumnInfo {
  name: string;
  type: ColType;
  /** Raw DuckDB / Arrow type string, e.g. `BIGINT` or `Utf8`. */
  rawType: string;
}

export type SourceType = "csv" | "tsv" | "json" | "jsonl" | "sqlite" | "markdown" | "derived";

export interface TableSchema {
  name: string;
  columns: ColumnInfo[];
  rowCount: number;
  sourceType: SourceType;
  fileId?: string;
}

export interface LoadedFile {
  id: string;
  name: string;
  size: number;
  kind: SourceType;
  tables: string[];
}

export type TabKind = "sql" | "markdown";

export interface EditorTab {
  id: string;
  title: string;
  kind: TabKind;
  fileId?: string;
}

export type CellValue = string | number | boolean | null;

export interface QueryResult {
  columns: ColumnInfo[];
  rows: CellValue[][];
  rowCount: number;
  durationMs: number;
  /** Estimated in-memory footprint of the result (Arrow buffers), in bytes. */
  bytes: number;
  truncated: boolean;
  sql: string;
}

export type QueryStatus = "idle" | "running" | "success" | "error";

export type OutputView = "table" | "chart" | "markdown" | "export";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

