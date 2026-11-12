import { useEffect } from "react";
import {
  Braces, Database, Download, FileCode2, FileJson, FileSpreadsheet, FileText, Monitor, Moon, PanelLeft, Play, Plus, Sun, Table2, WandSparkles, Zap,
} from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { uiActions } from "@/store/slices/uiSlice";
import { gridActions } from "@/store/slices/gridSlice";
import { loadBigSample, loadSample, openSqlTab, openTableQuery } from "@/store/thunks";
import { SAMPLES } from "@/samples";
import { useResult } from "@/engine/resultStore";
import { useExporter, type ExportFormat } from "@/features/results/ExportPanel";
import { modKey } from "@/lib/utils";

/** Global ⌘/Ctrl+K handler + command palette. */
export function CommandPalette() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.ui.commandPaletteOpen);
  const tables = useAppSelector((s) => s.workspace.tables);
  const activeTabId = useAppSelector((s) => s.workspace.activeTabId);
  const activeKind = useAppSelector((s) => s.workspace.tabs.find((t) => t.id === s.workspace.activeTabId)?.kind);
  const result = useResult(activeTabId);
  const ex = useExporter(result);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        dispatch(uiActions.paletteSet(true));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  const close = () => dispatch(uiActions.paletteSet(false));
  const run = (fn: () => void) => () => {
    close();
    // Let the dialog unmount (and give focus back to the editor) before acting.
    setTimeout(fn, 30);
  };
  const exportAs = (f: ExportFormat, mode: "download" | "copy") => () => {
    if (!ex) return;
    if (mode === "download") ex.download(f);
    else void ex.copy(f);
  };
  const exports: { f: ExportFormat; label: string; icon: typeof Download }[] = [
    { f: "md", label: "Markdown table", icon: FileText },
    { f: "csv", label: "CSV", icon: FileSpreadsheet },
    { f: "json", label: "JSON", icon: FileJson },
    { f: "sql", label: "SQL INSERT statements", icon: FileCode2 },
  ];

  return (
    <CommandDialog open={open} onOpenChange={(o) => dispatch(uiActions.paletteSet(o))}>
      <CommandInput placeholder="Type a command or search tables…" autoFocus />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem onSelect={run(() => void dispatch(openSqlTab()))}>
            <Plus /> New query tab
          </CommandItem>
          {activeKind === "sql" && (
            <>
              <CommandItem onSelect={run(() => window.dispatchEvent(new Event("dataloom:run-sql")))}>
                <Play /> Run query <CommandShortcut>{modKey} ↵</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={run(() => window.dispatchEvent(new Event("dataloom:format-sql")))}>
                <WandSparkles /> Format SQL <CommandShortcut>{modKey} ⇧ F</CommandShortcut>
              </CommandItem>
            </>
          )}
          <CommandItem onSelect={run(() => dispatch(uiActions.sidebarToggled()))}>
            <PanelLeft /> Toggle sidebar
          </CommandItem>
        </CommandGroup>

        {tables.length > 0 && (
          <CommandGroup heading="Switch table">
            {tables.map((t) => (
              <CommandItem key={t.name} value={`table ${t.name}`} onSelect={run(() => void dispatch(openTableQuery(t.name)))}>
                <Table2 /> <span className="font-mono">{t.name}</span>
                <CommandShortcut>{t.rowCount.toLocaleString()} rows · {t.columns.length} cols</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Theme">
          <CommandItem onSelect={run(() => dispatch(uiActions.themeSet("light")))}><Sun /> Light theme</CommandItem>
          <CommandItem onSelect={run(() => dispatch(uiActions.themeSet("dark")))}><Moon /> Dark theme</CommandItem>
          <CommandItem onSelect={run(() => dispatch(uiActions.themeSet("system")))}><Monitor /> System theme</CommandItem>
        </CommandGroup>

        {ex && result && (
          <CommandGroup heading="Export current result">
            {exports.map(({ f, label, icon: Icon }) => (
              <CommandItem key={`d${f}`} value={`export download ${label}`} onSelect={run(exportAs(f, "download"))}>
                <Icon /> Download {label}
              </CommandItem>
            ))}
            <CommandItem value="export copy markdown clipboard" onSelect={run(exportAs("md", "copy"))}>
              <FileText /> Copy as Markdown table
            </CommandItem>
            <CommandItem value="view chart" onSelect={run(() => dispatch(gridActions.outputViewChanged("chart")))}>
              <Braces /> Show chart view
            </CommandItem>
          </CommandGroup>
        )}

        <CommandGroup heading="Sample datasets">
          {SAMPLES.map((s) => (
            <CommandItem key={s.id} value={`sample ${s.title}`} onSelect={run(() => void dispatch(loadSample(s.id)))}>
              <Database /> Load “{s.title}”
            </CommandItem>
          ))}
          <CommandItem value="sample 100k stress benchmark" onSelect={run(() => void dispatch(loadBigSample()))}>
            <Zap /> Generate 100k-row stress table
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
