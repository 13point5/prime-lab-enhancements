"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Expand, Minimize2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

type JsonObject = Record<string, unknown>;

type RawSample = {
  reward?: unknown;
  metrics?: unknown;
};

type RawStepPayload = {
  samples?: unknown[];
};

type RunEnvironment = {
  id?: string;
  version?: string;
};

type RunMeta = {
  id?: string;
  name?: string;
  status?: string;
  base_model?: string;
  duration_s?: number | string;
  max_steps?: number | string;
  rollouts_per_example?: number | string;
  seq_len?: number | string;
  max_tokens?: number | string;
  batch_size?: number | string;
  learning_rate?: number | string;
  lora_alpha?: number | string;
  environments?: RunEnvironment[];
  val_config?: unknown;
  run_config?: unknown;
  eval_config?: unknown;
  buffer_config?: unknown;
  started_at?: string;
  completed_at?: string;
  created_at?: string;
  wandb_entity?: string;
  wandb_project?: string;
  wandb_run_name?: string;
};

export type OverviewRun = {
  run_id: string;
  run_payload?: {
    run?: RunMeta;
  };
  progress_payload?: JsonObject;
  rollout_payloads_by_step?: Record<string, RawStepPayload>;
  metrics_payload?: {
    metrics?: unknown[];
  };
  distributions_payloads_by_step?: Record<string, unknown>;
};

type ChartPoint = {
  step: number;
  reward: number | null;
  [key: string]: number | null;
};

type DistributionBin = {
  bin: string;
  count: number;
};

const REWARD_COLOR = "#7c5cff";
const CHART_LINE_WIDTH = 1.5;

const METRIC_PRIORITY = [
  "alignment_reward",
  "arrow_error_metric",
  "connector_error_metric",
  "format_reward",
  "misaligned_total_metric",
  "num_turns",
  "rectangle_error_metric",
];

const METRIC_COLORS: Record<string, string> = {
  alignment_reward: "#7c5cff",
  arrow_error_metric: "#f7b500",
  connector_error_metric: "#1f8bff",
  format_reward: "#0db7ae",
  misaligned_total_metric: "#00c853",
  num_turns: "#ff2d96",
  rectangle_error_metric: "#8f63ff",
};

const EXTRA_METRIC_COLORS = [
  "#f97316",
  "#22d3ee",
  "#84cc16",
  "#f43f5e",
  "#2dd4bf",
  "#f59e0b",
  "#60a5fa",
  "#34d399",
  "#f472b6",
  "#eab308",
  "#38bdf8",
  "#bef264",
];

const RUN_COMPARE_COLORS = ["#7c5cff", "#22d3ee", "#f97316", "#84cc16", "#f43f5e", "#eab308"];

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function toObject(value: unknown): JsonObject | null {
  const parsed = parseMaybeJson(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  return parsed as JsonObject;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function sortMetricKeys(keys: Iterable<string>): string[] {
  const priorityIndex = new Map(METRIC_PRIORITY.map((key, index) => [key, index]));

  return [...new Set(keys)].sort((a, b) => {
    const aPriority = priorityIndex.get(a);
    const bPriority = priorityIndex.get(b);
    if (aPriority !== undefined && bPriority !== undefined) {
      return aPriority - bPriority;
    }
    if (aPriority !== undefined) {
      return -1;
    }
    if (bPriority !== undefined) {
      return 1;
    }
    return a.localeCompare(b);
  });
}

function hashMetricName(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getMetricColor(metricKey: string): string {
  const fixed = METRIC_COLORS[metricKey];
  if (fixed) {
    return fixed;
  }
  return EXTRA_METRIC_COLORS[hashMetricName(metricKey) % EXTRA_METRIC_COLORS.length];
}

function buildSeries(run: OverviewRun | null): {
  chartData: ChartPoint[];
  metricKeys: string[];
  stepTicks: number[];
} {
  const pointByStep = new Map<number, { reward: number | null; metrics: Record<string, number | null> }>();
  const metricKeySet = new Set<string>();

  const rawMetricRows = run?.metrics_payload?.metrics;
  if (Array.isArray(rawMetricRows)) {
    for (const row of rawMetricRows) {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        continue;
      }
      const metricRow = row as JsonObject;
      const step = toNumber(metricRow.step);
      if (step === null) {
        continue;
      }

      const current = pointByStep.get(step) ?? {
        reward: null,
        metrics: {},
      };

      const reward = toNumber(metricRow["reward/mean"]);
      if (reward !== null) {
        current.reward = reward;
      }

      for (const [key, value] of Object.entries(metricRow)) {
        if (!key.startsWith("metrics/")) {
          continue;
        }

        const metricName = key.slice("metrics/".length);
        const metricValue = toNumber(value);
        if (metricValue === null) {
          continue;
        }

        metricKeySet.add(metricName);
        current.metrics[metricName] = metricValue;
      }

      pointByStep.set(step, current);
    }
  }

  const stepsWithRollouts = run?.rollout_payloads_by_step ?? {};
  for (const [stepKey, stepPayload] of Object.entries(stepsWithRollouts)) {
    const step = toNumber(stepKey);
    if (step === null) {
      continue;
    }
    const samples = Array.isArray(stepPayload?.samples) ? stepPayload.samples : [];
    if (samples.length === 0) {
      continue;
    }

    let rewardSum = 0;
    let rewardCount = 0;
    const metricSums = new Map<string, number>();
    const metricCounts = new Map<string, number>();

    for (const rawSample of samples) {
      if (!rawSample || typeof rawSample !== "object" || Array.isArray(rawSample)) {
        continue;
      }

      const sample = rawSample as RawSample;
      const reward = toNumber(sample.reward);
      if (reward !== null) {
        rewardSum += reward;
        rewardCount += 1;
      }

      const metrics = toObject(sample.metrics);
      if (!metrics) {
        continue;
      }

      for (const [metricKey, metricValueRaw] of Object.entries(metrics)) {
        const metricValue = toNumber(metricValueRaw);
        if (metricValue === null) {
          continue;
        }

        metricKeySet.add(metricKey);
        metricSums.set(metricKey, (metricSums.get(metricKey) ?? 0) + metricValue);
        metricCounts.set(metricKey, (metricCounts.get(metricKey) ?? 0) + 1);
      }
    }

    const current = pointByStep.get(step) ?? {
      reward: null,
      metrics: {},
    };

    if (current.reward === null && rewardCount > 0) {
      current.reward = rewardSum / rewardCount;
    }

    for (const [metricKey, sum] of metricSums.entries()) {
      if (current.metrics[metricKey] !== undefined) {
        continue;
      }
      const count = metricCounts.get(metricKey) ?? 0;
      if (count > 0) {
        current.metrics[metricKey] = sum / count;
      }
    }

    pointByStep.set(step, current);
  }

  const metricKeys = sortMetricKeys(metricKeySet);
  const sortedSteps = [...pointByStep.keys()].sort((a, b) => a - b);

  const chartData: ChartPoint[] = sortedSteps.map((step) => {
    const point = pointByStep.get(step) ?? { reward: null, metrics: {} };
    const row: ChartPoint = {
      step,
      reward: point.reward,
    };
    for (const metricKey of metricKeys) {
      row[metricKey] = point.metrics[metricKey] ?? null;
    }
    return row;
  });

  const stepTicks = getStepTicks(sortedSteps);

  return {
    chartData,
    metricKeys,
    stepTicks,
  };
}

function getStepTicks(steps: number[]): number[] {
  if (steps.length === 0) {
    return [];
  }
  if (steps.length <= 3) {
    return steps;
  }

  const first = steps[0];
  const middle = steps[Math.floor((steps.length - 1) / 2)] ?? first;
  const last = steps[steps.length - 1] ?? middle;

  return [...new Set([first, middle, last])];
}

function buildDistributionSeries(run: OverviewRun | null): {
  steps: number[];
  binsByStep: Record<number, DistributionBin[]>;
} {
  const binsByStep: Record<number, DistributionBin[]> = {};

  const distributionPayloads = run?.distributions_payloads_by_step ?? {};
  for (const [stepKey, payloadRaw] of Object.entries(distributionPayloads)) {
    const payload = toObject(payloadRaw);
    if (!payload) {
      continue;
    }

    const explicitStep = toNumber(payload.step);
    const fallbackStep = toNumber(stepKey);
    const step = explicitStep ?? fallbackStep;
    if (step === null) {
      continue;
    }

    const binsRoot = toObject(payload.bins);
    const rewardBinsRaw = binsRoot?.rewards;
    if (!Array.isArray(rewardBinsRaw)) {
      continue;
    }

    const bins: DistributionBin[] = [];
    for (const rawBin of rewardBinsRaw) {
      if (!rawBin || typeof rawBin !== "object" || Array.isArray(rawBin)) {
        continue;
      }
      const binObj = rawBin as JsonObject;
      const label = typeof binObj.bin === "string" ? binObj.bin : "";
      const count = toNumber(binObj.count);
      if (!label || count === null) {
        continue;
      }
      bins.push({
        bin: label,
        count,
      });
    }

    if (bins.length > 0) {
      binsByStep[step] = bins;
    }
  }

  if (Object.keys(binsByStep).length === 0) {
    const rolloutsByStep = run?.rollout_payloads_by_step ?? {};
    for (const [stepKey, stepPayload] of Object.entries(rolloutsByStep)) {
      const step = toNumber(stepKey);
      if (step === null) {
        continue;
      }

      const samples = Array.isArray(stepPayload.samples) ? stepPayload.samples : [];
      const rewards: number[] = [];
      for (const rawSample of samples) {
        if (!rawSample || typeof rawSample !== "object" || Array.isArray(rawSample)) {
          continue;
        }
        const reward = toNumber((rawSample as RawSample).reward);
        if (reward !== null) {
          rewards.push(reward);
        }
      }

      if (rewards.length > 0) {
        binsByStep[step] = histogram(rewards, 20);
      }
    }
  }

  const steps = Object.keys(binsByStep)
    .map((step) => Number(step))
    .filter((step) => Number.isFinite(step))
    .sort((a, b) => a - b);

  return {
    steps,
    binsByStep,
  };
}

function histogram(values: number[], binCount: number): DistributionBin[] {
  if (values.length === 0) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return [
      {
        bin: `${min.toFixed(3)}-${max.toFixed(3)}`,
        count: values.length,
      },
    ];
  }

  const bins = Array.from({ length: binCount }, () => 0);
  const width = (max - min) / binCount;

  for (const value of values) {
    const normalized = (value - min) / width;
    const index = Math.min(binCount - 1, Math.max(0, Math.floor(normalized)));
    bins[index] += 1;
  }

  return bins.map((count, index) => {
    const start = min + width * index;
    const end = min + width * (index + 1);
    return {
      bin: `${start.toFixed(3)}-${end.toFixed(3)}`,
      count,
    };
  });
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  let normalized = value.trim();
  if (!normalized.includes("T")) {
    normalized = normalized.replace(" ", "T");
  }

  normalized = normalized.replace(/\.(\d{3})\d+/, ".$1");

  if (!/(Z|[+-]\d\d:\d\d)$/.test(normalized)) {
    normalized = `${normalized}Z`;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function formatRelativeTime(value: unknown): string {
  const date = parseDate(value);
  if (!date) {
    return "-";
  }

  const diffMs = date.getTime() - Date.now();
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 1000 * 60 * 60 * 24 * 365],
    ["month", 1000 * 60 * 60 * 24 * 30],
    ["week", 1000 * 60 * 60 * 24 * 7],
    ["day", 1000 * 60 * 60 * 24],
    ["hour", 1000 * 60 * 60],
    ["minute", 1000 * 60],
    ["second", 1000],
  ];

  for (const [unit, factor] of units) {
    if (Math.abs(diffMs) >= factor || unit === "second") {
      const valueForUnit = Math.round(diffMs / factor);
      return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(valueForUnit, unit);
    }
  }

  return "-";
}

function formatDuration(valueSeconds: unknown, startedAt: unknown, completedAt: unknown): string {
  const seconds = toNumber(valueSeconds);
  if (seconds !== null && seconds >= 0) {
    return secondsToDuration(seconds);
  }

  const start = parseDate(startedAt);
  const end = parseDate(completedAt);
  if (!start || !end) {
    return "-";
  }

  const diffSeconds = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
  return secondsToDuration(diffSeconds);
}

function secondsToDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  if (typeof value === "number") {
    if (Number.isInteger(value)) {
      return value.toString();
    }
    if (Math.abs(value) >= 0.001) {
      return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
    }
    return value.toExponential(2);
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getStatusClasses(status: string): string {
  switch (status.toUpperCase()) {
    case "COMPLETED":
      return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
    case "RUNNING":
      return "border-blue-500/40 bg-blue-500/15 text-blue-300";
    case "FAILED":
      return "border-red-500/40 bg-red-500/15 text-red-300";
    case "STOPPED":
      return "border-amber-500/40 bg-amber-500/15 text-amber-300";
    default:
      return "border-zinc-700 bg-zinc-800/70 text-zinc-300";
  }
}

function formatStatusLabel(status: string): string {
  if (!status) {
    return "Unknown";
  }
  const lower = status.toLowerCase();
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
}

function buildConfigText(meta: RunMeta | undefined): string {
  if (!meta) {
    return "No run config found.";
  }

  const lines: string[] = [];
  const addLine = (label: string, value: unknown) => {
    if (value === null || value === undefined || value === "") {
      return;
    }
    if (typeof value === "string") {
      lines.push(`${label} = "${value}"`);
      return;
    }
    lines.push(`${label} = ${formatValue(value)}`);
  };

  addLine("model", meta.base_model);
  addLine("max_steps", toNumber(meta.max_steps));
  lines.push("");
  addLine("batch_size", toNumber(meta.batch_size));
  addLine("rollouts_per_example", toNumber(meta.rollouts_per_example));
  addLine("learning_rate", toNumber(meta.learning_rate));
  addLine("lora_alpha", toNumber(meta.lora_alpha));
  addLine("seq_len", toNumber(meta.seq_len));
  addLine("max_tokens", toNumber(meta.max_tokens));

  const runConfig = toObject(meta.run_config);
  if (runConfig && Object.keys(runConfig).length > 0) {
    lines.push("");
    lines.push("[run_config]");
    for (const [key, value] of Object.entries(runConfig)) {
      addLine(key, value);
    }
  }

  return lines.join("\n");
}

type RunOverviewTabProps = {
  run: OverviewRun | null;
  compareRuns?: OverviewRun[];
  compareVariant?: "overlay" | "dock" | "compare";
};

export function RunOverviewTab({ run, compareRuns = [], compareVariant = "overlay" }: RunOverviewTabProps) {
  const runMeta = run?.run_payload?.run;

  const { chartData, metricKeys, stepTicks } = React.useMemo(() => buildSeries(run), [run]);
  const metricColorByKey = React.useMemo(() => {
    const colors: Record<string, string> = {};
    for (const metricKey of metricKeys) {
      colors[metricKey] = getMetricColor(metricKey);
    }
    return colors;
  }, [metricKeys]);

  const metricsChartConfig = React.useMemo<ChartConfig>(() => {
    const config: ChartConfig = {};
    for (const metricKey of metricKeys) {
      config[metricKey] = {
        label: metricKey,
        color: metricColorByKey[metricKey],
      };
    }
    return config;
  }, [metricColorByKey, metricKeys]);

  const distributionSeries = React.useMemo(() => buildDistributionSeries(run), [run]);
  const [distributionIndex, setDistributionIndex] = React.useState(0);
  const [metricsExpanded, setMetricsExpanded] = React.useState(false);

  React.useEffect(() => {
    setDistributionIndex(distributionSeries.steps.length > 0 ? distributionSeries.steps.length - 1 : 0);
  }, [distributionSeries.steps.length, run?.run_id]);

  const distributionStep = distributionSeries.steps[distributionIndex] ?? null;
  const distributionBins =
    distributionStep === null ? [] : distributionSeries.binsByStep[distributionStep] ?? [];

  const progressPayload = run?.progress_payload ?? {};
  const latestStep = toNumber(progressPayload.latest_step) ?? chartData[chartData.length - 1]?.step ?? null;
  const maxSteps = toNumber(runMeta?.max_steps);

  const completedSteps =
    latestStep === null
      ? 0
      : maxSteps !== null
        ? Math.min(maxSteps, Math.max(0, latestStep + 1))
        : Math.max(0, latestStep + 1);

  const totalSteps = maxSteps ?? Math.max(completedSteps, 1);
  const completionRatio = totalSteps > 0 ? completedSteps / totalSteps : 0;
  const completionPct = completionRatio * 100;

  const progressSegments = Math.min(240, Math.max(totalSteps, 1));
  const completedSegments = Math.floor(progressSegments * completionRatio);

  const rewardChartConfig = React.useMemo<ChartConfig>(
    () => ({ reward: { label: "reward", color: REWARD_COLOR } }),
    [],
  );

  const distributionChartConfig = React.useMemo<ChartConfig>(
    () => ({ count: { label: "count", color: REWARD_COLOR } }),
    [],
  );

  const trainingValues = [
    ["max_steps", runMeta?.max_steps],
    ["rollouts_per_example", runMeta?.rollouts_per_example],
    ["seq_len", runMeta?.seq_len],
    ["batch_size", runMeta?.batch_size],
    ["max_tokens", runMeta?.max_tokens],
    ["learning_rate", runMeta?.learning_rate],
    ["lora_alpha", runMeta?.lora_alpha],
  ].filter(([, value]) => value !== undefined && value !== null) as Array<[string, unknown]>;

  const validationConfig = toObject(runMeta?.val_config);
  const validationValues = [
    ["interval", validationConfig?.interval],
    ["num_examples", validationConfig?.num_examples],
    ["rollouts_per_example", validationConfig?.rollouts_per_example],
  ].filter(([, value]) => value !== undefined && value !== null) as Array<[string, unknown]>;

  const compareSeries = React.useMemo(() => {
    return compareRuns
      .map((candidate, index) => {
        const series = buildSeries(candidate);
        return {
          id: candidate.run_id,
          name: candidate.run_payload?.run?.name ?? candidate.run_id,
          color: RUN_COMPARE_COLORS[index % RUN_COMPARE_COLORS.length],
          data: series.chartData,
        };
      })
      .filter((item) => item.data.length > 0);
  }, [compareRuns]);

  return (
    <div className="grid gap-4 text-xs xl:grid-cols-[minmax(0,1fr)_minmax(320px,430px)]">
      <div className="space-y-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
          <p className="text-lg font-semibold text-zinc-100">{completionPct.toFixed(2)}%</p>
          <p className="mt-1 text-xs text-zinc-400">
            {completedSteps} / {formatValue(totalSteps)} Steps
          </p>
          <div
            className="mt-3 grid gap-px"
            style={{ gridTemplateColumns: `repeat(${progressSegments}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: progressSegments }, (_, index) => (
              <div
                // This mimics Prime's segmented step bar while keeping rendering bounded.
                key={`progress-${index}`}
                className={cn(
                  "h-4 rounded-none",
                  index < completedSegments ? "bg-[#7c5cff]" : "bg-zinc-800",
                )}
              />
            ))}
          </div>
        </div>

        {!metricsExpanded ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
              <p className="text-sm font-semibold text-zinc-100">Reward</p>
              {chartData.length === 0 ? (
                <div className="flex h-[260px] items-center justify-center text-xs text-zinc-500">
                  No reward data available.
                </div>
              ) : (
                <ChartContainer config={rewardChartConfig} className="mt-2 h-[260px] w-full aspect-auto">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -14, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      type="number"
                      dataKey="step"
                      domain={["dataMin", "dataMax"]}
                      ticks={stepTicks}
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
                    <Line
                      type="monotone"
                      dataKey="reward"
                      name="reward"
                      stroke={REWARD_COLOR}
                      strokeWidth={CHART_LINE_WIDTH}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </div>

            <div className="group/metrics-card rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-100">Metrics</p>
                <Button
                  variant="secondary"
                  size="icon-sm"
                  className="size-8 bg-zinc-800 text-zinc-100 opacity-0 pointer-events-none transition-opacity hover:bg-zinc-700 group-hover/metrics-card:opacity-100 group-hover/metrics-card:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
                  onClick={() => setMetricsExpanded(true)}
                  aria-label="Expand metrics"
                  disabled={metricKeys.length === 0}
                >
                  <Expand className="size-4" />
                </Button>
              </div>
              {chartData.length === 0 || metricKeys.length === 0 ? (
                <div className="flex h-[260px] items-center justify-center text-xs text-zinc-500">
                  No metrics data available.
                </div>
              ) : (
                <>
                  <ChartContainer config={metricsChartConfig} className="mt-2 h-[200px] w-full aspect-auto">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -14, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        type="number"
                        dataKey="step"
                        domain={["dataMin", "dataMax"]}
                        ticks={stepTicks}
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
                      {metricKeys.map((metricKey) => (
                        <Line
                          key={metricKey}
                          type="monotone"
                          dataKey={metricKey}
                          name={metricKey}
                          stroke={metricColorByKey[metricKey]}
                          strokeWidth={CHART_LINE_WIDTH}
                          dot={false}
                          connectNulls
                          isAnimationActive={false}
                        />
                      ))}
                    </LineChart>
                  </ChartContainer>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-300">
                    {metricKeys.map((metricKey) => (
                      <div key={`legend-${metricKey}`} className="flex items-center gap-2">
                        <span
                          className="size-3 rounded-full"
                          style={{ backgroundColor: metricColorByKey[metricKey] }}
                        />
                        <span className="font-medium text-zinc-300">{metricKey}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="group/metric-card rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-100">Reward</p>
                  <Button
                    variant="secondary"
                    size="icon-xs"
                    className="size-6 bg-zinc-800 text-zinc-100 opacity-0 pointer-events-none transition-opacity hover:bg-zinc-700 group-hover/metric-card:opacity-100 group-hover/metric-card:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
                    onClick={() => setMetricsExpanded(false)}
                    aria-label="Collapse metrics"
                  >
                    <Minimize2 className="size-3.5" />
                  </Button>
                </div>
                {chartData.length === 0 ? (
                  <div className="flex h-[240px] items-center justify-center text-xs text-zinc-500">
                    No reward data available.
                  </div>
                ) : (
                  <ChartContainer config={rewardChartConfig} className="mt-2 h-[240px] w-full aspect-auto">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -14, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        type="number"
                        dataKey="step"
                        domain={["dataMin", "dataMax"]}
                        ticks={stepTicks}
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
                      <Line
                        type="monotone"
                        dataKey="reward"
                        name="reward"
                        stroke={REWARD_COLOR}
                        strokeWidth={CHART_LINE_WIDTH}
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ChartContainer>
                )}
              </div>

              {metricKeys.map((metricKey) => {
                const color = metricColorByKey[metricKey];
                const config: ChartConfig = {
                  [metricKey]: {
                    label: metricKey,
                    color,
                  },
                };

                return (
                  <div
                    key={`metric-card-${metricKey}`}
                    className="group/metric-card rounded-xl border border-zinc-800 bg-zinc-950/70 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-zinc-100">{metricKey}</p>
                      <Button
                        variant="secondary"
                        size="icon-xs"
                        className="size-6 bg-zinc-800 text-zinc-100 opacity-0 pointer-events-none transition-opacity hover:bg-zinc-700 group-hover/metric-card:opacity-100 group-hover/metric-card:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
                        onClick={() => setMetricsExpanded(false)}
                        aria-label="Collapse metrics"
                      >
                        <Minimize2 className="size-3.5" />
                      </Button>
                    </div>
                    <p className="text-xs text-zinc-500">Metrics</p>
                    <ChartContainer config={config} className="mt-2 h-[220px] w-full aspect-auto">
                      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -14, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                        <XAxis
                          type="number"
                          dataKey="step"
                          domain={["dataMin", "dataMax"]}
                          ticks={stepTicks}
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
                        <Line
                          type="monotone"
                          dataKey={metricKey}
                          name={metricKey}
                          stroke={color}
                          strokeWidth={CHART_LINE_WIDTH}
                          dot={false}
                          connectNulls
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ChartContainer>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {compareSeries.length > 1 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-100">Multi-run reward compare</p>
              <p className="text-[11px] text-zinc-500">UX variant: {compareVariant}</p>
            </div>
            <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-zinc-300">
              {compareSeries.map((item) => (
                <span key={item.id} className="inline-flex items-center gap-1.5 rounded border border-zinc-700 px-2 py-1">
                  <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
              ))}
            </div>
            <ChartContainer config={rewardChartConfig} className="h-[260px] w-full aspect-auto">
              <LineChart margin={{ top: 10, right: 10, left: -14, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis type="number" dataKey="step" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                {compareSeries.map((item) => (
                  <Line
                    key={item.id}
                    data={item.data}
                    dataKey="reward"
                    name={item.name}
                    type="monotone"
                    dot={false}
                    stroke={item.color}
                    strokeWidth={CHART_LINE_WIDTH}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ChartContainer>
          </div>
        ) : null}

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-zinc-100">Reward Distribution</p>
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                onClick={() => setDistributionIndex((value) => Math.max(0, value - 1))}
                disabled={distributionIndex <= 0}
                aria-label="Previous distribution step"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="min-w-16 text-center">
                Step {distributionStep !== null ? distributionStep : "-"}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                onClick={() =>
                  setDistributionIndex((value) =>
                    Math.min(distributionSeries.steps.length - 1, value + 1),
                  )
                }
                disabled={distributionIndex >= distributionSeries.steps.length - 1}
                aria-label="Next distribution step"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>

          {distributionBins.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-xs text-zinc-500">
              No distribution data available.
            </div>
          ) : (
            <ChartContainer config={distributionChartConfig} className="mt-2 h-[280px] w-full aspect-auto">
              <BarChart data={distributionBins} margin={{ top: 10, right: 10, left: -14, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="bin"
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(0, Math.floor(distributionBins.length / 8) - 1)}
                  tickMargin={8}
                  stroke="rgba(161,161,170,0.8)"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  stroke="rgba(161,161,170,0.8)"
                  allowDecimals={false}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      indicator="dot"
                      className="border-zinc-700 bg-zinc-900/95 text-zinc-100"
                    />
                  }
                />
                <Bar dataKey="count" fill={REWARD_COLOR} radius={[2, 2, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <p className="text-xs text-zinc-400">Status</p>
              <span
                className={cn(
                  "mt-2 inline-flex rounded-md border px-2 py-1 text-xs font-semibold",
                  getStatusClasses(runMeta?.status ?? ""),
                )}
              >
                {formatStatusLabel(runMeta?.status ?? "Unknown")}
              </span>
            </div>
            <div>
              <p className="text-xs text-zinc-400">Duration</p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">
                {formatDuration(runMeta?.duration_s, runMeta?.started_at, runMeta?.completed_at)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-400">Created At</p>
              <p className="mt-1 text-xs text-zinc-100">{formatRelativeTime(runMeta?.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-400">Completed At</p>
              <p className="mt-1 text-xs text-zinc-100">{formatRelativeTime(runMeta?.completed_at)}</p>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-3">
            <p className="text-xs text-zinc-400">Model</p>
            <p className="mt-1 break-all text-sm font-semibold text-zinc-100">
              {runMeta?.base_model ?? "-"}
            </p>
          </div>

          <div className="border-t border-zinc-800 pt-3">
            <p className="text-xs text-zinc-400">Environments</p>
            {runMeta?.environments?.length ? (
              <div className="mt-2 space-y-2">
                {runMeta.environments.map((environment) => (
                  <div key={environment.id ?? "unknown-env"} className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-100">{environment.id ?? "unknown"}</span>
                    {environment.version ? (
                      <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                        v{environment.version}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">-</p>
            )}
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-sm font-semibold text-zinc-100">Training</p>
          {trainingValues.length === 0 ? (
            <p className="text-xs text-zinc-500">No training fields available.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {trainingValues.map(([key, value]) => (
                <div key={`training-${key}`}>
                  <p className="text-xs text-zinc-500">{key}</p>
                  <p className="text-sm font-semibold text-zinc-100">{formatValue(value)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-sm font-semibold text-zinc-100">Validation</p>
          {validationValues.length === 0 ? (
            <p className="text-xs text-zinc-500">No validation fields available.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {validationValues.map(([key, value]) => (
                <div key={`validation-${key}`}>
                  <p className="text-xs text-zinc-500">{key}</p>
                  <p className="text-sm font-semibold text-zinc-100">{formatValue(value)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <p className="text-sm font-semibold text-zinc-100">Config</p>
          <pre className="max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900/80 p-3 font-mono text-xs leading-6 text-zinc-300">
            <code>{buildConfigText(runMeta)}</code>
          </pre>
        </div>
      </aside>
    </div>
  );
}
