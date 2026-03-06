"use client";

import type { ChartCardGridItem } from "@/components/chart-card-grid";
import { CompareChartsContent } from "@/components/compare/compare-charts-content";
import { CompareRolloutsContent } from "@/components/compare/compare-rollouts-content";
import { CompareRunsTable } from "@/components/compare/compare-runs-table";
import type { RunSummary } from "@/components/runs-home";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CompareVariationOneProps = {
  runs: RunSummary[];
  selectedRuns: RunSummary[];
  selectedRunIdSet: Set<string>;
  allRunsSelected: boolean;
  runColorById: Record<string, string>;
  chartCards: ChartCardGridItem[];
  activeRolloutRunId: string | null;
  rightPaneTab: "charts" | "rollouts";
  onRightPaneTabChange: (value: string) => void;
  onActiveRunIdChange: (runId: string) => void;
  onToggleRun: (runId: string, checked: boolean) => void;
  onToggleAllRuns: (checked: boolean) => void;
};

export function CompareVariationOne({
  runs,
  selectedRuns,
  selectedRunIdSet,
  allRunsSelected,
  runColorById,
  chartCards,
  activeRolloutRunId,
  rightPaneTab,
  onRightPaneTabChange,
  onActiveRunIdChange,
  onToggleRun,
  onToggleAllRuns,
}: CompareVariationOneProps) {
  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="h-full min-h-0 w-full overflow-hidden rounded-xl border border-zinc-900 bg-[#060606]"
    >
      <ResizablePanel defaultSize="38%" minSize="420px" maxSize="62%">
        <CompareRunsTable
          runs={runs}
          runColorById={runColorById}
          selectedRunIdSet={selectedRunIdSet}
          allRunsSelected={allRunsSelected}
          onToggleRun={onToggleRun}
          onToggleAllRuns={onToggleAllRuns}
        />
      </ResizablePanel>

      <ResizableHandle withHandle className="bg-zinc-900" tabIndex={-1} />

      <ResizablePanel defaultSize="62%" minSize="520px">
        <Tabs
          value={rightPaneTab}
          onValueChange={onRightPaneTabChange}
          className="flex h-full min-h-0 flex-col"
        >
          <div className="flex h-11 items-center border-b border-zinc-900 px-4">
            <TabsList className="bg-zinc-900/80 p-1">
              <TabsTrigger value="charts" className="px-3 text-xs font-semibold">
                Charts
              </TabsTrigger>
              <TabsTrigger value="rollouts" className="px-3 text-xs font-semibold">
                Rollouts
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="charts"
            className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
          >
            <CompareChartsContent selectedRuns={selectedRuns} chartCards={chartCards} />
          </TabsContent>

          <TabsContent
            value="rollouts"
            className="min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
          >
            <div className="h-full p-4">
              <CompareRolloutsContent
                selectedRuns={selectedRuns}
                activeRunId={activeRolloutRunId}
                runColorById={runColorById}
                onActiveRunIdChange={onActiveRunIdChange}
              />
            </div>
          </TabsContent>
        </Tabs>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
