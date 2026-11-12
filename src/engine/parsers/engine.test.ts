import { describe, expect, it } from "vitest";
import { formatMarkdown, parseMarkdownTables } from "./parseMarkdownTables";
import { exportToMarkdown } from "../export/exportToMarkdown";
import { flattenObject, flattenToNdjson } from "./flattenJson";
import { toCsv, toSqlInsert } from "../export/formats";
import { detectSourceTable, transformToSql } from "../transforms/transforms";

const MD = `# Title

| name | qty |
|------|----:|
| a    |   1 |
| b|c  |   2 |

text

## Second

| x | y |
|---|---|
| 1 | **bold** |
`;

describe("parseMarkdownTables", () => {
  it("extracts every GFM table with headings", () => {
    const t = parseMarkdownTables(MD);
    expect(t).toHaveLength(2);
    expect(t[0].headers).toEqual(["name", "qty"]);
    expect(t[0].rows).toEqual([["a", "1"], ["b", "c"]]);
    expect(t[0].heading).toBe("Title");
    expect(t[1].heading).toBe("Second");
    expect(t[1].rows[0]).toEqual(["1", "bold"]);
  });
  it("returns [] when there are no tables", () => {
    expect(parseMarkdownTables("# hi\n\njust text")).toEqual([]);
  });
});

describe("exportToMarkdown", () => {
  it("escapes pipes, aligns numbers right, renders null", () => {
    const md = exportToMarkdown(["a", "n"], [["x|y", 1], [null, 22]], { nullText: "NULL" });
    const lines = md.split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[2]).toContain("x\\|y");
    expect(lines[3]).toContain("NULL");
    expect(lines[1]).toMatch(/-:\s*\|$/);
  });
  it("round-trips through the parser", () => {
    const md = exportToMarkdown(["id", "name"], [[1, "ann"], [2, "bob"]]);
    const [t] = parseMarkdownTables(md);
    expect(t.headers).toEqual(["id", "name"]);
    expect(t.rows).toEqual([["1", "ann"], ["2", "bob"]]);
  });
});

describe("formatMarkdown", () => {
  it("aligns tables and keeps surrounding text", () => {
    const out = formatMarkdown(MD);
    expect(out).toContain("# Title");
    expect(out).toContain("text");
    expect(parseMarkdownTables(out)).toHaveLength(2);
  });
});

describe("flattenJson", () => {
  it("uses dot-notation and stringifies arrays", () => {
    expect(flattenObject({ a: { b: 1, c: { d: 2 } }, e: [1, 2] })).toEqual({ "a.b": 1, "a.c.d": 2, e: "[1,2]" });
  });
  it("unwraps a single array property and unifies keys", () => {
    const nd = flattenToNdjson(JSON.stringify({ data: [{ a: 1 }, { b: { c: 2 } }] }), false);
    const rows = nd.split("\n").map((l) => JSON.parse(l));
    expect(rows).toEqual([{ a: 1, "b.c": null }, { a: null, "b.c": 2 }]);
  });
  it("handles JSONL", () => {
    expect(flattenToNdjson('{"a":{"b":1}}\n{"a":{"b":2}}', true).split("\n")).toHaveLength(2);
  });
});

describe("exports", () => {
  it("quotes CSV cells", () => {
    expect(toCsv(["a", "b"], [["x,y", 'q"r'], [null, 1]])).toBe('a,b\n"x,y","q""r"\n,1\n');
  });
  it("generates INSERT statements", () => {
    const sql = toSqlInsert("t", [{ name: "a", type: "varchar", rawType: "VARCHAR" }, { name: "n", type: "integer", rawType: "BIGINT" }], [["o'k", 1], [null, 2]]);
    expect(sql).toContain('CREATE TABLE "t"');
    expect(sql).toContain("('o''k', 1)");
    expect(sql).toContain("(NULL, 2)");
  });
});

describe("transforms", () => {
  it("generates SQL", () => {
    expect(transformToSql({ kind: "dedupe", table: "t" })).toContain("SELECT DISTINCT *");
    expect(transformToSql({ kind: "dropNulls", table: "t", columns: ["a", "b"] })).toContain('"a" IS NOT NULL');
    expect(transformToSql({ kind: "rename", table: "t", column: "a", to: "b" })).toBe('ALTER TABLE "t" RENAME COLUMN "a" TO "b";');
    expect(transformToSql({ kind: "trim", table: "t", column: "a" })).toContain('trim("a")');
    expect(() => transformToSql({ kind: "dropNulls", table: "t", columns: [] })).toThrow();
  });
  it("detects a single source table", () => {
    expect(detectSourceTable('SELECT * FROM "orders" LIMIT 5', ["orders", "x"])).toBe("orders");
    expect(detectSourceTable("select * from a join b", ["a", "b"])).toBe("a");
    expect(detectSourceTable("select * from a, (select * from b)", ["a", "b"])).toBeNull();
  });
});
