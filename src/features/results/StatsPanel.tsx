import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { columnStats, type ColumnStats } from "@/engine/duckdb/query";

export function StatsPanel({ sql, column }: { sql: string; column: string }) {
  const [stats, setStats] = useState<ColumnStats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setStats(null);
    setErr(null);
    columnStats(sql, column)
      .then((s) => alive && setStats(s))
      .catch((e) => alive && setErr(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, [sql, column]);

  if (err) return <p className="text-[11px] text-destructive">{err}</p>;
  if (!stats)
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Computing stats…
      </p>
    );
  const rows: [string, string][] = [
    ["Nulls", stats.nulls.toLocaleString()],
    ["Unique", stats.unique.toLocaleString()],
    ["Min", stats.min ?? "—"],
    ["Max", stats.max ?? "—"],
  ];
  return (
    <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="truncate text-right" title={v}>
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

