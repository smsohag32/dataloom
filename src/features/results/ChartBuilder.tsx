import { useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import { BarChart3, LineChart as LineIcon, AreaChart as AreaIcon, PieChart as PieIcon, ScatterChart as ScatterIcon } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import type { ColumnInfo, QueryResult } from "@/types";
import { cn } from "@/lib/utils";
import { Empty } from "./DataGrid";

type ChartKind = "bar" | "line" | "area" | "pie" | "scatter";

const KINDS: { id: ChartKind; label: string; icon: typeof BarChart3 }[] = [
  { id: "bar", label: "Bar", icon: BarChart3 },
  { id: "line", label: "Line", icon: LineIcon },
  { id: "area", label: "Area", icon: AreaIcon },
  { id: "pie", label: "Pie", icon: PieIcon },
  { id: "scatter", label: "Scatter", icon: ScatterIcon },
];

const PALETTE = {
  light: ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#64748b", "#84cc16", "#06b6d4"],
  dark: ["#8ea2ff", "#38bdf8", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#f472b6", "#2dd4bf", "#fb923c", "#94a3b8", "#a3e635", "#22d3ee"],
};

const isNum = (c: ColumnInfo) => c.type === "integer" || c.type === "double";

/** Pick sensible default axes: X = date or low-cardinality category, Y = first numeric. */
export function suggestAxes(result: QueryResult): { x: number; y: number } {
  const cols = result.columns;
  const sample = result.rows.slice(0, 2000);
  const card = (i: number) => new Set(sample.map((r) => r[i])).size;
  let x = cols.findIndex((c) => c.type === "timestamp");
  if (x < 0) x = cols.findIndex((c, i) => (c.type === "varchar" || c.type === "boolean") && card(i) <= Math.max(30, sample.length / 3));
  if (x < 0) x = cols.findIndex((c, i) => c.type === "varchar" && i >= 0);
  if (x < 0) x = 0;
  let y = cols.findIndex((c, i) => isNum(c) && i !== x);
  if (y < 0) y = cols.findIndex((_, i) => i !== x);
  return { x, y: y < 0 ? 0 : y };
}

export function ChartBuilder({ result }: { result: QueryResult }) {
  const theme = useAppSelector((s) => s.ui.resolvedTheme);
  const pal = PALETTE[theme];
  const suggested = useMemo(() => suggestAxes(result), [result]);
  const [kind, setKind] = useState<ChartKind>("bar");
  const [xSel, setX] = useState<number | null>(null);
  const [ySel, setY] = useState<number | null>(null);
  const x = xSel !== null && xSel < result.columns.length ? xSel : suggested.x;
  const y = ySel !== null && ySel < result.columns.length ? ySel : suggested.y;
  const xCol = result.columns[x];
  const yCol = result.columns[y];

  const data = useMemo(() => {
    if (!xCol || !yCol) return [];
    const rows = result.rows;
    const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
    if (kind === "scatter") {
      const step = Math.max(1, Math.floor(rows.length / 2000));
      return rows
        .filter((_, i) => i % step === 0)
        .map((r, i) => ({ x: isNum(xCol) ? num(r[x]) : i, y: num(r[y]), label: String(r[x]) }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    }
    if (kind === "bar" || kind === "pie") {
      const agg = new Map<string, number>();
      for (const r of rows) {
        const k = r[x] === null ? "NULL" : String(r[x]);
        const v = isNum(yCol) ? num(r[y]) : 1;
        agg.set(k, (agg.get(k) ?? 0) + (Number.isFinite(v) ? v : 0));
      }
      let list = [...agg.entries()].map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
      if (xCol.type === "timestamp") list.sort((a, b) => a.name.localeCompare(b.name));
      else list.sort((a, b) => b.value - a.value);
      const max = kind === "pie" ? 12 : 40;
      if (list.length > max) {
        const rest = list.slice(max - 1).reduce((s, d) => s + d.value, 0);
        list = [...list.slice(0, max - 1), { name: "Other", value: Math.round(rest * 100) / 100 }];
      }
      return list;
    }
    const step = Math.max(1, Math.floor(rows.length / 1000));
    return rows
      .filter((_, i) => i % step === 0)
      .map((r) => ({ name: r[x] === null ? "NULL" : String(r[x]), value: num(r[y]) }))
      .filter((d) => Number.isFinite(d.value));
  }, [result, kind, x, y, xCol, yCol]);

  if (result.columns.length < 1 || result.rows.length === 0) return <Empty>Run a query to build a chart.</Empty>;

  const axis = { stroke: "hsl(var(--muted-foreground))", fontSize: 11, tickLine: false, axisLine: false } as const;
  const tooltipStyle = {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
    color: "hsl(var(--popover-foreground))",
  };
  const tickFmt = (v: string) => (String(v).length > 12 ? `${String(v).slice(0, 11)}…` : v);

  const select = (label: string, value: number, onChange: (n: number) => void, pie: boolean) => (
    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      {pie ? (label === "X" ? "Label" : "Value") : label}
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-7 max-w-[180px] rounded-md border bg-background px-1.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
      >
        {result.columns.map((c, i) => (
          <option key={i} value={i}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex size-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b px-3 py-1.5">
        <div className="flex gap-0.5">
          {KINDS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setKind(id)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground",
                kind === id && "bg-accent text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        {select("X", x, setX, kind === "pie")}
        {select("Y", y, setY, kind === "pie")}
        {x === suggested.x && y === suggested.y && xSel === null && ySel === null && (
          <span className="text-[10px] text-muted-foreground">auto-suggested axes</span>
        )}
      </div>
      <div className="min-h-0 flex-1 p-3">
        <ResponsiveContainer width="100%" height="100%">
          {kind === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" {...axis} tickFormatter={tickFmt} interval="preserveStartEnd" />
              <YAxis {...axis} width={56} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--accent))" }} />
              <Bar dataKey="value" name={yCol.name} fill={pal[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : kind === "line" ? (
            <LineChart data={data}>
              <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" {...axis} tickFormatter={tickFmt} interval="preserveStartEnd" minTickGap={40} />
              <YAxis {...axis} width={56} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line dataKey="value" name={yCol.name} stroke={pal[0]} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          ) : kind === "area" ? (
            <AreaChart data={data}>
              <defs>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={pal[0]} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={pal[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" {...axis} tickFormatter={tickFmt} interval="preserveStartEnd" minTickGap={40} />
              <YAxis {...axis} width={56} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area dataKey="value" name={yCol.name} stroke={pal[0]} strokeWidth={2} fill="url(#areaFill)" isAnimationActive={false} />
            </AreaChart>
          ) : kind === "pie" ? (
            <PieChart>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Pie data={data} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="80%" paddingAngle={2} stroke="hsl(var(--background))">
                {data.map((_, i) => (
                  <Cell key={i} fill={pal[i % pal.length]} />
                ))}
              </Pie>
            </PieChart>
          ) : (
            <ScatterChart>
              <CartesianGrid stroke="hsl(var(--border))" />
              <XAxis dataKey="x" type="number" name={xCol.name} {...axis} />
              <YAxis dataKey="y" type="number" name={yCol.name} {...axis} width={56} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
              <Scatter data={data} fill={pal[0]} fillOpacity={0.6} isAnimationActive={false} />
            </ScatterChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
