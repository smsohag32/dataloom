import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { gridActions } from "@/store/slices/gridSlice";
import { copyText } from "@/lib/utils";
import type { CellValue } from "@/types";

function tryJson(v: string): unknown | undefined {
  const t = v.trim();
  if (!/^[[{]/.test(t)) return undefined;
  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
}

const looksMarkdown = (s: string) => /(^|\n)(#{1,6} |[-*] |\d+\. |> |```)|\|.*\|.*\n\s*\|?[-: ]+\|/.test(s) && s.includes("\n");

export function isInspectable(v: CellValue): boolean {
  if (typeof v !== "string") return false;
  return v.length > 60 || tryJson(v) !== undefined || looksMarkdown(v);
}

export function CellInspector() {
  const cell = useAppSelector((s) => s.grid.selectedCell);
  const dispatch = useAppDispatch();
  const [copied, setCopied] = useState(false);
  const value = cell?.value ?? null;
  const open = !!cell && isInspectable(value);

  const view = useMemo(() => {
    if (typeof value !== "string") return { kind: "text" as const, text: String(value) };
    const json = tryJson(value);
    if (json !== undefined) return { kind: "json" as const, text: JSON.stringify(json, null, 2) };
    if (looksMarkdown(value)) return { kind: "markdown" as const, text: value };
    return { kind: "text" as const, text: value };
  }, [value]);

  const copy = async () => {
    await copyText(view.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && dispatch(gridActions.cellSelected(null))}>
      <SheetContent aria-describedby={undefined}>
        <div className="flex items-center gap-2 border-b px-4 py-3 pr-12">
          <SheetTitle className="font-mono text-sm font-semibold">{cell?.column}</SheetTitle>
          <Badge variant="primary">{view.kind}</Badge>
          <SheetDescription className="text-[11px] text-muted-foreground">row {(cell?.rowIndex ?? 0) + 1}</SheetDescription>
          <Button size="sm" variant="outline" className="ml-auto" onClick={copy}>
            {copied ? <Check className="text-success" /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {view.kind === "markdown" ? (
            <div className="md-prose">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{view.text}</ReactMarkdown>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words rounded-md border bg-muted/50 p-3 font-mono text-xs leading-relaxed">
              {view.text}
            </pre>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

