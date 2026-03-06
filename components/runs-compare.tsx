"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import type { RawRolloutsData } from "@/components/run-rollouts";
import {
  buildEnvironmentGroups,
  buildMetricChartData,
  buildRewardChartData,
  buildRunColorMap,
  buildRunSummaries,
  statusBadgeClasses,
} from "@/components/runs-home";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DEFAULT_CHART_LINE_WIDTH } from "@/lib/chart-constants";
import { readRunSelectionStore, writeRunSelectionStore } from "@/lib/run-selection-storage";
import { cn } from "@/lib/utils";

type RunsCompareProps = {
  data: RawRolloutsData;
  initialEnvironmentKey: string | null;
  initialRunIds: string[];
};

const EMPTY_STRING_ARRAY: string[] = [];

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
}

export function RunsCompare({ data, initialEnvironmentKey, initialRunIds }: RunsCompareProps) {
  const runSummaries = React.useMemo(() => buildRunSummaries(data), [data]);
  const environmentGroups = React.useMemo(
    () => buildEnvironmentGroups(runSummaries),
    [runSummaries],
  );

  const requestedEnvironment = (initialEnvironmentKey ?? "").trim();

  const activeGroup = React.useMemo(() => {
    if (environmentGroups.length === 0) {
      return null;
    }

    if (requestedEnvironment.length > 0) {
      return (
        environmentGroups.find((group) => group.key === requestedEnvironment) ??
        environmentGroups[0] ??
        null
      );
    }

    return environmentGroups[0] ?? null;
  }, [environmentGroups, requestedEnvironment]);

  const [selectedRunIdsByEnvironment, setSelectedRunIdsByEnvironment] = React.useState<
    Record<string, string[]>
  >({});
  const [hasLoadedRunSelections, setHasLoadedRunSelections] = React.useState(false);

  React.useEffect(() => {
    setSelectedRunIdsByEnvironment(readRunSelectionStore());
    setHasLoadedRunSelections(true);
  }, []);

  const didApplyInitialRuns = React.useRef(false);
  React.useEffect(() => {
    if (!hasLoadedRunSelections || !activeGroup) {
      return;
    }

    setSelectedRunIdsByEnvironment((current) => {
      const existing = current[activeGroup.key] ?? [];
      const validRunIds = new Set(activeGroup.runs.map((run) => run.runId));
      let next = existing.filter((runId) => validRunIds.has(runId));

      if (!didApplyInitialRuns.current) {
        const fromQuery = initialRunIds.filter((runId) => validRunIds.has(runId));
        if (fromQuery.length > 0) {
          next = fromQuery;
        }
        didApplyInitialRuns.current = true;
      }

      if (next.length === 0) {
        next = activeGroup.runs.slice(0, Math.min(4, activeGroup.runs.length)).map((run) => run.runId);
      }

      if (arraysEqual(existing, next)) {
        return current;
      }

      return {
        ...current,
        [activeGroup.key]: next,
      };
    });
  }, [activeGroup, hasLoadedRunSelections, initialRunIds]);

  React.useEffect(() => {
    if (!hasLoadedRunSelections) {
      return;
    }
    writeRunSelectionStore(selectedRunIdsByEnvironment);
  }, [hasLoadedRunSelections, selectedRunIdsByEnvironment]);

  const selectedRunIds = React.useMemo(() => {
    if (!activeGroup) {
      return EMPTY_STRING_ARRAY;
    }
    return selectedRunIdsByEnvironment[activeGroup.key] ?? EMPTY_STRING_ARRAY;
  }, [activeGroup, selectedRunIdsByEnvironment]);

  const selectedRunIdSet = React.useMemo(() => new Set(selectedRunIds), [selectedRunIds]);

  const selectedRuns = React.useMemo(() => {
    if (!activeGroup) {
      return [];
    }

    return activeGroup.runs.filter((run) => selectedRunIdSet.has(run.runId));
  }, [activeGroup, selectedRunIdSet]);

  const runColorById = React.useMemo(
    () => buildRunColorMap(activeGroup?.runs ?? []),
    [activeGroup],
  );

  const rewardSeries = React.useMemo(
    () => buildRewardChartData(selectedRuns),
    [selectedRuns],
  );

  const metricKeysToShow = activeGroup?.metricKeys ?? EMPTY_STRING_ARRAY;

  const metricDataByKey = React.useMemo(() => {
    const result: Record<string, Array<Record<string, number | null>>> = {};
    for (const metricKey of metricKeysToShow) {
      result[metricKey] = buildMetricChartData(selectedRuns, metricKey);
    }
    return result;
  }, [metricKeysToShow, selectedRuns]);

  const runChartConfig = React.useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};
    for (const run of selectedRuns) {
      config[run.runId] = {
        label: run.name,
        color: runColorById[run.runId],
      };
    }
    return config;
  }, [runColorById, selectedRuns]);

  const allRunsSelected =
    !!activeGroup && activeGroup.runs.length > 0 && selectedRunIds.length === activeGroup.runs.length;

  const handleToggleRun = React.useCallback(
    (runId: string, checked: boolean) => {
      if (!activeGroup) {
        return;
      }

      setSelectedRunIdsByEnvironment((current) => {
        const existing = current[activeGroup.key] ?? [];
        const nextSet = new Set(existing);

        if (checked) {
          nextSet.add(runId);
        } else {
          nextSet.delete(runId);
        }

        const next = activeGroup.runs
          .map((run) => run.runId)
          .filter((candidateRunId) => nextSet.has(candidateRunId));

        if (arraysEqual(existing, next)) {
          return current;
        }

        return {
          ...current,
          [activeGroup.key]: next,
        };
      });
    },
    [activeGroup],
  );

  const handleToggleAllRuns = React.useCallback(
    (checked: boolean) => {
      if (!activeGroup) {
        return;
      }

      setSelectedRunIdsByEnvironment((current) => ({
        ...current,
        [activeGroup.key]: checked ? activeGroup.runs.map((run) => run.runId) : [],
      }));
    },
    [activeGroup],
  );

  return (
    <main className="h-screen overflow-hidden bg-black text-zinc-100">
      <div className="flex h-full min-h-0 flex-col">
        <header className="border-b border-zinc-900 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="icon-sm" className="text-zinc-400 hover:text-zinc-100">
                <Link href="/" aria-label="Back to training home" title="Back to training home">
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
              <h1 className="text-xl font-semibold tracking-tight">
                {activeGroup ? activeGroup.environment : "Runs"}
              </h1>
              <Badge variant="outline" className="h-5 border-zinc-700 bg-zinc-900 text-[11px] text-zinc-300">
                Beta
              </Badge>
            </div>
          </div>
        </header>

        <section className="flex flex-1 min-h-0 overflow-hidden px-4 py-4 sm:px-6 sm:py-5">
          {!activeGroup ? (
            <div className="w-full rounded-xl border border-zinc-900 bg-[#060606] px-6 py-14 text-center text-zinc-500">
              No runs found.
            </div>
          ) : (
            <ResizablePanelGroup
              orientation="horizontal"
              className="h-full min-h-0 w-full overflow-hidden rounded-xl border border-zinc-900 bg-[#060606]"
            >
              <ResizablePanel defaultSize="38%" minSize="420px" maxSize="62%">
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 px-4 py-1.5">
                    <p className="text-sm font-medium text-zinc-300">Runs</p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                        onClick={() => handleToggleAllRuns(true)}
                      >
                        Select all
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                        onClick={() => handleToggleAllRuns(false)}
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
                              onCheckedChange={(checked) => handleToggleAllRuns(checked === true)}
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
                        {activeGroup.runs.map((run) => {
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
                                  onCheckedChange={(checked) =>
                                    handleToggleRun(run.runId, checked === true)
                                  }
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
                                  className={cn(
                                    "h-6 border font-semibold",
                                    statusBadgeClasses(run.status),
                                  )}
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
              </ResizablePanel>

              <ResizableHandle withHandle className="bg-zinc-900" tabIndex={-1} />

              <ResizablePanel defaultSize="62%" minSize="520px">
                <div className="flex h-full min-h-0 flex-col">
                  <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    <div className="space-y-4">
                      {selectedRuns.length === 0 ? (
                        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-10 text-center text-sm text-zinc-500">
                          Select at least one run to view charts.
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2.5">
                            <p className="text-xs font-semibold text-zinc-200">reward/mean</p>
                            {rewardSeries.data.length === 0 ? (
                              <div className="flex h-[220px] items-center justify-center text-[11px] text-zinc-500">
                                No data.
                              </div>
                            ) : (
                              <ChartContainer
                                config={runChartConfig}
                                className="mt-2 h-[220px] w-full aspect-auto"
                              >
                                <LineChart
                                  data={rewardSeries.data}
                                  margin={{ top: 10, right: 10, left: -14, bottom: 0 }}
                                >
                                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                                  <XAxis
                                    type="number"
                                    dataKey="step"
                                    domain={["dataMin", "dataMax"]}
                                    ticks={rewardSeries.stepTicks}
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    stroke="rgba(161,161,170,0.8)"
                                  />
                                  <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    stroke="rgba(161,161,170,0.8)"
                                  />
                                  <ChartTooltip
                                    content={
                                      <ChartTooltipContent
                                        indicator="line"
                                        className="border-zinc-700 bg-zinc-900/95 text-zinc-100"
                                      />
                                    }
                                  />
                                  {selectedRuns.map((run) => (
                                    <Line
                                      key={`reward-line-${run.runId}`}
                                      type="monotone"
                                      dataKey={run.runId}
                                      name={run.name}
                                      stroke={runColorById[run.runId]}
                                      strokeWidth={DEFAULT_CHART_LINE_WIDTH}
                                      dot={false}
                                      connectNulls
                                      isAnimationActive={false}
                                    />
                                  ))}
                                </LineChart>
                              </ChartContainer>
                            )}
                          </div>

                          {metricKeysToShow.map((metricKey) => {
                            const metricData = metricDataByKey[metricKey] ?? [];
                            return (
                              <div
                                key={`metric-panel-${metricKey}`}
                                className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2.5"
                              >
                                <p className="text-xs font-semibold text-zinc-200">{metricKey}</p>
                                {metricData.length === 0 ? (
                                  <div className="flex h-[220px] items-center justify-center text-[11px] text-zinc-500">
                                    No data.
                                  </div>
                                ) : (
                                  <ChartContainer
                                    config={runChartConfig}
                                    className="mt-2 h-[220px] w-full aspect-auto"
                                  >
                                    <LineChart
                                      data={metricData}
                                      margin={{ top: 10, right: 10, left: -14, bottom: 0 }}
                                    >
                                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                                      <XAxis
                                        type="number"
                                        dataKey="step"
                                        domain={["dataMin", "dataMax"]}
                                        ticks={rewardSeries.stepTicks}
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        stroke="rgba(161,161,170,0.8)"
                                      />
                                      <YAxis
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        stroke="rgba(161,161,170,0.8)"
                                      />
                                      <ChartTooltip
                                        content={
                                          <ChartTooltipContent
                                            indicator="line"
                                            className="border-zinc-700 bg-zinc-900/95 text-zinc-100"
                                          />
                                        }
                                      />
                                      {selectedRuns.map((run) => (
                                        <Line
                                          key={`${metricKey}-${run.runId}`}
                                          type="monotone"
                                          dataKey={run.runId}
                                          name={run.name}
                                          stroke={runColorById[run.runId]}
                                          strokeWidth={DEFAULT_CHART_LINE_WIDTH}
                                          dot={false}
                                          connectNulls
                                          isAnimationActive={false}
                                        />
                                      ))}
                                    </LineChart>
                                  </ChartContainer>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </section>
      </div>
    </main>
  );
}
