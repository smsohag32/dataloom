import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastMsg {
  id: number;
  message: string;
  kind: "info" | "error";
}

let counter = 0;
const listeners = new Set<(t: ToastMsg) => void>();

export function toast(message: string, kind: ToastMsg["kind"] = "info"): void {
  const t = { id: ++counter, message, kind };
  listeners.forEach((l) => l(t));
}

export function Toaster() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  useEffect(() => {
    const l = (t: ToastMsg) => {
      setItems((x) => [...x, t]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), t.kind === "error" ? 8000 : 2800);
    };
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-10 right-4 z-[100] flex w-[min(380px,90vw)] flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-start gap-2 rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg animate-in slide-in-from-bottom-2 fade-in-0",
            t.kind === "error" && "border-destructive/40",
          )}
        >
          {t.kind === "error" ? (
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          ) : (
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
          )}
          <span className="min-w-0 flex-1 break-words">{t.message}</span>
          <button onClick={() => setItems((x) => x.filter((i) => i.id !== t.id))} className="text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

