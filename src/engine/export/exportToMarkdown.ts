import type { CellValue } from "@/types";

export interface MarkdownOptions {
  /** Pad cells so the raw source is column-aligned (nicer in READMEs). */
  pad?: boolean;
  /** Right-align numeric columns. */
  alignNumbers?: boolean;
  nullText?: string;
}

function cell(v: CellValue | undefined, nullText: string): string {
  if (v === null || v === undefined) return nullText;
  return String(v).replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");
}

/** Generate a GitHub-flavoured markdown table. */
export function exportToMarkdown(
  headers: string[],
  rows: CellValue[][],
  { pad = true, alignNumbers = true, nullText = "" }: MarkdownOptions = {},
): string {
  const head = headers.map((h) => cell(h, ""));
  const body = rows.map((r) => headers.map((_, i) => cell(r[i], nullText)));
  const numeric = headers.map(
    (_, i) =>
      alignNumbers &&
      rows.length > 0 &&
      rows.every((r) => r[i] === null || r[i] === undefined || typeof r[i] === "number"),
  );
  const widths = head.map((h, i) =>
    pad ? Math.max(3, h.length, ...body.map((r) => r[i].length)) : 3,
  );
  const fmt = (v: string, i: number) =>
    pad ? (numeric[i] ? v.padStart(widths[i]) : v.padEnd(widths[i])) : v;
  const line = (cols: string[]) => `| ${cols.map(fmt).join(" | ")} |`;
  const sep = `| ${widths.map((w, i) => (numeric[i] ? `${"-".repeat(w - 1)}:` : "-".repeat(w))).join(" | ")} |`;
  return [line(head), sep, ...body.map(line)].join("\n");
}

