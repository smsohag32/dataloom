import { lazy, Suspense } from "react";
import { Panel, PanelGroup } from "react-resizable-panels";
import { useAppSelector } from "@/store/hooks";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ResizeHandle } from "./ResizeHandle";
import { TabBar } from "./TabBar";
import { Welcome } from "./Welcome";
import { ResultsPanel } from "@/features/results/ResultsPanel";

// Monaco is heavy: load it lazily so the shell paints first.
const SqlEditor = lazy(() => import("@/features/editor/SqlEditor").then((m) => ({ default: m.SqlEditor })));
const MarkdownWorkspace = lazy(() =>
  import("@/features/editor/MarkdownWorkspace").then((m) => ({ default: m.MarkdownWorkspace })),
);

const Loading = () => <div className="p-4 text-xs text-muted-foreground">Loading editor…</div>;

export function Workbench() {
  const tab = useAppSelector((s) => s.workspace.tabs.find((t) => t.id === s.workspace.activeTabId));
  const hasTabs = useAppSelector((s) => s.workspace.tabs.length > 0);

  return (
    <div className="flex size-full min-w-0 flex-col">
      <TabBar />
      <div className="min-h-0 flex-1">
        {!hasTabs || !tab ? (
          <Welcome />
        ) : tab.kind === "markdown" ? (
          <ErrorBoundary resetKey={tab.id} label="The markdown view crashed">
            <Suspense fallback={<Loading />}>
              <MarkdownWorkspace key={tab.id} tabId={tab.id} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <PanelGroup direction="vertical" autoSaveId="dataloom-workbench">
            <Panel defaultSize={42} minSize={15} order={1}>
              <ErrorBoundary resetKey={tab.id} label="The editor crashed">
                <Suspense fallback={<Loading />}>
                  <SqlEditor tabId={tab.id} />
                </Suspense>
              </ErrorBoundary>
            </Panel>
            <ResizeHandle direction="vertical" />
            <Panel defaultSize={58} minSize={20} order={2}>
              <ErrorBoundary resetKey={tab.id} label="The results view crashed">
                <ResultsPanel tabId={tab.id} />
              </ErrorBoundary>
            </Panel>
          </PanelGroup>
        )}
      </div>
    </div>
  );
}

