import { useCallback, useEffect, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { Play, WandSparkles, Bookmark, ListTree } from "lucide-react";
import { toast } from "@/lib/toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { queryActions } from "@/store/slices/querySlice";
import { uiActions } from "@/store/slices/uiSlice";
import { runTab } from "@/store/thunks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { defineThemes, formatSql, monaco, registerSqlCompletion } from "./monacoSetup";
import { modKey, uid } from "@/lib/utils";

export const EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  fontFamily: '"JetBrains Mono Variable", "JetBrains Mono", "Fira Code", monospace',
  fontSize: 13,
  fontLigatures: true,
  lineHeight: 21,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  padding: { top: 10, bottom: 10 },
  renderLineHighlight: "line",
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  automaticLayout: true,
  smoothScrolling: true,
  scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
  fixedOverflowWidgets: true,
  tabSize: 2,
  suggest: { showWords: false },
};

let themesDefined = false;
export function ensureMonaco() {
  if (!themesDefined) {
    defineThemes();
    registerSqlCompletion();
    themesDefined = true;
  }
}

export function SqlEditor({ tabId }: { tabId: string }) {
  const dispatch = useAppDispatch();
  const sql = useAppSelector((s) => s.query.sqlByTab[tabId] ?? "");
  const status = useAppSelector((s) => s.query.metaByTab[tabId]?.status ?? "idle");
  const resolved = useAppSelector((s) => s.ui.resolvedTheme);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const tabRef = useRef(tabId);
  tabRef.current = tabId;

  const run = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const sel = ed.getSelection();
    const selected = sel && !sel.isEmpty() ? ed.getModel()?.getValueInRange(sel) : undefined;
    void dispatch(runTab(tabRef.current, selected?.trim() ? selected : undefined));
  }, [dispatch]);

  const format = useCallback(() => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    if (!ed || !model) return;
    const sel = ed.getSelection();
    if (sel && !sel.isEmpty()) {
      ed.executeEdits("format", [{ range: sel, text: formatSql(model.getValueInRange(sel)) }]);
    } else {
      ed.executeEdits("format", [{ range: model.getFullModelRange(), text: formatSql(model.getValue()) }]);
    }
    ed.pushUndoStop();
  }, []);

  const onMount: OnMount = (editor) => {
    editorRef.current = editor;
    const { KeyMod, KeyCode } = monaco;
    editor.addCommand(KeyMod.CtrlCmd | KeyCode.Enter, run);
    editor.addCommand(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyF, format);
    // Monaco swallows Ctrl/Cmd+K as a chord prefix – route it to the palette instead.
    editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyK, () => dispatch(uiActions.paletteSet(true)));
    editor.focus();
  };

  // Palette → editor bridge.
  useEffect(() => {
    const onFormat = () => format();
    const onRun = () => run();
    window.addEventListener("dataloom:format-sql", onFormat);
    window.addEventListener("dataloom:run-sql", onRun);
    return () => {
      window.removeEventListener("dataloom:format-sql", onFormat);
      window.removeEventListener("dataloom:run-sql", onRun);
    };
  }, [format, run]);

  const saveSnippet = () => {
    if (!sql.trim()) return;
    const name = sql.trim().split("\n")[0].slice(0, 40);
    dispatch(queryActions.snippetSaved({ id: uid("snip"), name, sql }));
    toast("Snippet saved");
  };

  const explain = () => void dispatch(runTab(tabId, `EXPLAIN ${sql.trim().replace(/;+\s*$/, "")}`));

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center gap-1.5 border-b px-2">
        <Button size="sm" onClick={run} disabled={status === "running"}>
          <Play className="fill-current" />
          Run
          <Badge className="border-white/20 bg-white/15 text-primary-foreground">{modKey}↵</Badge>
        </Button>
        <Button size="sm" variant="ghost" onClick={explain}>
          <ListTree />
          Explain
        </Button>
        <Button size="sm" variant="ghost" onClick={format}>
          <WandSparkles />
          Format
          <Badge variant="outline">{modKey}⇧F</Badge>
        </Button>
        <Button size="sm" variant="ghost" onClick={saveSnippet}>
          <Bookmark />
          Save
        </Button>
        <span className="ml-auto text-[11px] text-muted-foreground">Runs the selection, or the full query</span>
      </div>
      <div className="min-h-0 flex-1">
        <Editor
          path={`inmemory://dataloom/${tabId}.sql`}
          language="sql"
          theme={resolved === "dark" ? "dataloom-dark" : "dataloom-light"}
          value={sql}
          onChange={(v) => dispatch(queryActions.sqlChanged({ tabId, sql: v ?? "" }))}
          beforeMount={ensureMonaco}
          onMount={onMount}
          options={EDITOR_OPTIONS}
          loading={<div className="p-4 text-xs text-muted-foreground">Loading editor…</div>}
        />
      </div>
    </div>
  );
}

