import { useEffect, useRef } from "react";
import { Panel, PanelGroup, type ImperativePanelHandle } from "react-resizable-panels";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EngineGate, ErrorBoundary } from "@/components/ErrorBoundary";
import { CommandPalette } from "@/features/command-palette/CommandPalette";
import { Header } from "@/features/shell/Header";
import { Sidebar } from "@/features/shell/Sidebar";
import { Workbench } from "@/features/shell/Workbench";
import { DropZone } from "@/features/shell/DropZone";
import { ResizeHandle } from "@/features/shell/ResizeHandle";
import { useThemeSync } from "@/features/theme/Theme";
import { Toaster, toast } from "@/lib/toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { uiActions } from "@/store/slices/uiSlice";
import { workspaceActions } from "@/store/slices/workspaceSlice";
import { initEngine } from "@/store/thunks";

export default function App() {
  useThemeSync();
  const dispatch = useAppDispatch();
  const collapsed = useAppSelector((s) => s.ui.sidebarCollapsed);
  const notice = useAppSelector((s) => s.workspace.notice);
  const sidebar = useRef<ImperativePanelHandle>(null);

  useEffect(() => {
    void dispatch(initEngine());
  }, [dispatch]);

  useEffect(() => {
    if (!notice) return;
    toast(notice.message, notice.kind);
    dispatch(workspaceActions.noticeSet(null));
  }, [notice, dispatch]);

  useEffect(() => {
    const p = sidebar.current;
    if (!p) return;
    if (collapsed && !p.isCollapsed()) p.collapse();
    if (!collapsed && p.isCollapsed()) p.expand();
  }, [collapsed]);

  return (
    <TooltipProvider>
      <div className="flex h-screen w-screen flex-col overflow-hidden">
        <Header />
        <div className="min-h-0 flex-1">
          <EngineGate>
            <PanelGroup direction="horizontal" autoSaveId="dataloom-shell">
              <Panel
                ref={sidebar}
                id="sidebar"
                order={1}
                collapsible
                collapsedSize={0}
                defaultSize={18}
                minSize={14}
                maxSize={36}
                onCollapse={() => !collapsed && dispatch(uiActions.sidebarSet(true))}
                onExpand={() => collapsed && dispatch(uiActions.sidebarSet(false))}
                className="min-w-0"
                style={{ minWidth: collapsed ? 0 : 220 }}
              >
                <ErrorBoundary label="Sidebar crashed">
                  <Sidebar />
                </ErrorBoundary>
              </Panel>
              <ResizeHandle />
              <Panel id="main" order={2} minSize={40}>
                <Workbench />
              </Panel>
            </PanelGroup>
          </EngineGate>
        </div>
      </div>
      <CommandPalette />
      <DropZone />
      <Toaster />
    </TooltipProvider>
  );
}

