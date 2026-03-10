"use client";

import * as React from "react";
import Link from "next/link";

import type { RawRolloutsData, RawRun } from "@/components/run-rollouts";
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
import { readRunSelectionStore, writeRunSelectionStore } from "@/lib/run-selection-storage";
import { cn } from "@/lib/utils";

export type RunStatus = "COMPLETED" | "RUNNING" | "STOPPED" | "FAILED" | "UNKNOWN";

type JsonObject = Record<string, unknown>;

type ProgressPayload = {
  latest_step?: number | string;
  steps_with_samples?: unknown[];
  last_updated_at?: string;
};

type RunSeries = {
  steps: number[];
  rewardByStep: Map<number, number>;
  metricsByStep: Map<number, Record<string, number>>;
  metricKeys: string[];
};

export type RunSummary = {
  key: string;
  run: RawRun;
  runId: string;
  name: string;
  environment: string;
  environmentVersion: string | null;
  environmentVersionId: string | null;
  model: string;
  status: RunStatus;
  statusLabel: string;
  latestStep: number;
  maxSteps: number | null;
  progressRatio: number;
  progressLabel: string;
  durationLabel: string;
  lastUpdatedAt: number | null;
  lastUpdatedLabel: string;
  series: RunSeries;
};

export type EnvironmentGroup = {
  key: string;
  environment: string;
  versions: string[];
  versionIds: string[];
  runs: RunSummary[];
  latestUpdatedAt: number | null;
  metricKeys: string[];
  statusCounts: Record<RunStatus, number>;
};

export type ChartPoint = {
  step: number;
  [key: string]: number | null;
};

export const RUN_COLOR_PALETTE = [
  "#7c5cff",
  "#1f8bff",
  "#0db7ae",
  "#f7b500",
  "#ff2d96",
  "#00c853",
  "#f97316",
  "#22d3ee",
  "#84cc16",
  "#f43f5e",
  "#8b5cf6",
  "#eab308",
];

const METRIC_PRIORITY = [
  "alignment_reward",
  "format_reward",
  "num_turns",
  "arrow_error_metric",
  "connector_error_metric",
  "rectangle_error_metric",
  "misaligned_total_metric",
];

const EMPTY_STRING_ARRAY: string[] = [];

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
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) {
    return "-";
  }

  const rounded = Math.max(1, Math.floor(seconds));
  const days = Math.floor(rounded / 86_400);
  const hours = Math.floor((rounded % 86_400) / 3_600);
  const minutes = Math.floor((rounded % 3_600) / 60);
  const secs = rounded % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function formatRelativeTime(timestamp: number | null): string {
  if (timestamp === null) {
    return "-";
  }

  const diffSeconds = Math.round((timestamp - Date.now()) / 1000);
  if (Math.abs(diffSeconds) < 45) {
    return "just now";
  }

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
    ["second", 1],
  ];

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, secondsPerUnit] of units) {
    if (Math.abs(diffSeconds) >= secondsPerUnit || unit === "second") {
      const value = Math.round(diffSeconds / secondsPerUnit);
      return rtf.format(value, unit);
    }
  }

  return "-";
}

function normalizeStatus(rawStatus: unknown): { status: RunStatus; label: string } {
  const statusText = typeof rawStatus === "string" ? rawStatus.toUpperCase() : "";

  if (statusText.includes("COMPLETE")) {
    return { status: "COMPLETED", label: "Completed" };
  }
  if (statusText.includes("RUN")) {
    return { status: "RUNNING", label: "Running" };
  }
  if (
    statusText.includes("STOP") ||
    statusText.includes("CANCEL") ||
    statusText.includes("PAUSE")
  ) {
    return { status: "STOPPED", label: "Stopped" };
  }
  if (statusText.includes("FAIL") || statusText.includes("ERROR")) {
    return { status: "FAILED", label: "Failed" };
  }

  return { status: "UNKNOWN", label: "Unknown" };
}

function extractLatestStep(progress: ProgressPayload): number {
  const direct = toNumber(progress.latest_step);
  if (direct !== null && direct >= 0) {
    return direct;
  }

  const fromSteps = Array.isArray(progress.steps_with_samples)
    ? progress.steps_with_samples
        .map((step) => toNumber(step))
        .filter((step): step is number => step !== null)
    : [];

  if (fromSteps.length === 0) {
    return 0;
  }

  return Math.max(...fromSteps);
}

export function sortMetricKeys(keys: Iterable<string>): string[] {
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

export function getStepTicks(steps: number[]): number[] {
  if (steps.length === 0) {
    return [];
  }
  if (steps.length <= 3) {
    return steps;
  }

  const first = steps[0] ?? 0;
  const middle = steps[Math.floor((steps.length - 1) / 2)] ?? first;
  const last = steps[steps.length - 1] ?? middle;

  return [...new Set([first, middle, last])];
}

function buildRunSeries(run: RawRun): RunSeries {
  const pointByStep = new Map<number, { reward: number | null; metrics: Record<string, number> }>();
  const metricKeySet = new Set<string>();

  const rawMetricRows = run.metrics_payload?.metrics;
  if (Array.isArray(rawMetricRows)) {
    for (const row of rawMetricRows) {
      const metricRow = toObject(row);
      if (!metricRow) {
        continue;
      }

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

  const rolloutsByStep = run.rollout_payloads_by_step ?? {};
  for (const [stepKey, stepPayload] of Object.entries(rolloutsByStep)) {
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
      const sample = toObject(rawSample);
      if (!sample) {
        continue;
      }

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

  const steps = [...pointByStep.keys()].sort((a, b) => a - b);
  const rewardByStep = new Map<number, number>();
  const metricsByStep = new Map<number, Record<string, number>>();

  for (const step of steps) {
    const point = pointByStep.get(step) ?? { reward: null, metrics: {} };
    if (point.reward !== null) {
      rewardByStep.set(step, point.reward);
    }

    if (Object.keys(point.metrics).length > 0) {
      metricsByStep.set(step, point.metrics);
    }
  }

  return {
    steps,
    rewardByStep,
    metricsByStep,
    metricKeys: sortMetricKeys(metricKeySet),
  };
}

function extractEnvironmentMeta(run: RawRun): {
  environment: string;
  version: string | null;
  versionId: string | null;
} {
  const rawEnvironment = run.run_payload?.run?.environments?.[0];

  const environment = rawEnvironment?.id ?? "unknown-environment";
  const version = typeof rawEnvironment?.version === "string" ? rawEnvironment.version : null;
  const versionId = typeof rawEnvironment?.version_id === "string" ? rawEnvironment.version_id : null;

  return {
    environment,
    version,
    versionId,
  };
}

export function buildRunSummaries(data: RawRolloutsData): RunSummary[] {
  return data.runs
    .map((run) => {
      const meta = run.run_payload?.run;
      const progress = (run.progress_payload ?? {}) as ProgressPayload;
      const runId = meta?.id ?? run.run_id;
      const name = meta?.name ?? run.run_id;
      const { environment, version, versionId } = extractEnvironmentMeta(run);
      const model = meta?.base_model ?? "-";
      const { status, label: statusLabel } = normalizeStatus(meta?.status);
      const latestStep = extractLatestStep(progress);
      const maxSteps = toNumber(meta?.max_steps);
      const progressRatio =
        maxSteps && maxSteps > 0 ? Math.min(1, Math.max(0, latestStep / maxSteps)) : 0;
      const progressLabel =
        maxSteps && maxSteps > 0 ? `${Math.min(latestStep, maxSteps)}/${maxSteps}` : `${latestStep}`;

      const explicitDuration = toNumber(meta?.duration_s);
      const startedAt = toTimestamp(meta?.started_at);
      const completedAt = toTimestamp(meta?.completed_at);
      const fallbackDurationSeconds =
        startedAt !== null
          ? Math.max(0, ((completedAt ?? Date.now()) - startedAt) / 1_000)
          : null;
      const durationLabel = formatDuration(explicitDuration ?? fallbackDurationSeconds);

      const lastUpdatedAt =
        toTimestamp(progress.last_updated_at) ??
        toTimestamp(meta?.updated_at) ??
        toTimestamp(meta?.completed_at) ??
        toTimestamp(meta?.created_at);
      const lastUpdatedLabel = formatRelativeTime(lastUpdatedAt);

      return {
        key: runId,
        run,
        runId,
        name,
        environment,
        environmentVersion: version,
        environmentVersionId: versionId,
        model,
        status,
        statusLabel,
        latestStep,
        maxSteps,
        progressRatio,
        progressLabel,
        durationLabel,
        lastUpdatedAt,
        lastUpdatedLabel,
        series: buildRunSeries(run),
      };
    })
    .sort((a, b) => (b.lastUpdatedAt ?? 0) - (a.lastUpdatedAt ?? 0));
}

export function buildEnvironmentGroups(runs: RunSummary[]): EnvironmentGroup[] {
  const grouped = new Map<
    string,
    {
      environment: string;
      runs: RunSummary[];
      latestUpdatedAt: number | null;
      versionSet: Set<string>;
      versionIdSet: Set<string>;
      metricKeySet: Set<string>;
      statusCounts: Record<RunStatus, number>;
    }
  >();

  for (const run of runs) {
    const key = run.environment;

    const current =
      grouped.get(key) ??
      {
        environment: run.environment,
        runs: [],
        latestUpdatedAt: null,
        versionSet: new Set<string>(),
        versionIdSet: new Set<string>(),
        metricKeySet: new Set<string>(),
        statusCounts: {
          COMPLETED: 0,
          RUNNING: 0,
          STOPPED: 0,
          FAILED: 0,
          UNKNOWN: 0,
        },
      };

    current.runs.push(run);
    current.latestUpdatedAt = Math.max(current.latestUpdatedAt ?? 0, run.lastUpdatedAt ?? 0);
    if (run.environmentVersion) {
      current.versionSet.add(run.environmentVersion);
    }
    if (run.environmentVersionId) {
      current.versionIdSet.add(run.environmentVersionId);
    }
    current.statusCounts[run.status] += 1;

    for (const metricKey of run.series.metricKeys) {
      current.metricKeySet.add(metricKey);
    }

    grouped.set(key, current);
  }

  return [...grouped.values()]
    .map((group) => ({
      key: group.environment,
      environment: group.environment,
      versions: [...group.versionSet].sort((a, b) => a.localeCompare(b)),
      versionIds: [...group.versionIdSet].sort((a, b) => a.localeCompare(b)),
      runs: group.runs,
      latestUpdatedAt: group.latestUpdatedAt,
      metricKeys: sortMetricKeys(group.metricKeySet),
      statusCounts: group.statusCounts,
    }))
    .sort((a, b) => {
      const delta = (b.latestUpdatedAt ?? 0) - (a.latestUpdatedAt ?? 0);
      if (delta !== 0) {
        return delta;
      }
      return a.environment.localeCompare(b.environment);
    });
}

export function statusBadgeClasses(status: RunStatus): string {
  switch (status) {
    case "COMPLETED":
      return "border-emerald-500/30 bg-emerald-500/15 text-emerald-300";
    case "RUNNING":
      return "border-sky-500/30 bg-sky-500/15 text-sky-300";
    case "FAILED":
      return "border-rose-500/30 bg-rose-500/15 text-rose-300";
    case "STOPPED":
      return "border-zinc-600/60 bg-zinc-700/40 text-zinc-300";
    default:
      return "border-zinc-600/60 bg-zinc-700/40 text-zinc-300";
  }
}

export function shortVersionId(versionId: string): string {
  if (versionId.length <= 10) {
    return versionId;
  }
  return `${versionId.slice(0, 8)}…`;
}

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

export function pickDefaultMetricKeys(metricKeys: string[]): string[] {
  return metricKeys.slice(0, 6);
}

export function buildRunColorMap(runs: RunSummary[]): Record<string, string> {
  const colorByRunId: Record<string, string> = {};
  runs.forEach((run, index) => {
    colorByRunId[run.runId] = RUN_COLOR_PALETTE[index % RUN_COLOR_PALETTE.length] ?? "#7c5cff";
  });
  return colorByRunId;
}

export function buildRewardChartData(selectedRuns: RunSummary[]): { data: ChartPoint[]; stepTicks: number[] } {
  const stepSet = new Set<number>();
  for (const run of selectedRuns) {
    run.series.steps.forEach((step) => stepSet.add(step));
  }

  const steps = [...stepSet].sort((a, b) => a - b);
  const data = steps.map((step) => {
    const row: ChartPoint = { step };
    for (const run of selectedRuns) {
      row[run.runId] = run.series.rewardByStep.get(step) ?? null;
    }
    return row;
  });

  return {
    data,
    stepTicks: getStepTicks(steps),
  };
}

export function buildMetricChartData(selectedRuns: RunSummary[], metricKey: string): ChartPoint[] {
  const stepSet = new Set<number>();
  for (const run of selectedRuns) {
    run.series.steps.forEach((step) => stepSet.add(step));
  }

  const steps = [...stepSet].sort((a, b) => a - b);
  return steps.map((step) => {
    const row: ChartPoint = { step };
    for (const run of selectedRuns) {
      const metrics = run.series.metricsByStep.get(step);
      row[run.runId] = metrics?.[metricKey] ?? null;
    }
    return row;
  });
}

export function RunsHome({ data }: { data: RawRolloutsData }) {
  const runSummaries = React.useMemo(() => buildRunSummaries(data), [data]);
  const environmentGroups = React.useMemo(
    () => buildEnvironmentGroups(runSummaries),
    [runSummaries],
  );

  const [activeEnvironmentKey, setActiveEnvironmentKey] = React.useState<string | null>(
    environmentGroups[0]?.key ?? null,
  );
  const [selectedRunIdsByEnvironment, setSelectedRunIdsByEnvironment] = React.useState<
    Record<string, string[]>
  >({});
  const [hasLoadedRunSelections, setHasLoadedRunSelections] = React.useState(false);

  React.useEffect(() => {
    if (environmentGroups.length === 0) {
      setActiveEnvironmentKey(null);
      return;
    }

    if (!activeEnvironmentKey || !environmentGroups.some((group) => group.key === activeEnvironmentKey)) {
      setActiveEnvironmentKey(environmentGroups[0]?.key ?? null);
    }
  }, [activeEnvironmentKey, environmentGroups]);

  React.useEffect(() => {
    setSelectedRunIdsByEnvironment(readRunSelectionStore());
    setHasLoadedRunSelections(true);
  }, []);

  const activeGroup = React.useMemo(() => {
    if (environmentGroups.length === 0) {
      return null;
    }
    return environmentGroups.find((group) => group.key === activeEnvironmentKey) ?? environmentGroups[0] ?? null;
  }, [activeEnvironmentKey, environmentGroups]);

  React.useEffect(() => {
    if (!hasLoadedRunSelections || !activeGroup) {
      return;
    }

    setSelectedRunIdsByEnvironment((current) => {
      const existing = current[activeGroup.key] ?? [];
      const validRunIds = new Set(activeGroup.runs.map((run) => run.runId));
      const filtered = existing.filter((runId) => validRunIds.has(runId));

      const nextSelection =
        filtered.length > 0
          ? filtered
          : activeGroup.runs.slice(0, Math.min(4, activeGroup.runs.length)).map((run) => run.runId);

      if (arraysEqual(existing, nextSelection)) {
        return current;
      }

      return {
        ...current,
        [activeGroup.key]: nextSelection,
      };
    });
  }, [activeGroup, hasLoadedRunSelections]);

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

  const runColorById = React.useMemo(
    () => buildRunColorMap(activeGroup?.runs ?? []),
    [activeGroup],
  );

  const compareHref = React.useMemo(() => {
    const params = new URLSearchParams();
    if (activeGroup?.key) {
      params.set("environment", activeGroup.key);
    }
    if (selectedRunIds.length > 0) {
      params.set("runs", selectedRunIds.join(","));
    }
    const search = params.toString();
    return search ? `/compare?${search}` : "/compare";
  }, [activeGroup, selectedRunIds]);

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
      <div className="flex h-full flex-col">
        <header className="border-b border-zinc-900">
          <div className="px-4 py-4 sm:px-6">
            <h1 className="text-xl font-semibold tracking-tight">Training</h1>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6 sm:py-5">
          {environmentGroups.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-zinc-900 bg-[#060606] px-6 py-14 text-center text-zinc-500">
              No runs found.
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
              <aside className="flex min-h-0 flex-col rounded-xl border border-zinc-900 bg-[#060606] p-3">
                <p className="px-2 pb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Environments
                </p>
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="flex flex-col gap-1.5">
                    {environmentGroups.map((group) => {
                      const isActive = group.key === activeGroup?.key;
                      return (
                        <button
                          key={group.key}
                          type="button"
                          onClick={() => setActiveEnvironmentKey(group.key)}
                          className={cn(
                            "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                            isActive
                              ? "border-zinc-600 bg-zinc-900 text-zinc-100"
                              : "border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900/70 hover:text-zinc-200",
                          )}
                        >
                          <p className="truncate text-sm font-medium">{group.environment}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </aside>

              <div className="flex min-h-0 flex-col gap-4">
                {activeGroup ? (
                  <>
                    <h2 className="shrink-0 text-lg font-semibold text-zinc-100">
                      {activeGroup.environment}
                    </h2>

                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-900 bg-[#060606]">
                      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zinc-900 px-4 py-2.5">
                        <p className="text-sm font-medium text-zinc-300">Runs</p>
                        <div className="flex items-center gap-2">
                          <span className="hidden text-xs text-zinc-500 sm:inline">
                            Selections auto-saved
                          </span>
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
                          {selectedRunIds.length > 0 ? (
                            <Button
                              asChild
                              variant="secondary"
                              size="sm"
                              className="bg-zinc-700 text-zinc-100 hover:bg-zinc-600"
                            >
                              <Link href={compareHref}>Compare Runs</Link>
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              className="bg-zinc-800 text-zinc-500"
                              disabled
                            >
                              Compare Runs
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="min-h-0 flex-1 overflow-auto">
                        <Table className="min-w-[980px]">
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
                              <TableHead className="text-zinc-400">Environment Version</TableHead>
                              <TableHead className="text-zinc-400">Model</TableHead>
                              <TableHead className="text-zinc-400">Last Updated</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activeGroup.runs.map((run) => {
                              const href = `/run/${encodeURIComponent(run.runId)}`;
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
                                  <TableCell className="max-w-[340px] font-medium text-zinc-100">
                                    <Link href={href} className="block">
                                      <div className="flex items-center gap-2">
                                        <span
                                          className="size-2.5 shrink-0 rounded-full"
                                          style={{ backgroundColor: runColor }}
                                        />
                                        <span className="truncate">{run.name}</span>
                                      </div>
                                      <div className="mt-0.5 truncate text-xs text-zinc-500">
                                        {run.runId}
                                      </div>
                                    </Link>
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
                                  <TableCell className="w-[220px]">
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
                                  <TableCell className="max-w-[240px] text-zinc-300">
                                    <div className="truncate">
                                      {run.environmentVersion ? `v${run.environmentVersion}` : "-"}
                                    </div>
                                    <div
                                      className="truncate font-mono text-xs text-zinc-500"
                                      title={run.environmentVersionId ?? ""}
                                    >
                                      {run.environmentVersionId
                                        ? shortVersionId(run.environmentVersionId)
                                        : "-"}
                                    </div>
                                  </TableCell>
                                  <TableCell className="max-w-[300px] truncate text-zinc-300">
                                    {run.model}
                                  </TableCell>
                                  <TableCell className="text-zinc-300">{run.lastUpdatedLabel}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
