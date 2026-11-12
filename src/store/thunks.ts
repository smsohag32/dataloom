import { uid } from "@/lib/utils";
import type { AppThunk } from "./index";
import { workspaceActions as w } from "./slices/workspaceSlice";
import { queryActions as q } from "./slices/querySlice";
import { gridActions as g } from "./slices/gridSlice";
import { getDuckDB } from "@/engine/duckdb/client";
import { runQuery, execute, stripSemicolon } from "@/engine/duckdb/query";
import {
  describeTable,
  detectKind,
  dropTable,
  ingestFile,
  ingestSource,
  syncMarkdownTables,
  type Source,
} from "@/engine/duckdb/ingest";
import { resultStore } from "@/engine/resultStore";
import { transformToSql, detectSourceTable, type TransformSpec } from "@/engine/transforms/transforms";
import { SAMPLES, BIG_TABLE_SQL } from "@/samples";
import { qi } from "@/lib/utils";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const initEngine = (): AppThunk => async (dispatch) => {
  dispatch(w.engineStatus({ status: "loading", error: null }));
  try {
    await getDuckDB();
    dispatch(w.engineStatus({ status: "ready", error: null }));
  } catch (e) {
    dispatch(w.engineStatus({ status: "error", error: errMsg(e) }));
  }
};

export const openSqlTab =
  (sql = "", title?: string): AppThunk<string> =>
  async (dispatch, getState) => {
    const n = getState().workspace.tabs.filter((t) => t.kind === "sql").length + 1;
    const id = uid("tab");
    dispatch(w.tabOpened({ tab: { id, title: title ?? `Query ${n}`, kind: "sql" } }));
    dispatch(q.sqlChanged({ tabId: id, sql }));
    return id;
  };

async function afterIngest(dispatch: Parameters<AppThunk>[0], getState: Parameters<AppThunk>[1], file: { name: string; size: number }, res: Awaited<ReturnType<typeof ingestSource>>) {
  dispatch(
    w.filesLoaded({
      file: { id: res.fileId, name: file.name, size: file.size, kind: res.kind, tables: res.tables.map((t) => t.name) },
      tables: res.tables,
    }),
  );
  if (res.kind === "markdown" && res.markdownText !== undefined) {
    const id = uid("tab");
    dispatch(w.tabOpened({ tab: { id, title: file.name, kind: "markdown", fileId: res.fileId }, markdown: res.markdownText }));
  }
  const first = res.tables[0];
  if (first) {
    const sql = `SELECT * FROM ${qi(first.name)} LIMIT 1000;`;
    const hasSql = getState().workspace.tabs.some((t) => t.kind === "sql");
    const tabId = await dispatch(openSqlTab(sql, first.name));
    void hasSql;
    await dispatch(runTab(tabId));
  }
}

export const loadFiles =
  (files: File[]): AppThunk =>
  async (dispatch, getState) => {
    for (const file of files) {
      if (!detectKind(file.name)) {
        dispatch(w.noticeSet({ kind: "error", message: `"${file.name}" is not a supported file type.` }));
        continue;
      }
      dispatch(w.loadingSet(`Loading ${file.name}…`));
      try {
        const st = getState().workspace;
        const res = await ingestFile(file, st.tables.map((t) => t.name), { flattenJson: st.flattenJson });
        await afterIngest(dispatch, getState, file, res);
      } catch (e) {
        dispatch(w.noticeSet({ kind: "error", message: `Failed to load ${file.name}: ${errMsg(e)}` }));
      }
    }
    dispatch(w.loadingSet(null));
  };

export const loadSample =
  (id: string): AppThunk =>
  async (dispatch, getState) => {
    const sample = SAMPLES.find((s) => s.id === id);
    if (!sample) return;
    const src: Source = sample.build();
    dispatch(w.loadingSet(`Loading ${sample.title}…`));
    try {
      const st = getState().workspace;
      const res = await ingestSource(src, st.tables.map((t) => t.name), { flattenJson: st.flattenJson });
      await afterIngest(dispatch, getState, { name: src.name, size: (src.text ?? "").length }, res);
    } catch (e) {
      dispatch(w.noticeSet({ kind: "error", message: `Failed to load sample: ${errMsg(e)}` }));
    }
    dispatch(w.loadingSet(null));
  };

export const loadBigSample = (): AppThunk => async (dispatch) => {
  dispatch(w.loadingSet("Generating 100,000 rows…"));
  try {
    await execute(BIG_TABLE_SQL);
    const schema = await describeTable("benchmark_100k", "derived");
    dispatch(w.tableUpserted(schema));
    dispatch(w.activeTableSet(schema.name));
    const tabId = await dispatch(openSqlTab("SELECT * FROM benchmark_100k;", "benchmark_100k"));
    await dispatch(runTab(tabId));
  } catch (e) {
    dispatch(w.noticeSet({ kind: "error", message: errMsg(e) }));
  }
  dispatch(w.loadingSet(null));
};

/** Run the SQL for a tab (a selection / explicit statement can override the editor text). */
export const runTab =
  (tabId: string, sqlOverride?: string): AppThunk =>
  async (dispatch, getState) => {
    const sql = (sqlOverride ?? getState().query.sqlByTab[tabId] ?? "").trim();
    if (!sql) return;
    dispatch(q.queryStarted(tabId));
    try {
      const result = await runQuery(stripSemicolon(sql));
      resultStore.set(tabId, result);
      dispatch(g.resultReset());
      dispatch(
        q.querySucceeded({
          tabId,
          durationMs: result.durationMs,
          rowCount: result.rowCount,
          bytes: result.bytes,
          truncated: result.truncated,
          sql,
        }),
      );
      dispatch(q.historyAdded({ id: uid("h"), sql, at: Date.now(), durationMs: result.durationMs, rows: result.rowCount, ok: true }));
      // DDL/DML may have changed the schema.
      if (/^\s*(create|drop|alter|insert|update|delete)\b/i.test(sql)) await dispatch(refreshSchema());
    } catch (e) {
      dispatch(q.queryFailed({ tabId, error: errMsg(e) }));
      dispatch(q.historyAdded({ id: uid("h"), sql, at: Date.now(), durationMs: 0, rows: 0, ok: false }));
    }
  };

/** Re-describe every known table and pick up tables created via SQL. */
export const refreshSchema = (): AppThunk => async (dispatch, getState) => {
  const { conn } = await getDuckDB();
  const res = await conn.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' ORDER BY table_name`);
  const names = res.toArray().map((r) => String(r.table_name));
  const known = getState().workspace.tables;
  for (const t of known) if (!names.includes(t.name)) dispatch(w.tableRemoved(t.name));
  for (const n of names) {
    const prev = known.find((t) => t.name === n);
    dispatch(w.tableUpserted(await describeTable(n, prev?.sourceType ?? "derived", prev?.fileId)));
  }
};

export const applyTransform =
  (spec: TransformSpec, tabId: string): AppThunk =>
  async (dispatch, getState) => {
    const sql = transformToSql(spec);
    try {
      await execute(sql);
      dispatch(q.historyAdded({ id: uid("h"), sql, at: Date.now(), durationMs: 0, rows: 0, ok: true }));
      dispatch(w.tableUpserted(await describeTable(spec.table, getState().workspace.tables.find((t) => t.name === spec.table)?.sourceType ?? "derived")));
      await dispatch(runTab(tabId));
      dispatch(w.noticeSet({ kind: "info", message: "Transform applied. SQL copied to history." }));
    } catch (e) {
      dispatch(w.noticeSet({ kind: "error", message: errMsg(e) }));
    }
  };

/** Save the current result as a new table (so quick transforms can act on it). */
export const materializeResult =
  (tabId: string, name: string): AppThunk =>
  async (dispatch, getState) => {
    const sql = getState().query.metaByTab[tabId]?.ranSql;
    if (!sql) return;
    try {
      await execute(`CREATE OR REPLACE TABLE ${qi(name)} AS ${stripSemicolon(sql)}`);
      dispatch(w.tableUpserted(await describeTable(name, "derived")));
      dispatch(w.activeTableSet(name));
      dispatch(w.noticeSet({ kind: "info", message: `Saved result as table "${name}".` }));
    } catch (e) {
      dispatch(w.noticeSet({ kind: "error", message: errMsg(e) }));
    }
  };

export const removeTable =
  (name: string): AppThunk =>
  async (dispatch) => {
    try {
      await dropTable(name);
      dispatch(w.tableRemoved(name));
    } catch (e) {
      dispatch(w.noticeSet({ kind: "error", message: errMsg(e) }));
    }
  };

export const closeTab =
  (tabId: string): AppThunk =>
  async (dispatch) => {
    resultStore.delete(tabId);
    dispatch(q.tabQueryCleared(tabId));
    dispatch(w.tabClosed(tabId));
  };

/** Re-extract tables after the user edits a markdown document. */
export const resyncMarkdown =
  (tabId: string): AppThunk =>
  async (dispatch, getState) => {
    const st = getState().workspace;
    const tab = st.tabs.find((t) => t.id === tabId);
    if (!tab || tab.kind !== "markdown" || !tab.fileId) return;
    try {
      const old = st.tables.filter((t) => t.fileId === tab.fileId).map((t) => t.name);
      for (const n of old) {
        await dropTable(n);
        dispatch(w.tableRemoved(n));
      }
      const taken = getState().workspace.tables.map((t) => t.name);
      const tables = await syncMarkdownTables(tab.fileId, tab.title, st.markdownDocs[tabId] ?? "", taken);
      tables.forEach((t) => dispatch(w.tableUpserted(t)));
      dispatch(w.noticeSet({ kind: "info", message: `Extracted ${tables.length} table(s) from ${tab.title}.` }));
    } catch (e) {
      dispatch(w.noticeSet({ kind: "error", message: errMsg(e) }));
    }
  };

export const openTableQuery =
  (table: string): AppThunk =>
  async (dispatch) => {
    dispatch(w.activeTableSet(table));
    const tabId = await dispatch(openSqlTab(`SELECT * FROM ${qi(table)} LIMIT 1000;`, table));
    await dispatch(runTab(tabId));
  };

export { detectSourceTable };

