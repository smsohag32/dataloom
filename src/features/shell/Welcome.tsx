import { FileJson, FileSpreadsheet, FileText, Lock, Zap, Database } from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { loadBigSample, loadSample, openSqlTab } from "@/store/thunks";
import { SAMPLES } from "@/samples";
import { Button } from "@/components/ui/button";

const ICONS = { orders: FileSpreadsheet, webhooks: FileJson, benchmarks: FileText } as const;

export function Welcome() {
  const dispatch = useAppDispatch();
  return (
    <div className="flex size-full items-center justify-center overflow-auto p-8">
      <div className="w-full max-w-2xl">
        <div className="mb-5 flex items-center">
          <img
            src="/logo.svg"
            alt="DataLoom"
            className="size-16 object-contain drop-shadow-[0_8px_24px_rgba(99,102,241,0.4)] transition-transform hover:scale-105"
          />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Query anything. Upload nothing.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Drop CSV, TSV, JSON, JSONL, SQLite or Markdown files anywhere. DuckDB runs in a Web Worker inside this tab — your data
          never leaves your machine.
        </p>

        <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
          {SAMPLES.map((s) => {
            const Icon = ICONS[s.id as keyof typeof ICONS];
            return (
              <button
                key={s.id}
                onClick={() => void dispatch(loadSample(s.id))}
                className="group flex flex-col items-start gap-2 rounded-xl border bg-card p-3.5 text-left transition-all hover:-translate-y-px hover:border-primary/50 hover:shadow-md"
              >
                <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                  <Icon className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{s.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void dispatch(openSqlTab("SELECT 42 AS answer;", "Scratch"))}>
            <Database /> Blank query
          </Button>
          <Button variant="outline" size="sm" onClick={() => void dispatch(loadBigSample())}>
            <Zap /> Generate 100k-row stress table
          </Button>
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="size-3" /> Works offline after first load
          </span>
        </div>
      </div>
    </div>
  );
}

