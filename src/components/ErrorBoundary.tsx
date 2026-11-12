import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { initEngine } from "@/store/thunks";

interface BoundaryProps {
  children: ReactNode;
  label?: string;
  /** Change this value to reset the boundary. */
  resetKey?: string | null;
}

/** Catches render errors so one broken panel never takes down the whole IDE shell. */
export class ErrorBoundary extends Component<BoundaryProps, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[DataLoom] render error", error, info.componentStack);
  }
  componentDidUpdate(prev: BoundaryProps) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertTriangle className="size-7 text-destructive" />
        <p className="text-sm font-medium">{this.props.label ?? "Something went wrong"}</p>
        <pre className="max-w-xl whitespace-pre-wrap font-mono text-xs text-muted-foreground">{this.state.error.message}</pre>
        <Button size="sm" variant="outline" onClick={() => this.setState({ error: null })}>
          <RotateCw /> Try again
        </Button>
      </div>
    );
  }
}

/** Blocks the workbench until DuckDB-Wasm's worker is up; shows loading / failure states. */
export function EngineGate({ children }: { children: ReactNode }) {
  const engine = useAppSelector((s) => s.workspace.engine);
  const dispatch = useAppDispatch();

  if (engine.status === "ready") return <>{children}</>;
  return (
    <div className="flex size-full items-center justify-center">
      {engine.status === "loading" ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <img
            src="/logo.svg"
            alt="DataLoom"
            className="size-14 animate-pulse object-contain drop-shadow-[0_8px_20px_rgba(99,102,241,0.4)]"
          />
          <p className="flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin text-primary" /> Starting DuckDB engine in a Web Worker…
          </p>
          <p className="text-xs text-muted-foreground">Everything runs locally in your browser.</p>
        </div>
      ) : (
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          <AlertTriangle className="size-8 text-destructive" />
          <p className="text-sm font-medium">The SQL engine failed to start</p>
          <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground">{engine.error}</pre>
          <p className="text-xs text-muted-foreground">DuckDB-Wasm needs WebAssembly and Web Workers — try a current Chrome, Edge, Firefox or Safari.</p>
          <Button size="sm" onClick={() => void dispatch(initEngine())}>
            <RotateCw /> Retry
          </Button>
        </div>
      )}
    </div>
  );
}

