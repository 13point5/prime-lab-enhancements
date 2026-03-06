"use client";

import Link from "next/link";

import type { RunSummary } from "@/components/runs-home";
import { statusBadgeClasses } from "@/components/runs-home";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type CompareRunsTableProps = {
  runs: RunSummary[];
  runColorById: Record<string, string>;
  selectedRunIdSet: Set<string>;
  allRunsSelected: boolean;
  onToggleRun: (runId: string, checked: boolean) => void;
  onToggleAllRuns: (checked: boolean) => void;
};

export function CompareRunsTable({
  runs,
  runColorById,
  selectedRunIdSet,
  allRunsSelected,
  onToggleRun,
  onToggleAllRuns,
}: CompareRunsTableProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 items-center justify-between gap-2 border-b border-zinc-900 px-4">
        <p className="text-sm font-medium text-zinc-300">Runs</p>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            onClick={() => onToggleAllRuns(true)}
          >
            Select all
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            onClick={() => onToggleAllRuns(false)}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <Table className="min-w-[640px]">
          <TableHeader className="bg-zinc-950/80">
            <TableRow className="border-zinc-900 hover:bg-zinc-950/80">
              <TableHead className="w-10 pl-4">
                <Checkbox
                  checked={allRunsSelected}
                  onCheckedChange={(checked) => onToggleAllRuns(checked === true)}
                  aria-label="Select all runs"
                />
              </TableHead>
              <TableHead className="text-zinc-400">Run</TableHead>
              <TableHead className="text-zinc-400">Status</TableHead>
              <TableHead className="text-zinc-400">Progress</TableHead>
              <TableHead className="text-zinc-400">Last Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => {
              const selected = selectedRunIdSet.has(run.runId);
              const runColor = runColorById[run.runId] ?? "#7c5cff";

              return (
                <TableRow
                  key={run.key}
                  className={cn(
                    "border-zinc-900 hover:bg-zinc-900/60",
                    selected && "bg-zinc-900/40",
                  )}
                >
                  <TableCell className="pl-4">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={(checked) => onToggleRun(run.runId, checked === true)}
                      aria-label={`Select ${run.name}`}
                    />
                  </TableCell>
                  <TableCell className="max-w-[240px] font-medium text-zinc-100">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: runColor }}
                      />
                      <Link
                        href={`/run/${encodeURIComponent(run.runId)}`}
                        className="truncate hover:text-white"
                      >
                        {run.name}
                      </Link>
                    </div>
                    <div className="mt-0.5 max-w-[220px] truncate text-xs text-zinc-500">
                      {run.runId}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("h-6 border font-semibold", statusBadgeClasses(run.status))}
                    >
                      {run.statusLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-[170px]">
                    <div className="space-y-1.5">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.round(run.progressRatio * 100)}%`,
                            backgroundColor: runColor,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                        <span>{run.durationLabel}</span>
                        <span>{run.progressLabel}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-zinc-300">{run.lastUpdatedLabel}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
