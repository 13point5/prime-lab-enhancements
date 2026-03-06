"use client";

import type { ChartCardGridItem } from "@/components/chart-card-grid";
import { CompareChartsView } from "@/components/compare/compare-charts-view";
import { CompareRolloutsView } from "@/components/compare/compare-rollouts-view";
import type { RunSummary } from "@/components/runs-home";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CompareVariationTwoProps = {
  runs: RunSummary[];
  selectedRuns: RunSummary[];
  selectedRunIdSet: Set<string>;
  allRunsSelected: boolean;
  runColorById: Record<string, string>;
  chartCards: ChartCardGridItem[];
  activeRolloutRunId: string | null;
  contentTab: "charts" | "rollouts";
  onContentTabChange: (value: string) => void;
  onActiveRunIdChange: (runId: string) => void;
  onToggleRun: (runId: string, checked: boolean) => void;
  onToggleAllRuns: (checked: boolean) => void;
};

export function CompareVariationTwo({
  runs,
  selectedRuns,
  selectedRunIdSet,
  allRunsSelected,
  runColorById,
  chartCards,
  activeRolloutRunId,
  contentTab,
  onContentTabChange,
  onActiveRunIdChange,
  onToggleRun,
  onToggleAllRuns,
}: CompareVariationTwoProps) {
  return (
    <Tabs
      value={contentTab}
      onValueChange={onContentTabChange}
      className="flex h-full min-h-0 w-full flex-col gap-0"
    >
      <div className="mb-2 flex h-10 items-center">
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
        className="min-h-0 w-full flex-1 overflow-hidden data-[state=inactive]:hidden"
      >
        <CompareChartsView
          runs={runs}
          selectedRuns={selectedRuns}
          selectedRunIdSet={selectedRunIdSet}
          allRunsSelected={allRunsSelected}
          runColorById={runColorById}
          chartCards={chartCards}
          onToggleRun={onToggleRun}
          onToggleAllRuns={onToggleAllRuns}
        />
      </TabsContent>

      <TabsContent
        value="rollouts"
        className="min-h-0 w-full flex-1 overflow-hidden data-[state=inactive]:hidden"
      >
        <CompareRolloutsView
          selectedRuns={selectedRuns}
          activeRunId={activeRolloutRunId}
          runColorById={runColorById}
          onActiveRunIdChange={onActiveRunIdChange}
        />
      </TabsContent>
    </Tabs>
  );
}
