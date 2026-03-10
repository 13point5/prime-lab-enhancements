"use client";

import { ChartCardGrid, type ChartCardGridItem } from "@/components/chart-card-grid";
import type { RunSummary } from "@/components/runs-home";

type CompareChartsContentProps = {
  selectedRuns: RunSummary[];
  chartCards: ChartCardGridItem[];
};

export function CompareChartsContent({
  selectedRuns,
  chartCards,
}: CompareChartsContentProps) {
  return (
    <div className="relative z-10 h-full overflow-y-auto px-4 pb-4">
      {selectedRuns.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-10 text-center text-sm text-zinc-500">
          Select at least one run to view charts.
        </div>
      ) : (
        <ChartCardGrid items={chartCards} />
      )}
    </div>
  );
}
