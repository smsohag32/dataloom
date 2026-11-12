import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/editor/edcore.main";
import "monaco-editor/esm/vs/basic-languages/sql/sql.contribution";
import "monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { loader } from "@monaco-editor/react";
import { format as formatSqlLib } from "sql-formatter";
import { store } from "@/store";

// Bundle Monaco locally (no CDN) so the app is fully offline-capable.
(self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};
loader.config({ monaco });

const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET", "JOIN", "LEFT JOIN", "INNER JOIN",
  "CROSS JOIN", "ON", "AS", "WITH", "UNION ALL", "DISTINCT", "CASE WHEN", "THEN", "ELSE", "END", "AND", "OR", "NOT",
  "IN", "IS NULL", "IS NOT NULL", "LIKE", "ILIKE", "BETWEEN", "COUNT", "SUM", "AVG", "MIN", "MAX", "CAST", "COALESCE",
  "DESCRIBE", "CREATE TABLE", "CREATE OR REPLACE TABLE", "INSERT INTO", "UPDATE", "DELETE FROM", "DROP TABLE",
  "date_trunc", "strftime", "regexp_matches", "string_split", "list_aggr", "unnest", "QUALIFY", "SUMMARIZE", "EXPLAIN",
];

let registered = false;

/** Schema-aware completion fed straight from the Redux store. */
export function registerSqlCompletion(): void {
  if (registered) return;
  registered = true;
  monaco.languages.registerCompletionItemProvider("sql", {
    triggerCharacters: [".", " ", '"'],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
      const { tables } = store.getState().workspace;
      const K = monaco.languages.CompletionItemKind;
      const quote = (n: string) => (/^[a-z_][a-z0-9_]*$/.test(n) ? n : `"${n.replace(/"/g, '""')}"`);

      // After `table.` suggest only that table's columns.
      const before = model.getValueInRange(new monaco.Range(position.lineNumber, 1, position.lineNumber, word.startColumn));
      const dotted = /([A-Za-z_][\w]*)\.$/.exec(before);
      if (dotted) {
        const t = tables.find((x) => x.name.toLowerCase() === dotted[1].toLowerCase());
        if (t) {
          return {
            suggestions: t.columns.map((c) => ({
              label: c.name,
              kind: K.Field,
              insertText: quote(c.name),
              detail: c.rawType,
              range,
            })),
          };
        }
      }

      const suggestions: monaco.languages.CompletionItem[] = [];
      for (const t of tables) {
        suggestions.push({
          label: t.name,
          kind: K.Struct,
          insertText: quote(t.name),
          detail: `table · ${t.rowCount.toLocaleString()} rows`,
          sortText: "0" + t.name,
          range,
        });
        for (const c of t.columns) {
          suggestions.push({
            label: c.name,
            kind: K.Field,
            insertText: quote(c.name),
            detail: `${t.name}.${c.rawType}`,
            sortText: "1" + c.name,
            range,
          });
        }
      }
      for (const k of SQL_KEYWORDS) {
        suggestions.push({ label: k, kind: K.Keyword, insertText: k, sortText: "2" + k, range });
      }
      return { suggestions };
    },
  });
}

export function defineThemes(): void {
  monaco.editor.defineTheme("dataloom-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "keyword.sql", foreground: "4f46e5", fontStyle: "bold" },
      { token: "string.sql", foreground: "0f766e" },
      { token: "number", foreground: "b45309" },
      { token: "comment", foreground: "94a3b8", fontStyle: "italic" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#1a1d2e",
      "editorLineNumber.foreground": "#a3a8bd",
      "editorLineNumber.activeForeground": "#4b5068",
      "editor.lineHighlightBackground": "#f4f5fa",
      "editorGutter.background": "#ffffff",
      "editorWidget.background": "#ffffff",
      "editor.selectionBackground": "#4f46e526",
    },
  });
  monaco.editor.defineTheme("dataloom-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "keyword.sql", foreground: "8ea2ff", fontStyle: "bold" },
      { token: "string.sql", foreground: "5eead4" },
      { token: "number", foreground: "fbbf24" },
      { token: "comment", foreground: "5b6180", fontStyle: "italic" },
    ],
    colors: {
      "editor.background": "#0c0e17",
      "editor.foreground": "#e4e7f2",
      "editorLineNumber.foreground": "#444a66",
      "editorLineNumber.activeForeground": "#9aa0bd",
      "editor.lineHighlightBackground": "#12152100",
      "editorGutter.background": "#0c0e17",
      "editorWidget.background": "#12152a",
      "editor.selectionBackground": "#6c7bff40",
    },
  });
}

export function formatSql(sql: string): string {
  try {
    return formatSqlLib(sql, { language: "postgresql", keywordCase: "upper", tabWidth: 2 });
  } catch {
    return sql;
  }
}

export { monaco };

