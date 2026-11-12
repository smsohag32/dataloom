import type { Table } from "apache-arrow";
import type { CellValue, ColumnInfo, ColType, QueryResult } from "@/types";
import { getDuckDB } from "./client";

export const MAX_ROWS = 500_000;

export function arrowTypeToColType(t: string): ColType {
  const s = t.toLowerCase();
  if (/bool/.test(s)) return "boolean";
  if (/timestamp|date|time/.test(s)) return "timestamp";
  if (/int|uint/.test(s)) return "integer";
  if (/float|double|decimal/.test(s)) return "double";
  if (/struct|list|map|binary/.test(s)) return "json";
  return "varchar";
}

export function duckTypeToColType(t: string): ColType {
  const s = t.toUpperCase();
  if (s === "BOOLEAN") return "boolean";
  if (/^(TIMESTAMP|DATE|TIME)/.test(s)) return "timestamp";
  if (/INT|HUGEINT/.test(s) && !/\[|STRUCT|MAP/.test(s)) return "integer";
  if (/^(DOUBLE|FLOAT|REAL|DECIMAL|NUMERIC)/.test(s)) return "double";
  if (/STRUCT|MAP|\[\]|^JSON$|^UNION/.test(s)) return "json";
  return "varchar";
}

function pad(n: number, w = 2) {
  return String(n).padStart(w, "0");
}

function fmtTimestamp(ms: number, dateOnly: boolean): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(ms);
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  if (dateOnly) return date;
  return `${date} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function normalize(v: unknown, typeStr: string): CellValue {
  if (v === null || v === undefined) return null;
  if (typeof v === "bigint") {
    return v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString();
  }
  if (typeof v === "number") {
    if (/timestamp|date/i.test(typeStr)) return fmtTimestamp(v, /date/i.test(typeStr) && !/timestamp/i.test(typeStr));
    return v;
  }
  if (typeof v === "string" || typeof v === "boolean") return v;
  if (v instanceof Date) return fmtTimestamp(v.getTime(), false);
  if (/decimal/i.test(typeStr)) return Number(String(v));
  // Structs / lists / maps / binary.
  const anyV = v as { toJSON?: () => unknown };
  try {
    const plain = typeof anyV.toJSON === "function" ? anyV.toJSON() : v;
    return JSON.stringify(plain, (_k, val) => (typeof val === "bigint" ? Number(val) : val));
  } catch {
    return String(v);
  }
}

export function stripSemicolon(sql: string): string {
  return sql.trim().replace(/;+\s*$/, "");
}

/** Run a statement and materialise the result (capped at MAX_ROWS) for the grid. */
export async function runQuery(sql: string): Promise<QueryResult> {
  const { conn } = await getDuckDB();
  const t0 = performance.now();
  const table: Table = await conn.query(sql);
  const durationMs = performance.now() - t0;

  const fields = table.schema.fields;
  const typeStrs = fields.map((f) => String(f.type));
  const columns: ColumnInfo[] = fields.map((f, i) => ({
    name: f.name,
    type: arrowTypeToColType(typeStrs[i]),
    rawType: typeStrs[i],
  }));

  const total = table.numRows;
  const n = Math.min(total, MAX_ROWS);
  const vectors = fields.map((_, i) => table.getChildAt(i));
  const rows: CellValue[][] = new Array(n);
  for (let r = 0; r < n; r++) {
    const row: CellValue[] = new Array(fields.length);
    for (let c = 0; c < fields.length; c++) row[c] = normalize(vectors[c]?.get(r), typeStrs[c]);
    rows[r] = row;
  }

  let bytes = 0;
  for (const b of table.batches) bytes += b.data.byteLength ?? 0;
  if (!bytes) bytes = total * fields.length * 8;

  return { columns, rows, rowCount: total, durationMs, bytes, truncated: total > n, sql };
}

/** Execute a statement without caring about the result (DDL / DML). */
export async function execute(sql: string): Promise<void> {
  const { conn } = await getDuckDB();
  await conn.query(sql);
}

export interface ColumnStats {
  nulls: number;
  unique: number;
  min: string | null;
  max: string | null;
}

/** Quick per-column stats computed over the current query. */
export async function columnStats(sql: string, column: string): Promise<ColumnStats> {
  const c = `"${column.replace(/"/g, '""')}"`;
  const { conn } = await getDuckDB();
  const res = await conn.query(
    `SELECT count(*) - count(${c}) AS nulls, count(DISTINCT ${c}) AS uniq, min(${c})::VARCHAR AS mn, max(${c})::VARCHAR AS mx FROM (${stripSemicolon(sql)}) AS _q`,
  );
  const row = res.get(0);
  return {
    nulls: Number(row?.nulls ?? 0),
    unique: Number(row?.uniq ?? 0),
    min: row?.mn ?? null,
    max: row?.mx ?? null,
  };
}

