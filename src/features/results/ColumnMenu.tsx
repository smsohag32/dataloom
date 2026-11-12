import { useState } from "react";
import { Scissors, Trash2, CaseUpper, CaseLower, CaseSensitive, Pencil, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useAppDispatch } from "@/store/hooks";
import { applyTransform } from "@/store/thunks";
import type { ColumnInfo } from "@/types";
import { StatsPanel } from "./StatsPanel";
import { TypePill } from "./typeMeta";

interface Props {
  tabId: string;
  sql: string;
  column: ColumnInfo;
  /** Table that the current query reads from (enables quick transforms). */
  sourceTable: string | null;
  tableHasColumn: boolean;
}

/** Column header popover: quick stats + column-level no-code transforms. */
export function ColumnMenu({ tabId, sql, column, sourceTable, tableHasColumn }: Props) {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(column.name);
  const canTransform = !!sourceTable && tableHasColumn;
  const run = (spec: Parameters<typeof applyTransform>[0]) => {
    setOpen(false);
    void dispatch(applyTransform(spec, tabId));
  };

  return (
    <Popover open={open} onOpenChange={(o) => (setOpen(o), o && setNewName(column.name))}>
      <PopoverTrigger asChild>
        <button
          aria-label={`Column ${column.name} insights`}
          className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover/h:opacity-100 data-[state=open]:opacity-100"
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-xs font-semibold">{column.name}</span>
          <TypePill type={column.type} raw={column.rawType} />
        </div>
        {open && <StatsPanel sql={sql} column={column.name} />}
        <div className="border-t pt-2">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Quick transforms</p>
          {!canTransform ? (
            <p className="text-[11px] text-muted-foreground">
              Query a single table (or use “Save as table”) to clean columns.
            </p>
          ) : renaming ? (
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                if (newName.trim() && newName !== column.name) run({ kind: "rename", table: sourceTable!, column: column.name, to: newName.trim() });
              }}
            >
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-7 min-w-0 flex-1 rounded-md border bg-background px-2 font-mono text-xs outline-none focus:ring-1 focus:ring-ring"
              />
              <Button size="sm" type="submit">
                Rename
              </Button>
            </form>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              <Button size="sm" variant="secondary" onClick={() => setRenaming(true)}>
                <Pencil /> Rename
              </Button>
              <Button size="sm" variant="secondary" onClick={() => run({ kind: "drop", table: sourceTable!, column: column.name })}>
                <Trash2 /> Drop
              </Button>
              {column.type === "varchar" && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => run({ kind: "trim", table: sourceTable!, column: column.name })}>
                    <Scissors /> Trim
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => run({ kind: "case", table: sourceTable!, column: column.name, mode: "upper" })}>
                    <CaseUpper /> UPPER
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => run({ kind: "case", table: sourceTable!, column: column.name, mode: "lower" })}>
                    <CaseLower /> lower
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => run({ kind: "case", table: sourceTable!, column: column.name, mode: "title" })}>
                    <CaseSensitive /> Title
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

