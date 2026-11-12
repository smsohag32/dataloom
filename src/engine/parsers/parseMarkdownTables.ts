import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root, Table, PhrasingContent, RootContent } from "mdast";
import { exportToMarkdown } from "../export/exportToMarkdown";

export interface ParsedMarkdownTable {
  /** 1-based position of the table within the document. */
  index: number;
  headers: string[];
  rows: string[][];
  /** Nearest preceding heading, useful for naming/labelling. */
  heading?: string;
  /** Source offsets, used by the formatter. */
  start: number;
  end: number;
}

const processor = unified().use(remarkParse).use(remarkGfm);

function inlineText(nodes: PhrasingContent[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case "text":
        case "inlineCode":
          return n.value;
        case "break":
          return " ";
        case "image":
          return n.alt ?? "";
        default:
          return "children" in n ? inlineText(n.children as PhrasingContent[]) : "";
      }
    })
    .join("")
    .trim();
}

function tableToRows(t: Table): string[][] {
  return t.children.map((r) => r.children.map((c) => inlineText(c.children)));
}

/** Extract every GFM table from a markdown document. */
export function parseMarkdownTables(markdown: string): ParsedMarkdownTable[] {
  const tree = processor.parse(markdown) as Root;
  const out: ParsedMarkdownTable[] = [];
  let heading: string | undefined;

  const visit = (nodes: RootContent[]) => {
    for (const node of nodes) {
      if (node.type === "heading") {
        heading = inlineText(node.children);
      } else if (node.type === "table") {
        const [head, ...body] = tableToRows(node);
        if (!head || head.length === 0) continue;
        out.push({
          index: out.length + 1,
          headers: head.map((h, i) => h || `column_${i + 1}`),
          rows: body.map((r) => head.map((_, i) => r[i] ?? "")),
          heading,
          start: node.position?.start.offset ?? 0,
          end: node.position?.end.offset ?? 0,
        });
      } else if ("children" in node) {
        visit(node.children as RootContent[]);
      }
    }
  };
  visit(tree.children);
  return out;
}

/** Re-render every table in the document with aligned columns. */
export function formatMarkdown(markdown: string): string {
  const tables = parseMarkdownTables(markdown);
  let result = markdown;
  for (const t of [...tables].reverse()) {
    const formatted = exportToMarkdown(t.headers, t.rows, { pad: true });
    result = result.slice(0, t.start) + formatted + result.slice(t.end);
  }
  return result;
}

