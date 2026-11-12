import { qi } from "@/lib/utils";

/**
 * Pure SQL generators for the no-code quick transforms.
 * Every transform rewrites the table in place so the grid can simply re-run its query.
 */
export type TransformSpec =
  | { kind: "dedupe"; table: string }
  | { kind: "dropNulls"; table: string; columns: string[] }
  | { kind: "trim"; table: string; column: string }
  | { kind: "case"; table: string; column: string; mode: "upper" | "lower" | "title" }
  | { kind: "rename"; table: string; column: string; to: string }
  | { kind: "drop"; table: string; column: string };

const rewrite = (table: string, select: string, where = "") =>
  `CREATE OR REPLACE TABLE ${qi(table)} AS\nSELECT ${select}\nFROM ${qi(table)}${where};`;

export function transformToSql(t: TransformSpec): string {
  switch (t.kind) {
    case "dedupe":
      return rewrite(t.table, "DISTINCT *");
    case "dropNulls": {
      if (t.columns.length === 0) throw new Error("No columns to check for NULL");
      return rewrite(t.table, "*", `\nWHERE ${t.columns.map((c) => `${qi(c)} IS NOT NULL`).join("\n  AND ")}`);
    }
    case "trim":
      return rewrite(t.table, `* REPLACE (trim(${qi(t.column)}) AS ${qi(t.column)})`);
    case "case": {
      const c = qi(t.column);
      const expr =
        t.mode === "upper"
          ? `upper(${c})`
          : t.mode === "lower"
            ? `lower(${c})`
            : `array_to_string(list_transform(string_split(lower(${c}), ' '), w -> upper(w[1]) || w[2:]), ' ')`;
      return rewrite(t.table, `* REPLACE (${expr} AS ${c})`);
    }
    case "rename":
      return `ALTER TABLE ${qi(t.table)} RENAME COLUMN ${qi(t.column)} TO ${qi(t.to)};`;
    case "drop":
      return `ALTER TABLE ${qi(t.table)} DROP COLUMN ${qi(t.column)};`;
  }
}

/** Best-effort detection of the single table a simple query reads from. */
export function detectSourceTable(sql: string, knownTables: string[]): string | null {
  const re = /\bfrom\s+("(?:[^"]|"")+"|[A-Za-z_][\w$]*)/gi;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    const raw = m[1];
    const name = raw.startsWith('"') ? raw.slice(1, -1).replace(/""/g, '"') : raw;
    const hit = knownTables.find((t) => t.toLowerCase() === name.toLowerCase());
    if (hit) found.add(hit);
  }
  return found.size === 1 ? [...found][0] : null;
}

