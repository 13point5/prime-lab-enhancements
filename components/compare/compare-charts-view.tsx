"use client";

import type { ChartCardGridItem } from "@/components/chart-card-grid";
import { CompareChartsContent } from "@/components/compare/compare-charts-content";
import { CompareRunsTable } from "@/components/compare/compare-runs-table";
import type { RunSummary } from "@/components/runs-home";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

type CompareChartsViewProps = {
  runs: RunSummary[];
  selectedRuns: RunSummary[];
  selectedRunIdSet: Set<string>;
  allRunsSelected: boolean;
  runColorById: Record<string, string>;
  chartCards: ChartCardGridItem[];
  onToggleRun: (runId: string, checked: boolean) => void;
  onToggleAllRuns: (checked: boolean) => void;
};

export function CompareChartsView({
  runs,
  selectedRuns,
  selectedRunIdSet,
  allRunsSelected,
  runColorById,
  chartCards,
  onToggleRun,
  onToggleAllRuns,
}: CompareChartsViewProps) {
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
        <CompareChartsContent selectedRuns={selectedRuns} chartCards={chartCards} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
