"use client";

import { RunRolloutDataPanel } from "@/components/run-rollout-data-panel";
import type { RunSummary } from "@/components/runs-home";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CompareRolloutsContentProps = {
  selectedRuns: RunSummary[];
  activeRunId: string | null;
  runColorById: Record<string, string>;
  onActiveRunIdChange: (runId: string) => void;
};

export function CompareRolloutsContent({
  selectedRuns,
  activeRunId,
  runColorById,
  onActiveRunIdChange,
}: CompareRolloutsContentProps) {
  const activeRun = selectedRuns.find((run) => run.runId === activeRunId) ?? selectedRuns[0] ?? null;

  if (selectedRuns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-10 text-center text-sm text-zinc-500">
        Select at least one run to view rollouts.
      </div>
    );
  }

  if (!activeRun) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Select a run to view rollouts.
      </div>
    );
  }

  return (
    <RunRolloutDataPanel
      run={activeRun.run}
      className="h-full"
      controlsStart={
        <Select value={activeRun.runId} onValueChange={onActiveRunIdChange}>
          <SelectTrigger className="h-8 min-w-[280px] max-w-[420px] border-zinc-700 bg-zinc-950 text-zinc-100">
            <SelectValue placeholder="Choose run" />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
            {selectedRuns.map((run) => (
              <SelectItem key={`rollout-select-${run.runId}`} value={run.runId}>
                <span className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: runColorById[run.runId] }}
                  />
                  <span className="truncate">{run.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  );
}
