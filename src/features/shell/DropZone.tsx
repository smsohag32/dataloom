import { useEffect } from "react";
import { UploadCloud, Loader2 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { uiActions } from "@/store/slices/uiSlice";
import { loadFiles } from "@/store/thunks";

/** Window-level drag & drop: drop multiple files anywhere on the workspace. */
export function DropZone() {
  const dispatch = useAppDispatch();
  const dragging = useAppSelector((s) => s.ui.dragging);
  const loading = useAppSelector((s) => s.workspace.loading);

  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      dispatch(uiActions.draggingSet(true));
    };
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) dispatch(uiActions.draggingSet(false));
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      dispatch(uiActions.draggingSet(false));
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) void dispatch(loadFiles(files));
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [dispatch]);

  return (
    <>
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-card px-16 py-12 shadow-2xl">
            <UploadCloud className="size-10 text-primary" />
            <p className="text-sm font-medium">Drop files to load them locally</p>
            <p className="text-xs text-muted-foreground">csv · tsv · json · jsonl · sqlite · md — nothing is uploaded</p>
          </div>
        </div>
      )}
      {loading && (
        <div className="fixed bottom-10 left-1/2 z-[95] flex -translate-x-1/2 items-center gap-2 rounded-full border bg-popover px-4 py-2 text-xs shadow-lg">
          <Loader2 className="size-3.5 animate-spin text-primary" />
          {loading}
        </div>
      )}
    </>
  );
}

