import type { CellValue, ColumnInfo } from "@/types";
import { qi } from "@/lib/utils";

function csvCell(v: CellValue): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: CellValue[][]): string {
  return [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n") + "\n";
}

export function toJson(headers: string[], rows: CellValue[][]): string {
  const objs = rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? null])));
  return JSON.stringify(objs, null, 2);
}

function sqlLiteral(v: CellValue, col: ColumnInfo): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  void col;
  return `'${String(v).replace(/'/g, "''")}'`;
}

const SQL_TYPES: Record<ColumnInfo["type"], string> = {
  integer: "BIGINT",
  double: "DOUBLE",
  boolean: "BOOLEAN",
  timestamp: "TIMESTAMP",
  varchar: "VARCHAR",
  json: "VARCHAR",
};

/** `CREATE TABLE` + batched multi-row `INSERT` statements. */
export function toSqlInsert(
  tableName: string,
  columns: ColumnInfo[],
  rows: CellValue[][],
  { batchSize = 500, createTable = true } = {},
): string {
  const out: string[] = [];
  if (createTable) {
    out.push(
      `CREATE TABLE ${qi(tableName)} (\n${columns.map((c) => `  ${qi(c.name)} ${SQL_TYPES[c.type]}`).join(",\n")}\n);`,
    );
  }
  const colList = columns.map((c) => qi(c.name)).join(", ");
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize).map((r) => `  (${columns.map((c, j) => sqlLiteral(r[j], c)).join(", ")})`);
    out.push(`INSERT INTO ${qi(tableName)} (${colList}) VALUES\n${chunk.join(",\n")};`);
  }
  return out.join("\n\n") + "\n";
}

