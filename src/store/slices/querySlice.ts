import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { QueryStatus } from "@/types";

export interface HistoryItem {
  id: string;
  sql: string;
  at: number;
  durationMs: number;
  rows: number;
  ok: boolean;
}

export interface Snippet {
  id: string;
  name: string;
  sql: string;
}

export interface TabQueryMeta {
  status: QueryStatus;
  error: string | null;
  durationMs: number | null;
  rowCount: number | null;
  bytes: number | null;
  truncated: boolean;
  /** The SQL that produced the current result. */
  ranSql: string | null;
}

interface QueryState {
  sqlByTab: Record<string, string>;
  metaByTab: Record<string, TabQueryMeta>;
  history: HistoryItem[];
  snippets: Snippet[];
}

const emptyMeta: TabQueryMeta = {
  status: "idle",
  error: null,
  durationMs: null,
  rowCount: null,
  bytes: null,
  truncated: false,
  ranSql: null,
};

const initialState: QueryState = { sqlByTab: {}, metaByTab: {}, history: [], snippets: [] };

const slice = createSlice({
  name: "query",
  initialState,
  reducers: {
    sqlChanged(s, a: PayloadAction<{ tabId: string; sql: string }>) {
      s.sqlByTab[a.payload.tabId] = a.payload.sql;
    },
    queryStarted(s, a: PayloadAction<string>) {
      s.metaByTab[a.payload] = { ...(s.metaByTab[a.payload] ?? emptyMeta), status: "running", error: null };
    },
    querySucceeded(
      s,
      a: PayloadAction<{ tabId: string; durationMs: number; rowCount: number; bytes: number; truncated: boolean; sql: string }>,
    ) {
      const { tabId, ...rest } = a.payload;
      s.metaByTab[tabId] = { status: "success", error: null, ranSql: rest.sql, ...rest };
    },
    queryFailed(s, a: PayloadAction<{ tabId: string; error: string }>) {
      const prev = s.metaByTab[a.payload.tabId] ?? emptyMeta;
      s.metaByTab[a.payload.tabId] = { ...prev, status: "error", error: a.payload.error };
    },
    tabQueryCleared(s, a: PayloadAction<string>) {
      delete s.sqlByTab[a.payload];
      delete s.metaByTab[a.payload];
    },
    historyAdded(s, a: PayloadAction<HistoryItem>) {
      s.history.unshift(a.payload);
      s.history = s.history.slice(0, 100);
    },
    historyCleared(s) {
      s.history = [];
    },
    snippetSaved(s, a: PayloadAction<Snippet>) {
      s.snippets.unshift(a.payload);
    },
    snippetRemoved(s, a: PayloadAction<string>) {
      s.snippets = s.snippets.filter((x) => x.id !== a.payload);
    },
    hydrated(s, a: PayloadAction<Partial<Pick<QueryState, "history" | "snippets">>>) {
      if (a.payload.history) s.history = a.payload.history;
      if (a.payload.snippets) s.snippets = a.payload.snippets;
    },
  },
});

export const queryActions = slice.actions;
export default slice.reducer;

