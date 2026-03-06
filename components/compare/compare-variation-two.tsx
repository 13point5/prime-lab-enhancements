"use client";

import { X } from "lucide-react";

import type { ChartCardGridItem } from "@/components/chart-card-grid";
import { CompareChartsView } from "@/components/compare/compare-charts-view";
import { CompareRolloutsView } from "@/components/compare/compare-rollouts-view";
import type { RunSummary } from "@/components/runs-home";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type CompareStepTab = {
  id: string;
  requestedStep: number;
  title: string;
};

type CompareVariationTwoProps = {
  runs: RunSummary[];
  selectedRuns: RunSummary[];
  selectedRunIdSet: Set<string>;
  allRunsSelected: boolean;
  runColorById: Record<string, string>;
  chartCards: ChartCardGridItem[];
  activeRolloutRunId: string | null;
  activeTab: string;
  stepTabs: CompareStepTab[];
  onActiveTabChange: (value: string) => void;
  onCloseStepTab: (tabId: string) => void;
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
  activeTab,
  stepTabs,
  onActiveTabChange,
  onCloseStepTab,
  onActiveRunIdChange,
  onToggleRun,
  onToggleAllRuns,
}: CompareVariationTwoProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={onActiveTabChange}
      className="flex h-full min-h-0 w-full flex-col gap-0"
    >
      <div className="mb-2 flex h-10 items-center gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => onActiveTabChange("charts")}
          className={cn(
            "inline-flex h-8 items-center rounded-lg border px-3 text-xs font-semibold transition-colors",
            activeTab === "charts"
              ? "border-zinc-700 bg-zinc-900 text-zinc-100"
              : "border-zinc-800 bg-black text-zinc-400 hover:border-zinc-700 hover:text-zinc-200",
          )}
        >
          Charts
        </button>
        <button
          type="button"
          onClick={() => onActiveTabChange("rollouts")}
          className={cn(
            "inline-flex h-8 items-center rounded-lg border px-3 text-xs font-semibold transition-colors",
            activeTab === "rollouts"
              ? "border-zinc-700 bg-zinc-900 text-zinc-100"
              : "border-zinc-800 bg-black text-zinc-400 hover:border-zinc-700 hover:text-zinc-200",
          )}
        >
          Rollouts
        </button>
        {stepTabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              "inline-flex h-8 items-center overflow-hidden rounded-lg border",
              activeTab === tab.id
                ? "border-zinc-700 bg-zinc-900 text-zinc-100"
                : "border-zinc-800 bg-black text-zinc-400",
            )}
          >
            <button
              type="button"
              onClick={() => onActiveTabChange(tab.id)}
              className={cn(
                "h-full px-3 text-xs font-semibold transition-colors",
                activeTab === tab.id ? "text-zinc-100" : "hover:text-zinc-200",
              )}
            >
              {tab.title}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onCloseStepTab(tab.id);
              }}
              className="flex h-full w-8 items-center justify-center border-l border-zinc-800 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              aria-label={`Close ${tab.title}`}
              title={`Close ${tab.title}`}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      <TabsContent
        value="charts"
        forceMount
        className={cn("min-h-0 w-full flex-1 overflow-hidden", activeTab !== "charts" && "hidden")}
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
        forceMount
        className={cn("min-h-0 w-full flex-1 overflow-hidden", activeTab !== "rollouts" && "hidden")}
      >
        <CompareRolloutsView
          selectedRuns={selectedRuns}
          activeRunId={activeRolloutRunId}
          runColorById={runColorById}
          onActiveRunIdChange={onActiveRunIdChange}
        />
      </TabsContent>

      {stepTabs.map((tab) => (
        <TabsContent
          key={tab.id}
          value={tab.id}
          forceMount
          className={cn("min-h-0 w-full flex-1 overflow-hidden", activeTab !== tab.id && "hidden")}
        >
          <CompareRolloutsView
            selectedRuns={selectedRuns}
            activeRunId={activeRolloutRunId}
            runColorById={runColorById}
            onActiveRunIdChange={onActiveRunIdChange}
            requestedStep={tab.requestedStep}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
