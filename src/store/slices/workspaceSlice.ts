import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { EditorTab, LoadedFile, TableSchema } from "@/types";

interface WorkspaceState {
  files: LoadedFile[];
  tables: TableSchema[];
  tabs: EditorTab[];
  activeTabId: string | null;
  /** Markdown source per markdown tab (small text, fine to keep in Redux). */
  markdownDocs: Record<string, string>;
  activeTable: string | null;
  flattenJson: boolean;
  engine: { status: "loading" | "ready" | "error"; error: string | null };
  loading: string | null;
  notice: { kind: "error" | "info"; message: string } | null;
}

const initialState: WorkspaceState = {
  files: [],
  tables: [],
  tabs: [],
  activeTabId: null,
  markdownDocs: {},
  activeTable: null,
  flattenJson: true,
  engine: { status: "loading", error: null },
  loading: null,
  notice: null,
};

const slice = createSlice({
  name: "workspace",
  initialState,
  reducers: {
    engineStatus(s, a: PayloadAction<WorkspaceState["engine"]>) {
      s.engine = a.payload;
    },
    filesLoaded(s, a: PayloadAction<{ file: LoadedFile; tables: TableSchema[] }>) {
      s.files.push(a.payload.file);
      for (const t of a.payload.tables) {
        s.tables = s.tables.filter((x) => x.name !== t.name);
        s.tables.push(t);
      }
      s.activeTable = a.payload.tables[0]?.name ?? s.activeTable;
    },
    tableUpserted(s, a: PayloadAction<TableSchema>) {
      const i = s.tables.findIndex((t) => t.name === a.payload.name);
      if (i >= 0) s.tables[i] = { ...s.tables[i], ...a.payload };
      else s.tables.push(a.payload);
    },
    tableRemoved(s, a: PayloadAction<string>) {
      s.tables = s.tables.filter((t) => t.name !== a.payload);
      if (s.activeTable === a.payload) s.activeTable = s.tables[0]?.name ?? null;
    },
    fileRemoved(s, a: PayloadAction<string>) {
      s.files = s.files.filter((f) => f.id !== a.payload);
      s.tables = s.tables.filter((t) => t.fileId !== a.payload);
      s.tabs = s.tabs.filter((t) => t.fileId !== a.payload);
      if (!s.tabs.find((t) => t.id === s.activeTabId)) s.activeTabId = s.tabs[0]?.id ?? null;
    },
    tabOpened(s, a: PayloadAction<{ tab: EditorTab; markdown?: string }>) {
      s.tabs.push(a.payload.tab);
      s.activeTabId = a.payload.tab.id;
      if (a.payload.markdown !== undefined) s.markdownDocs[a.payload.tab.id] = a.payload.markdown;
    },
    tabClosed(s, a: PayloadAction<string>) {
      const idx = s.tabs.findIndex((t) => t.id === a.payload);
      if (idx < 0) return;
      s.tabs.splice(idx, 1);
      delete s.markdownDocs[a.payload];
      if (s.activeTabId === a.payload) s.activeTabId = s.tabs[Math.max(0, idx - 1)]?.id ?? null;
    },
    tabActivated(s, a: PayloadAction<string>) {
      s.activeTabId = a.payload;
    },
    tabRenamed(s, a: PayloadAction<{ id: string; title: string }>) {
      const t = s.tabs.find((x) => x.id === a.payload.id);
      if (t) t.title = a.payload.title;
    },
    markdownChanged(s, a: PayloadAction<{ id: string; text: string }>) {
      s.markdownDocs[a.payload.id] = a.payload.text;
    },
    activeTableSet(s, a: PayloadAction<string | null>) {
      s.activeTable = a.payload;
    },
    flattenJsonSet(s, a: PayloadAction<boolean>) {
      s.flattenJson = a.payload;
    },
    loadingSet(s, a: PayloadAction<string | null>) {
      s.loading = a.payload;
    },
    noticeSet(s, a: PayloadAction<WorkspaceState["notice"]>) {
      s.notice = a.payload;
    },
  },
});

export const workspaceActions = slice.actions;
export default slice.reducer;

