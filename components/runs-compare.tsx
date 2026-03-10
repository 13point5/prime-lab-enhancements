"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import type { ChartCardGridItem } from "@/components/chart-card-grid";
import { CompareVariationOne } from "@/components/compare/compare-variation-one";
import {
  CompareVariationTwo,
  type CompareStepTab,
} from "@/components/compare/compare-variation-two";
import type { RawRolloutsData } from "@/components/run-rollouts";
import {
  buildEnvironmentGroups,
  buildMetricChartData,
  buildRewardChartData,
  buildRunColorMap,
  buildRunSummaries,
} from "@/components/runs-home";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_CHART_LINE_WIDTH } from "@/lib/chart-constants";
import { readRunSelectionStore, writeRunSelectionStore } from "@/lib/run-selection-storage";

type RunsCompareProps = {
  data: RawRolloutsData;
  initialEnvironmentKey: string | null;
  initialRunIds: string[];
};

type CompareVariation = "variation-1" | "variation-2";

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
  const [variation, setVariation] = React.useState<CompareVariation>("variation-2");
  const [variationOneTab, setVariationOneTab] = React.useState<"charts" | "rollouts">("charts");
  const [variationTwoTab, setVariationTwoTab] = React.useState<string>("charts");
  const [variationTwoStepTabs, setVariationTwoStepTabs] = React.useState<CompareStepTab[]>([]);
  const [activeRolloutRunId, setActiveRolloutRunId] = React.useState<string | null>(null);

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
        next = activeGroup.runs
          .slice(0, Math.min(4, activeGroup.runs.length))
          .map((run) => run.runId);
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

  React.useEffect(() => {
    setVariationTwoStepTabs([]);
    setVariationTwoTab("charts");
  }, [activeGroup?.key]);

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

  React.useEffect(() => {
    if (selectedRuns.length === 0) {
      setActiveRolloutRunId(null);
      return;
    }

    setActiveRolloutRunId((current) => {
      if (current && selectedRuns.some((run) => run.runId === current)) {
        return current;
      }
      return selectedRuns[0]?.runId ?? null;
    });
  }, [selectedRuns]);

  const runColorById = React.useMemo(
    () => buildRunColorMap(activeGroup?.runs ?? []),
    [activeGroup],
  );

  const rewardSeries = React.useMemo(() => buildRewardChartData(selectedRuns), [selectedRuns]);
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

  const handleOpenStepTab = React.useCallback((step: number) => {
    if (!Number.isFinite(step)) {
      return;
    }

    const requestedStep = Math.round(step);
    const tabId = `step-${requestedStep}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setVariationTwoStepTabs((current) => {
      const sameStepCount =
        current.filter((tab) => tab.requestedStep === requestedStep).length + 1;
      const title =
        sameStepCount === 1
          ? `Step ${requestedStep}`
          : `Step ${requestedStep} · ${sameStepCount}`;

      return [
        ...current,
        {
          id: tabId,
          requestedStep,
          title,
        },
      ];
    });
    setVariationTwoTab(tabId);
  }, []);

  const handleCloseStepTab = React.useCallback((tabId: string) => {
    setVariationTwoStepTabs((current) => current.filter((tab) => tab.id !== tabId));
    setVariationTwoTab((current) => (current === tabId ? "charts" : current));
  }, []);

  const createChartCards = React.useCallback((onStepClick?: (step: number) => void) => {
    const handleChartClick = onStepClick
      ? (state?: { activeLabel?: unknown }) => {
          const rawStep = state?.activeLabel;
          const parsedStep = typeof rawStep === "number" ? rawStep : Number(rawStep);
          if (Number.isFinite(parsedStep)) {
            onStepClick(parsedStep);
          }
        }
      : undefined;

    const renderChart = (
      data: Array<Record<string, number | null>>,
      lineKeyPrefix: string,
    ) => (
      <ChartContainer
        config={runChartConfig}
        className={`h-[220px] w-full aspect-auto${onStepClick ? " cursor-pointer" : ""}`}
      >
        <LineChart
          data={data}
          margin={{ top: 10, right: 10, left: -14, bottom: 0 }}
          onClick={handleChartClick}
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
              key={`${lineKeyPrefix}-${run.runId}`}
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
    );

    const cards: ChartCardGridItem[] = [
      {
        id: "reward-mean",
        title: "reward/mean",
        content:
          rewardSeries.data.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-[11px] text-zinc-500">
              No data.
            </div>
          ) : (
            renderChart(rewardSeries.data, "reward-line")
          ),
      },
    ];

    for (const metricKey of metricKeysToShow) {
      const metricData = metricDataByKey[metricKey] ?? [];
      cards.push({
        id: `metric-${metricKey}`,
        title: metricKey,
        content:
          metricData.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center text-[11px] text-zinc-500">
              No data.
            </div>
          ) : (
            renderChart(metricData, metricKey)
          ),
      });
    }

    return cards;
  }, [metricDataByKey, metricKeysToShow, rewardSeries, runChartConfig, runColorById, selectedRuns]);

  const chartCards = React.useMemo<ChartCardGridItem[]>(() => createChartCards(), [createChartCards]);
  const interactiveChartCards = React.useMemo<ChartCardGridItem[]>(
    () => createChartCards(handleOpenStepTab),
    [createChartCards, handleOpenStepTab],
  );

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
        <header className="border-b border-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="icon-sm" className="text-zinc-400 hover:text-zinc-100">
                <Link href="/" aria-label="Back to training home" title="Back to training home">
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
              <h1 className="text-xl font-semibold tracking-tight">
                {activeGroup ? activeGroup.environment : "Runs"}
              </h1>
            </div>

            <Select
              value={variation}
              onValueChange={(value) => setVariation(value as CompareVariation)}
            >
              <SelectTrigger className="h-8 min-w-[160px] border-zinc-800 bg-zinc-950 text-zinc-100">
                <SelectValue placeholder="Choose variation" />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
                <SelectItem value="variation-2">Variation 2</SelectItem>
                <SelectItem value="variation-1">Variation 1</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </header>

        <section
          className={
            variation === "variation-2"
              ? "flex flex-1 min-h-0 overflow-hidden px-4 pb-4 pt-2 sm:px-6 sm:pb-5 sm:pt-3"
              : "flex flex-1 min-h-0 overflow-hidden px-4 py-4 sm:px-6 sm:py-5"
          }
        >
          {!activeGroup ? (
            <div className="w-full rounded-lg border border-zinc-900 bg-[#060606] px-6 py-14 text-center text-zinc-500">
              No runs found.
            </div>
          ) : variation === "variation-1" ? (
            <CompareVariationOne
              runs={activeGroup.runs}
              selectedRuns={selectedRuns}
              selectedRunIdSet={selectedRunIdSet}
              allRunsSelected={allRunsSelected}
              runColorById={runColorById}
              chartCards={chartCards}
              activeRolloutRunId={activeRolloutRunId}
              rightPaneTab={variationOneTab}
              onRightPaneTabChange={(value) => setVariationOneTab(value as "charts" | "rollouts")}
              onActiveRunIdChange={setActiveRolloutRunId}
              onToggleRun={handleToggleRun}
              onToggleAllRuns={handleToggleAllRuns}
            />
          ) : (
            <CompareVariationTwo
              runs={activeGroup.runs}
              selectedRuns={selectedRuns}
              selectedRunIdSet={selectedRunIdSet}
              allRunsSelected={allRunsSelected}
              runColorById={runColorById}
              chartCards={interactiveChartCards}
              activeRolloutRunId={activeRolloutRunId}
              activeTab={variationTwoTab}
              stepTabs={variationTwoStepTabs}
              onActiveTabChange={setVariationTwoTab}
              onCloseStepTab={handleCloseStepTab}
              onActiveRunIdChange={setActiveRolloutRunId}
              onToggleRun={handleToggleRun}
              onToggleAllRuns={handleToggleAllRuns}
            />
          )}
        </section>
      </div>
    </main>
  );
}
