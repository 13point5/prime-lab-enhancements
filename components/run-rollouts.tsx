"use client";

import * as React from "react";
import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StepSliderControl } from "@/components/step-slider-control";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type JsonObject = Record<string, unknown>;

type RawSample = {
  problem_id?: number | string | null;
  sample_id?: number | string | null;
  task?: string | null;
  prompt?: unknown;
  info?: unknown;
  reward?: unknown;
  metrics?: unknown;
  step?: number | string | null;
  tag?: string | null;
  num_output_tokens?: number | string | null;
};

type RawStepPayload = {
  samples?: unknown[];
};

type RunPayload = {
  run?: {
    id?: string;
    name?: string;
  };
};

export type RawRun = {
  run_id: string;
  run_payload?: RunPayload;
  rollout_payloads_by_step?: Record<string, RawStepPayload>;
};

export type RawRolloutsData = {
  runs?: RawRun[];
};

type Row = {
  key: string;
  id: string;
  task: string;
  prompt: string;
  info: string;
  reward: number | null;
  metrics: JsonObject;
  numTurns: number | null;
};

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

function compactText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractPromptText(promptRaw: unknown): string {
  const parsed = parseMaybeJson(promptRaw);
  if (Array.isArray(parsed)) {
    const messages = parsed.filter(
      (item): item is { role?: string; content?: unknown } =>
        !!item && typeof item === "object" && !Array.isArray(item),
    );

    const userMessage = messages.find((message) => message.role === "user");
    if (typeof userMessage?.content === "string") {
      return compactText(userMessage.content);
    }

    const systemMessage = messages.find((message) => message.role === "system");
    if (typeof systemMessage?.content === "string") {
      return compactText(systemMessage.content);
    }

    const firstText = messages.find(
      (message) => typeof message.content === "string",
    );
    if (typeof firstText?.content === "string") {
      return compactText(firstText.content);
    }
  }

  if (typeof parsed === "string") {
    return compactText(parsed);
  }

  return "";
}

function extractInfoText(sample: RawSample): string {
  const parsedInfo = toObject(sample.info);
  if (parsedInfo && Object.keys(parsedInfo).length > 0) {
    return JSON.stringify(parsedInfo);
  }

  const fallback: JsonObject = {};
  if (sample.step !== null && sample.step !== undefined) {
    fallback.step = sample.step;
  }
  if (sample.tag !== null && sample.tag !== undefined && sample.tag !== "") {
    fallback.tag = sample.tag;
  }
  if (
    sample.num_output_tokens !== null &&
    sample.num_output_tokens !== undefined
  ) {
    fallback.num_output_tokens = sample.num_output_tokens;
  }

  return JSON.stringify(fallback);
}

function extractMetrics(sample: RawSample): JsonObject {
  return toObject(sample.metrics) ?? {};
}

function displayNumber(value: number | null): string {
  if (value === null) {
    return "-";
  }
  return value.toFixed(2);
}

function samplesForStep(run: RawRun | null, step: number | null): RawSample[] {
  if (!run || step === null) {
    return [];
  }
  const payload = run.rollout_payloads_by_step?.[String(step)];
  if (!payload || !Array.isArray(payload.samples)) {
    return [];
  }
  return payload.samples.filter(
    (sample): sample is RawSample =>
      !!sample && typeof sample === "object" && !Array.isArray(sample),
  );
}

export function RunRollouts({ data }: { data: RawRolloutsData | null }) {
  const run = React.useMemo<RawRun | null>(() => {
    if (!data?.runs || data.runs.length === 0) {
      return null;
    }
    return data.runs[0] ?? null;
  }, [data]);

  const steps = React.useMemo<number[]>(() => {
    if (!run?.rollout_payloads_by_step) {
      return [];
    }
    return Object.keys(run.rollout_payloads_by_step)
      .map((key) => Number(key))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
  }, [run]);

  const [stepIndex, setStepIndex] = React.useState(0);

  React.useEffect(() => {
    setStepIndex(steps.length > 0 ? steps.length - 1 : 0);
  }, [run?.run_id, steps.length]);

  const activeStep = steps[stepIndex] ?? null;
  const activeSamples = React.useMemo(
    () => samplesForStep(run, activeStep),
    [run, activeStep],
  );

  const rewardColumns = React.useMemo<string[]>(() => {
    if (!run?.rollout_payloads_by_step) {
      return [];
    }

    const keys = new Set<string>();
    for (const payload of Object.values(run.rollout_payloads_by_step)) {
      if (!payload || !Array.isArray(payload.samples)) {
        continue;
      }

      for (const rawSample of payload.samples) {
        if (
          !rawSample ||
          typeof rawSample !== "object" ||
          Array.isArray(rawSample)
        ) {
          continue;
        }
        const sample = rawSample as RawSample;
        const metrics = extractMetrics(sample);
        for (const key of Object.keys(metrics)) {
          if (
            key !== "reward" &&
            key !== "num_turns" &&
            key.endsWith("_reward")
          ) {
            keys.add(key);
          }
        }
      }
    }

    return [...keys].sort((a, b) => a.localeCompare(b));
  }, [run]);

  const rows = React.useMemo<Row[]>(() => {
    return activeSamples.map((sample, index) => {
      const metrics = extractMetrics(sample);
      const numTurns = toNumber(metrics.num_turns);
      const idValue = sample.problem_id ?? sample.sample_id ?? index;

      return {
        key: `${activeStep ?? "na"}:${sample.problem_id ?? "na"}:${sample.sample_id ?? "na"}:${index}`,
        id: String(idValue),
        task: typeof sample.task === "string" ? sample.task : "-",
        prompt: extractPromptText(sample.prompt),
        info: extractInfoText(sample),
        reward: toNumber(sample.reward),
        metrics,
        numTurns,
      };
    });
  }, [activeSamples, activeStep]);

  const runName = run?.run_payload?.run?.name ?? run?.run_id ?? "No run loaded";
  const runId = run?.run_payload?.run?.id ?? run?.run_id ?? "-";
  const handleStepIndexChange = React.useCallback(
    (nextIndex: number) => {
      if (steps.length === 0) {
        setStepIndex(0);
        return;
      }
      const bounded = Math.min(Math.max(nextIndex, 0), steps.length - 1);
      setStepIndex(bounded);
    },
    [steps.length],
  );

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="mx-auto w-full max-w-[2100px] px-3 py-4 md:px-6 md:py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight md:text-xl">
                {runName}
              </h1>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                onClick={() => void navigator.clipboard.writeText(runId)}
                title="Copy run ID"
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="bg-zinc-800 text-xs text-zinc-100 hover:bg-zinc-700 md:text-sm"
            >
              Share
            </Button>
            <Button
              variant="secondary"
              className="bg-zinc-800 text-xs text-zinc-100 hover:bg-zinc-700 md:text-sm"
            >
              View trained LoRA
            </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[2100px] px-3 pb-4 pt-5 md:px-6 md:pb-6 md:pt-6">
        <Tabs defaultValue="data" className="w-full gap-4">
          <div className="flex flex-row flex-nowrap items-start justify-between gap-4">
            <TabsList className="h-9 shrink-0 bg-zinc-800 p-1">
            <TabsTrigger value="overview" className="text-xs md:text-sm">
              Overview
            </TabsTrigger>
            <TabsTrigger value="data" className="text-xs md:text-sm">
              Data
            </TabsTrigger>
            <TabsTrigger value="system" className="text-xs md:text-sm">
              System
            </TabsTrigger>
            <TabsTrigger value="resources" className="text-xs md:text-sm">
              Resources
            </TabsTrigger>
          </TabsList>
            <StepSliderControl
              steps={steps}
              stepIndex={stepIndex}
              onStepIndexChange={handleStepIndexChange}
              inline
            />
          </div>

          <TabsContent value="overview">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6 text-zinc-400">
              Overview tab placeholder.
            </div>
          </TabsContent>

          <TabsContent value="system">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6 text-zinc-400">
              System tab placeholder.
            </div>
          </TabsContent>

          <TabsContent value="resources">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6 text-zinc-400">
              Resources tab placeholder.
            </div>
          </TabsContent>

          <TabsContent value="data" className="space-y-4">
            <div
              className="overflow-auto rounded-md bg-[#141414]"
              style={{ border: "1px solid rgba(255, 255, 255, 0.05)" }}
            >
              <Table className="min-w-[1230px] table-fixed text-sm">
                <colgroup>
                  <col className="w-10" />
                  <col className="w-44" />
                  <col className="w-[350px]" />
                  <col className="w-56" />
                  <col className="w-32" />
                  {rewardColumns.map((col) => (
                    <col key={col} className="w-40" />
                  ))}
                  <col className="w-32" />
                </colgroup>
                <TableHeader>
                  <TableRow className="border-b border-white/5 hover:bg-transparent">
                    <TableHead className="h-9 w-10 min-w-10 px-3 py-2 font-medium text-zinc-400">
                      id
                    </TableHead>
                    <TableHead className="h-9 w-44 px-3 py-2 font-medium text-zinc-400">
                      task
                    </TableHead>
                    <TableHead className="h-9 w-[350px] px-3 py-2 font-medium text-zinc-400">
                      prompt
                    </TableHead>
                    <TableHead className="h-9 w-56 px-3 py-2 font-medium text-zinc-400">
                      info
                    </TableHead>
                    <TableHead className="h-9 w-32 px-3 py-2 text-right font-medium text-zinc-400">
                      reward
                    </TableHead>
                    {rewardColumns.map((column) => (
                      <TableHead
                        key={column}
                        className="h-9 w-40 px-3 py-2 text-right font-medium text-zinc-400"
                      >
                        {column}
                      </TableHead>
                    ))}
                    <TableHead className="h-9 w-32 px-3 py-2 text-right font-medium text-zinc-400">
                      num_turns
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow
                      key={row.key}
                      className={`border-b border-white/5 transition-colors hover:!bg-white/[0.08] ${
                        index % 2 === 0 ? "bg-white/[0.02]" : ""
                      }`}
                    >
                      <TableCell className="max-w-10 truncate px-3 py-2 text-sm text-zinc-300">
                        {row.id}
                      </TableCell>
                      <TableCell className="max-w-44 truncate px-3 py-2 font-mono text-xs text-zinc-400">
                        {row.task}
                      </TableCell>
                      <TableCell className="max-w-[350px] truncate px-3 py-2 font-mono text-xs text-zinc-200">
                        {row.prompt || "-"}
                      </TableCell>
                      <TableCell className="max-w-56 truncate px-3 py-2 font-mono text-xs text-zinc-500">
                        {row.info}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right text-sm font-semibold text-emerald-400">
                        {displayNumber(row.reward)}
                      </TableCell>
                      {rewardColumns.map((column) => (
                        <TableCell
                          key={column}
                          className="px-3 py-2 text-right text-sm text-zinc-300"
                        >
                          {displayNumber(toNumber(row.metrics[column]))}
                        </TableCell>
                      ))}
                      <TableCell className="px-3 py-2 text-right text-sm text-zinc-300">
                        {displayNumber(row.numTurns)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 ? (
                    <TableRow className="border-b border-white/5">
                      <TableCell
                        colSpan={6 + rewardColumns.length}
                        className="py-8 text-center text-sm text-zinc-500"
                      >
                        No rollout data available for this step.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
