import { useEffect, useMemo, useRef } from "react";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { gridActions } from "@/store/slices/gridSlice";
import type { CellValue, QueryResult } from "@/types";
import { cn } from "@/lib/utils";
import { ColumnMenu } from "./ColumnMenu";
import { TypePill } from "./typeMeta";
import { detectSourceTable } from "@/engine/transforms/transforms";
import { isInspectable } from "./CellInspector";

const ROW_H = 30;
const HEAD_H = 52;
const INDEX_W = 56;

const compare = (a: CellValue, b: CellValue): number => {
  if (a === b) return 0;
  if (a === null) return 1; // nulls always last
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
};

export function DataGrid({ result, tabId }: { result: QueryResult; tabId: string }) {
  const dispatch = useAppDispatch();
  const { sorting, columnVisibility, globalFilter, selectedCell } = useAppSelector((s) => s.grid);
  const tables = useAppSelector((s) => s.workspace.tables);
  const parentRef = useRef<HTMLDivElement>(null);

  const sourceTable = useMemo(
    () => detectSourceTable(result.sql, tables.map((t) => t.name)),
    [result.sql, tables],
  );
  const sourceCols = useMemo(
    () => new Set(tables.find((t) => t.name === sourceTable)?.columns.map((c) => c.name) ?? []),
    [tables, sourceTable],
  );

  const widths = useMemo(
    () =>
      result.columns.map((c, i) => {
        const sample = result.rows.slice(0, 50).reduce((m, r) => Math.max(m, String(r[i] ?? "NULL").length), 0);
        return Math.min(360, Math.max(120, Math.max(c.name.length * 8 + 84, sample * 7.4 + 24)));
      }),
    [result],
  );

  const columns = useMemo<ColumnDef<CellValue[]>[]>(
    () =>
      result.columns.map((c, i) => ({
        id: `c${i}`,
        header: c.name,
        accessorFn: (row) => row[i],
        sortingFn: (a, b, id) => compare(a.getValue(id), b.getValue(id)),
        sortUndefined: "last" as const,
        meta: { info: c, index: i },
        size: widths[i],
      })),
    [result.columns, widths],
  );

  const onSorting: OnChangeFn<SortingState> = (u) =>
    dispatch(gridActions.sortingChanged(typeof u === "function" ? u(sorting) : u));
  const onVisibility: OnChangeFn<VisibilityState> = (u) =>
    dispatch(gridActions.visibilityChanged(typeof u === "function" ? u(columnVisibility) : u));

  const table = useReactTable({
    data: result.rows,
    columns,
    state: { sorting, columnVisibility, globalFilter },
    onSortingChange: onSorting,
    onColumnVisibilityChange: onVisibility,
    globalFilterFn: (row, _id, filter: string) => {
      const f = filter.toLowerCase();
      return row.original.some((v) => v !== null && String(v).toLowerCase().includes(f));
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableSortingRemoval: true,
  });

  const rows = table.getRowModel().rows;
  const visibleCols = table.getVisibleLeafColumns();

  const rowVirt = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_H,
    overscan: 14,
  });
  const colVirt = useVirtualizer({
    horizontal: true,
    count: visibleCols.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => visibleCols[i]?.getSize() ?? 160,
    overscan: 3,
    paddingStart: INDEX_W,
  });

  useEffect(() => {
    colVirt.measure();
  }, [visibleCols.length, result, colVirt]);

  const totalW = colVirt.getTotalSize();
  const vCols = colVirt.getVirtualItems();

  if (result.columns.length === 0) {
    return <Empty>Statement executed successfully.</Empty>;
  }

  return (
    <div ref={parentRef} className="relative size-full overflow-auto" role="grid" aria-rowcount={rows.length}>
      <div style={{ width: totalW, height: rowVirt.getTotalSize() + HEAD_H }} className="relative">
        {/* Header */}
        <div className="sticky top-0 z-20 border-b bg-card" style={{ height: HEAD_H, width: totalW }}>
          <div
            className="sticky left-0 top-0 z-10 flex items-center justify-center border-r bg-card font-mono text-[10px] text-muted-foreground"
            style={{ width: INDEX_W, height: HEAD_H }}
          >
            #
          </div>
          {vCols.map((vc) => {
            const col = visibleCols[vc.index];
            if (!col) return null;
            const { info } = col.columnDef.meta as { info: QueryResult["columns"][number] };
            const sorted = col.getIsSorted();
            return (
              <div
                key={col.id}
                className="group/h absolute top-0 flex flex-col justify-center gap-1 border-r px-2.5"
                style={{ left: vc.start, width: vc.size, height: HEAD_H }}
              >
                <div className="flex items-center gap-1">
                  <button
                    onClick={col.getToggleSortingHandler()}
                    className="flex min-w-0 flex-1 items-center gap-1 text-left font-mono text-xs font-semibold"
                    title={`Sort by ${info.name}`}
                  >
                    <span className="truncate">{info.name}</span>
                    {sorted === "asc" ? (
                      <ArrowUp className="size-3 shrink-0 text-primary" />
                    ) : sorted === "desc" ? (
                      <ArrowDown className="size-3 shrink-0 text-primary" />
                    ) : (
                      <ArrowUpDown className="size-3 shrink-0 text-muted-foreground/50" />
                    )}
                  </button>
                  <ColumnMenu
                    tabId={tabId}
                    sql={result.sql}
                    column={info}
                    sourceTable={sourceTable}
                    tableHasColumn={sourceCols.has(info.name)}
                  />
                </div>
                <TypePill type={info.type} raw={info.rawType} />
              </div>
            );
          })}
        </div>

        {/* Body */}
        {rowVirt.getVirtualItems().map((vr) => {
          const row = rows[vr.index];
          const odd = vr.index % 2 === 1;
          return (
            <div
              key={row.id}
              role="row"
              className={cn("absolute left-0 border-b border-border/60 hover:bg-accent/50", odd && "bg-muted/30")}
              style={{ top: HEAD_H + vr.start, height: ROW_H, width: totalW }}
            >
              <div
                className="sticky left-0 z-10 flex items-center justify-end border-r bg-card px-2 font-mono text-[10px] text-muted-foreground"
                style={{ width: INDEX_W, height: ROW_H }}
              >
                {row.index + 1}
              </div>
              {vCols.map((vc) => {
                const col = visibleCols[vc.index];
                if (!col) return null;
                const v = row.getValue(col.id) as CellValue;
                const { info } = col.columnDef.meta as { info: QueryResult["columns"][number] };
                const selected = selectedCell?.rowIndex === row.index && selectedCell.column === info.name;
                const numeric = typeof v === "number";
                return (
                  <div
                    key={col.id}
                    role="gridcell"
                    onClick={() =>
                      dispatch(gridActions.cellSelected({ column: info.name, rowIndex: row.index, value: v }))
                    }
                    className={cn(
                      "absolute top-0 flex cursor-default items-center border-r border-border/40 px-2.5 font-mono text-xs",
                      numeric && "justify-end tabular-nums",
                      selected && "bg-primary/10 outline outline-1 -outline-offset-1 outline-primary/60",
                      isInspectable(v) && "cursor-pointer",
                    )}
                    style={{ left: vc.start, width: vc.size, height: ROW_H }}
                  >
                    {v === null ? (
                      <span className="italic text-muted-foreground/60">NULL</span>
                    ) : typeof v === "boolean" ? (
                      <span className={v ? "text-success" : "text-muted-foreground"}>{String(v)}</span>
                    ) : (
                      <span className="truncate" title={String(v).length > 40 ? String(v).slice(0, 400) : undefined}>
                        {String(v)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="absolute inset-x-0 text-center text-xs text-muted-foreground" style={{ top: HEAD_H + 40 }}>
            No rows{globalFilter ? " match your filter" : ""}.
          </div>
        )}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="flex size-full items-center justify-center p-6 text-center text-xs text-muted-foreground">{children}</div>;
}
