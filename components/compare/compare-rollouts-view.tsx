"use client";

import { CompareRolloutsContent } from "@/components/compare/compare-rollouts-content";
import type { RunSummary } from "@/components/runs-home";

type CompareRolloutsViewProps = {
  selectedRuns: RunSummary[];
  activeRunId: string | null;
  runColorById: Record<string, string>;
  onActiveRunIdChange: (runId: string) => void;
};

export function CompareRolloutsView({
  selectedRuns,
  activeRunId,
  runColorById,
  onActiveRunIdChange,
}: CompareRolloutsViewProps) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-zinc-900 bg-[#060606] p-4">
      <CompareRolloutsContent
        selectedRuns={selectedRuns}
        activeRunId={activeRunId}
        runColorById={runColorById}
        onActiveRunIdChange={onActiveRunIdChange}
      />
    </div>
  );
}
