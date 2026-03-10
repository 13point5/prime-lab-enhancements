"use client";

import { CompareRolloutsContent } from "@/components/compare/compare-rollouts-content";
import type { RunSummary } from "@/components/runs-home";

type CompareRolloutsViewProps = {
  selectedRuns: RunSummary[];
  activeRunId: string | null;
  runColorById: Record<string, string>;
  onActiveRunIdChange: (runId: string) => void;
  requestedStep?: number | null;
};

export function CompareRolloutsView({
  selectedRuns,
  activeRunId,
  runColorById,
  onActiveRunIdChange,
  requestedStep,
}: CompareRolloutsViewProps) {
  return (
    <CompareRolloutsContent
      selectedRuns={selectedRuns}
      activeRunId={activeRunId}
      runColorById={runColorById}
      onActiveRunIdChange={onActiveRunIdChange}
      requestedStep={requestedStep}
    />
  );
}
