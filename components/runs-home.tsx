"use client";

import * as React from "react";
import { MoreVertical } from "lucide-react";
import Link from "next/link";

import type { RawRolloutsData, RawRun } from "@/components/run-rollouts";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type RunStatus = "COMPLETED" | "RUNNING" | "STOPPED" | "FAILED" | "UNKNOWN";

type ProgressPayload = {
  latest_step?: number | string;
  steps_with_samples?: unknown[];
  last_updated_at?: string;
};

type RunSummary = {
  key: string;
  run: RawRun;
  runId: string;
  name: string;
  environment: string;
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
};

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

function formatRelativeTime(timestamp: number | null): string {
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

function buildRunSummaries(data: RawRolloutsData): RunSummary[] {
  return data.runs
    .map((run) => {
      const meta = run.run_payload?.run;
      const progress = (run.progress_payload ?? {}) as ProgressPayload;
      const runId = meta?.id ?? run.run_id;
      const name = meta?.name ?? run.run_id;
      const environment = meta?.environments?.[0]?.id ?? "-";
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
      };
    })
    .sort((a, b) => (b.lastUpdatedAt ?? 0) - (a.lastUpdatedAt ?? 0));
}

function statusBadgeClasses(status: RunStatus): string {
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

export function RunsHome({ data }: { data: RawRolloutsData }) {
  const runSummaries = React.useMemo(() => buildRunSummaries(data), [data]);

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-zinc-900 px-4 py-5 sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">Training</h1>
              <Badge
                variant="outline"
                className="h-5 border-zinc-700 bg-zinc-900 text-[11px] text-zinc-300"
              >
                Beta
              </Badge>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              Hosted RL trainings on environments
            </p>
          </div>
        </header>

        <section className="flex-1 px-4 py-4 sm:px-6 sm:py-5">
          <div className="overflow-hidden rounded-xl border border-zinc-900 bg-[#060606]">
            <Table className="min-w-[900px]">
              <TableHeader className="bg-zinc-950/80">
                <TableRow className="border-zinc-900 hover:bg-zinc-950/80">
                  <TableHead className="text-zinc-400">Name</TableHead>
                  <TableHead className="text-zinc-400">Environment</TableHead>
                  <TableHead className="text-zinc-400">Model</TableHead>
                  <TableHead className="text-zinc-400">Status</TableHead>
                  <TableHead className="text-zinc-400">Progress</TableHead>
                  <TableHead className="text-zinc-400">Last Updated</TableHead>
                  <TableHead className="w-10 px-4 text-zinc-400" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {runSummaries.length === 0 ? (
                  <TableRow className="border-zinc-900">
                    <TableCell colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                      No runs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  runSummaries.map((run) => {
                    const href = `/run/${encodeURIComponent(run.runId)}`;

                    return (
                      <TableRow
                        key={run.key}
                        className="border-zinc-900 hover:bg-zinc-900/60"
                      >
                        <TableCell className="max-w-[300px] font-medium text-zinc-100">
                          <Link href={href} className="block">
                            <div className="truncate">{run.name}</div>
                            <div className="mt-0.5 truncate text-xs text-zinc-500">
                              {run.runId}
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[250px] truncate text-zinc-300">
                          <Link href={href} className="block truncate">
                            {run.environment}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-zinc-300">
                          <Link href={href} className="block truncate">
                            {run.model}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={href} className="block">
                            <Badge
                              variant="outline"
                              className={cn(
                                "h-6 border font-semibold",
                                statusBadgeClasses(run.status),
                              )}
                            >
                              {run.statusLabel}
                            </Badge>
                          </Link>
                        </TableCell>
                        <TableCell className="w-[220px]">
                          <Link href={href} className="block">
                            <div className="space-y-1.5">
                              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                                <div
                                  className="h-full rounded-full bg-zinc-200"
                                  style={{ width: `${Math.round(run.progressRatio * 100)}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                                <span>{run.durationLabel}</span>
                                <span>{run.progressLabel}</span>
                              </div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="text-zinc-300">
                          <Link href={href} className="block">
                            {run.lastUpdatedLabel}
                          </Link>
                        </TableCell>
                        <TableCell className="px-4">
                          <Link
                            href={href}
                            className="inline-flex rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                          >
                            <MoreVertical className="size-4" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </main>
  );
}
