"use client";

import * as React from "react";
import { Check, ChevronDown, Copy, Link2, MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StepSliderControl } from "@/components/step-slider-control";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
  completion?: unknown;
  answer?: unknown;
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

type RunEnvironment = {
  id?: string;
};

type RunPayloadRun = {
  id?: string;
  name?: string;
  status?: string;
  base_model?: string;
  max_steps?: number | string;
  environments?: RunEnvironment[];
};

type RunPayload = {
  run?: RunPayloadRun;
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
  selectionKey: string;
  step: number | null;
  key: string;
  id: string;
  task: string;
  prompt: string;
  info: string;
  reward: number | null;
  metrics: JsonObject;
  numTurns: number | null;
  sample: RawSample;
};

type ConversationMessage = {
  key: string;
  role: string;
  content: string;
};

type SelectedRolloutEntry = {
  run_id: string;
  run_name: string;
  step: number | null;
  row: Row;
};

function getRolloutSelectionKey(runId: string, step: number | null, rowKey: string): string {
  return `${runId}::${step ?? "na"}::${rowKey}`;
}

function formatStepLabel(step: number | null): string {
  return step === null ? "n/a" : String(step);
}

function compareSampleIds(a: unknown, b: unknown): number {
  const aNum = typeof a === "number" ? a : Number(a);
  const bNum = typeof b === "number" ? b : Number(b);
  const aIsNum = Number.isFinite(aNum);
  const bIsNum = Number.isFinite(bNum);
  if (aIsNum && bIsNum) {
    return aNum - bNum;
  }
  return String(a ?? "").localeCompare(String(b ?? ""));
}

function formatRoleLabel(role: string): string {
  if (!role) {
    return "Message";
  }
  return `${role.charAt(0).toUpperCase()}${role.slice(1)}`;
}

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

function stringifyContent(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
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

function extractConversationMessages(sample: RawSample): ConversationMessage[] {
  const messages: ConversationMessage[] = [];

  const appendMessages = (source: unknown, prefix: string) => {
    const parsed = parseMaybeJson(source);
    if (!Array.isArray(parsed)) {
      return;
    }

    let localIndex = 0;
    for (const item of parsed) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        continue;
      }
      const roleRaw = (item as JsonObject).role;
      const contentRaw = (item as JsonObject).content;
      const role = typeof roleRaw === "string" ? roleRaw : "message";
      const content = stringifyContent(contentRaw);
      messages.push({
        key: `${prefix}:${localIndex}:${role}`,
        role,
        content,
      });
      localIndex += 1;
    }
  };

  appendMessages(sample.prompt, "prompt");
  appendMessages(sample.completion, "completion");

  if (messages.length === 0) {
    const answer = stringifyContent(sample.answer);
    if (answer.trim() !== "") {
      messages.push({
        key: "answer:0:assistant",
        role: "assistant",
        content: answer,
      });
    }
  }

  return messages;
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

  const runName = run?.run_payload?.run?.name ?? run?.run_id ?? "No run loaded";
  const runId = run?.run_payload?.run?.id ?? run?.run_id ?? "unknown-run";

  const rows = React.useMemo<Row[]>(() => {
    return activeSamples.map((sample, index) => {
      const metrics = extractMetrics(sample);
      const numTurns = toNumber(metrics.num_turns);
      const idValue = sample.problem_id ?? sample.sample_id ?? index;
      const rowKey = `${activeStep ?? "na"}:${sample.problem_id ?? "na"}:${sample.sample_id ?? "na"}:${index}`;
      const selectionKey = getRolloutSelectionKey(runId, activeStep, rowKey);

      return {
        selectionKey,
        step: activeStep,
        key: rowKey,
        id: String(idValue),
        task: typeof sample.task === "string" ? sample.task : "-",
        prompt: extractPromptText(sample.prompt),
        info: extractInfoText(sample),
        reward: toNumber(sample.reward),
        metrics,
        numTurns,
        sample,
      };
    });
  }, [activeSamples, activeStep, runId]);

  const [isDialogOpen, setDialogOpen] = React.useState(false);
  const [dialogRolloutIndex, setDialogRolloutIndex] = React.useState(0);
  const [expandedMessageKeys, setExpandedMessageKeys] = React.useState<string[]>([]);
  const [selectedRollouts, setSelectedRollouts] = React.useState<
    Record<string, SelectedRolloutEntry>
  >({});
  const [copyStatus, setCopyStatus] = React.useState<"idle" | "copied" | "error">("idle");

  const selectedCount = React.useMemo(
    () => Object.keys(selectedRollouts).length,
    [selectedRollouts],
  );

  const visibleSelection = React.useMemo(() => {
    const total = rows.length;
    let selected = 0;
    for (const row of rows) {
      if (selectedRollouts[row.selectionKey]) {
        selected += 1;
      }
    }
    return {
      total,
      selected,
      allSelected: total > 0 && selected === total,
    };
  }, [rows, selectedRollouts]);

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

  const toggleRolloutSelection = React.useCallback(
    (row: Row, checked: boolean) => {
      setSelectedRollouts((current) => {
        const next = { ...current };
        if (checked) {
          next[row.selectionKey] = {
            run_id: runId,
            run_name: runName,
            step: row.step,
            row,
          };
        } else {
          delete next[row.selectionKey];
        }
        return next;
      });
      setCopyStatus("idle");
    },
    [runId, runName],
  );

  const toggleVisibleSelection = React.useCallback(
    (checked: boolean) => {
      setSelectedRollouts((current) => {
        const next = { ...current };
        for (const row of rows) {
          if (checked) {
            next[row.selectionKey] = {
              run_id: runId,
              run_name: runName,
              step: row.step,
              row,
            };
          } else {
            delete next[row.selectionKey];
          }
        }
        return next;
      });
      setCopyStatus("idle");
    },
    [rows, runId, runName],
  );

  const selectedRollout =
    rows.length > 0
      ? rows[Math.min(Math.max(dialogRolloutIndex, 0), rows.length - 1)]
      : null;

  const selectedMessages = React.useMemo(
    () => (selectedRollout ? extractConversationMessages(selectedRollout.sample) : []),
    [selectedRollout],
  );

  React.useEffect(() => {
    if (dialogRolloutIndex >= rows.length) {
      setDialogRolloutIndex(0);
    }
  }, [dialogRolloutIndex, rows.length]);

  React.useEffect(() => {
    const lastMessageKey =
      selectedMessages.length > 0
        ? selectedMessages[selectedMessages.length - 1]?.key
        : undefined;
    setExpandedMessageKeys(lastMessageKey ? [lastMessageKey] : []);
  }, [selectedRollout?.key, selectedMessages]);

  const toggleMessage = React.useCallback((key: string) => {
    setExpandedMessageKeys((current) => {
      if (current.includes(key)) {
        return current.filter((item) => item !== key);
      }
      return [...current, key];
    });
  }, []);

  const collapseAll = React.useCallback(() => {
    setExpandedMessageKeys([]);
  }, []);

  const expandAll = React.useCallback(() => {
    setExpandedMessageKeys(selectedMessages.map((message) => message.key));
  }, [selectedMessages]);

  const copySelectedRollouts = React.useCallback(async () => {
    const items = Object.values(selectedRollouts).sort((a, b) => {
      if (a.run_id !== b.run_id) {
        return a.run_id.localeCompare(b.run_id);
      }
      const aStep = a.step ?? Number.POSITIVE_INFINITY;
      const bStep = b.step ?? Number.POSITIVE_INFINITY;
      if (aStep !== bStep) {
        return aStep - bStep;
      }
      return compareSampleIds(a.row.sample.sample_id, b.row.sample.sample_id);
    });

    const runs = data?.runs ?? [];
    const runById = new Map<string, RawRun>();
    for (const rawRun of runs) {
      const id = rawRun.run_payload?.run?.id ?? rawRun.run_id;
      runById.set(id, rawRun);
    }

    const lines: string[] = [];
    lines.push("# RL Rollout Export");
    lines.push(`Exported At: ${new Date().toISOString()}`);
    lines.push(`Selected Rollouts: ${items.length}`);
    lines.push("");

    const uniqueRunIds = [...new Set(items.map((item) => item.run_id))];
    lines.push("## Run Summary");
    for (const runKey of uniqueRunIds) {
      const sourceRun = runById.get(runKey);
      const meta = sourceRun?.run_payload?.run;
      const envId = meta?.environments?.[0]?.id;
      lines.push(`- Run ID: ${runKey}`);
      lines.push(`  - Name: ${meta?.name ?? sourceRun?.run_id ?? "n/a"}`);
      lines.push(`  - Environment: ${envId ?? "n/a"}`);
      lines.push(`  - Model: ${meta?.base_model ?? "n/a"}`);
      lines.push(`  - Status: ${meta?.status ?? "n/a"}`);
      lines.push(`  - Max Steps: ${meta?.max_steps ?? "n/a"}`);
    }
    lines.push("");

    for (const runKey of uniqueRunIds) {
      const sourceRun = runById.get(runKey);
      const meta = sourceRun?.run_payload?.run;
      const envId = meta?.environments?.[0]?.id;
      lines.push(`## Run ${runKey}`);
      lines.push(`- Name: ${meta?.name ?? sourceRun?.run_id ?? "n/a"}`);
      lines.push(`- Environment: ${envId ?? "n/a"}`);
      lines.push(`- Model: ${meta?.base_model ?? "n/a"}`);
      lines.push(`- Status: ${meta?.status ?? "n/a"}`);
      lines.push("");

      const runItems = items.filter((item) => item.run_id === runKey);
      const uniqueSteps = [...new Set(runItems.map((item) => formatStepLabel(item.step)))];

      for (const stepLabel of uniqueSteps) {
        lines.push(`### Checkpoint ${stepLabel}`);
        lines.push("");

        const stepItems = runItems
          .filter((item) => formatStepLabel(item.step) === stepLabel)
          .sort((a, b) => compareSampleIds(a.row.sample.sample_id, b.row.sample.sample_id));

        stepItems.forEach((item, index) => {
          const sample = item.row.sample;
          const messages = extractConversationMessages(sample);
          lines.push(
            `#### Rollout ${index + 1} (sample_id=${sample.sample_id ?? "n/a"}, problem_id=${
              sample.problem_id ?? "n/a"
            }, reward=${displayNumber(item.row.reward)})`,
          );
          lines.push("");

          if (messages.length > 0) {
            for (const message of messages) {
              lines.push(`${formatRoleLabel(message.role)}:`);
              lines.push("````text");
              lines.push(message.content || "");
              lines.push("````");
              lines.push("");
            }
          } else {
            lines.push("Messages:");
            lines.push("````text");
            lines.push("(no messages)");
            lines.push("````");
            lines.push("");
          }

          lines.push("Metadata:");
          lines.push("````json");
          lines.push(
            JSON.stringify(
              {
                step: item.step,
                run_id: item.run_id,
                sample_id: sample.sample_id ?? null,
                problem_id: sample.problem_id ?? null,
                reward: item.row.reward,
                metrics: item.row.metrics,
                info: sample.info ?? null,
              },
              null,
              2,
            ),
          );
          lines.push("````");
          lines.push("");
        });
      }
    }

    const text = lines.join("\n");

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      } else {
        throw new Error("Clipboard unavailable");
      }
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }, [data?.runs, selectedRollouts]);

  React.useEffect(() => {
    if (copyStatus !== "copied") {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setCopyStatus("idle"), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

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
                <Link2 className="size-4" />
                Share
              </Button>
              <Button
                variant="secondary"
                className="bg-zinc-800 text-xs text-zinc-100 hover:bg-zinc-700 md:text-sm"
              >
                View trained LoRA
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                aria-label="More options"
              >
                <MoreVertical className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[2100px] px-3 pb-4 pt-5 md:px-6 md:pb-6 md:pt-6">
        <Tabs defaultValue="data" className="w-full gap-4">
          <TabsList className="h-9 w-fit shrink-0 bg-zinc-800 p-1">
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
              <Table className="min-w-[1230px] table-fixed border-separate border-spacing-0 text-sm">
                <colgroup>
                  <col className="w-10" />
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
                <TableHeader className="[&_th]:border-b [&_th]:border-b-white/10">
                  <TableRow className="border-b-0 hover:bg-transparent">
                    <TableHead className="h-9 w-10 min-w-10 px-3 py-2 font-medium text-zinc-400">
                      <Checkbox
                        checked={
                          visibleSelection.allSelected
                            ? true
                            : visibleSelection.selected > 0
                              ? "indeterminate"
                              : false
                        }
                        onCheckedChange={(checked) => toggleVisibleSelection(checked === true)}
                        aria-label="Select visible rollouts"
                        onClick={(event) => event.stopPropagation()}
                      />
                    </TableHead>
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
                <TableBody className="[&_tr:last-child_td]:border-b-0">
                  {rows.map((row, index) => (
                    <TableRow
                      key={row.key}
                      className={`cursor-pointer transition-colors border-b-0 hover:!bg-white/[0.08] ${
                        index % 2 === 0 ? "bg-white/[0.02]" : ""
                      } ${selectedRollouts[row.selectionKey] ? "bg-violet-500/[0.12]" : ""}`}
                      onClick={() => {
                        setDialogRolloutIndex(index);
                        setDialogOpen(true);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setDialogRolloutIndex(index);
                          setDialogOpen(true);
                        }
                      }}
                      tabIndex={0}
                    >
                      <TableCell className="max-w-10 border-b border-white/5 px-3 py-2">
                        <Checkbox
                          checked={Boolean(selectedRollouts[row.selectionKey])}
                          onCheckedChange={(checked) =>
                            toggleRolloutSelection(row, checked === true)
                          }
                          aria-label={`Select rollout ${row.id}`}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell className="max-w-10 truncate border-b border-white/5 px-3 py-2 text-sm text-zinc-300">
                        {row.id}
                      </TableCell>
                      <TableCell className="max-w-44 truncate border-b border-white/5 px-3 py-2 font-mono text-xs text-zinc-400">
                        {row.task}
                      </TableCell>
                      <TableCell className="max-w-[350px] truncate border-b border-white/5 px-3 py-2 font-mono text-xs text-zinc-200">
                        {row.prompt || "-"}
                      </TableCell>
                      <TableCell className="max-w-56 truncate border-b border-white/5 px-3 py-2 font-mono text-xs text-zinc-500">
                        {row.info}
                      </TableCell>
                      <TableCell className="border-b border-white/5 px-3 py-2 text-right text-sm font-semibold text-emerald-400">
                        {displayNumber(row.reward)}
                      </TableCell>
                      {rewardColumns.map((column) => (
                        <TableCell
                          key={column}
                          className="border-b border-white/5 px-3 py-2 text-right text-sm text-zinc-300"
                        >
                          {displayNumber(toNumber(row.metrics[column]))}
                        </TableCell>
                      ))}
                      <TableCell className="border-b border-white/5 px-3 py-2 text-right text-sm text-zinc-300">
                        {displayNumber(row.numTurns)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 ? (
                    <TableRow className="border-b border-white/5">
                      <TableCell
                        colSpan={7 + rewardColumns.length}
                        className="py-8 text-center text-sm text-zinc-500"
                      >
                        No rollout data available for this step.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-start justify-end gap-4">
              <StepSliderControl
                steps={steps}
                stepIndex={stepIndex}
                onStepIndexChange={handleStepIndexChange}
                inline
                trailingAction={
                  <Button
                    variant="secondary"
                    className="h-8 justify-start bg-zinc-800 px-3 text-xs font-semibold text-zinc-100 hover:bg-zinc-700"
                    onClick={() => void copySelectedRollouts()}
                    disabled={selectedCount === 0}
                  >
                    <span className="relative inline-flex items-center whitespace-nowrap text-left">
                        <span className="invisible whitespace-nowrap">{`Copy Rollouts (${selectedCount})`}</span>
                      <span className="absolute inset-0 inline-flex items-center gap-1.5 whitespace-nowrap">
                        {copyStatus === "copied" ? (
                          <>
                            <span>Copied</span>
                            <Check className="size-3.5 text-emerald-400" />
                          </>
                        ) : copyStatus === "error" ? (
                          "Copy Failed"
                        ) : (
                          `Copy Rollouts (${selectedCount})`
                        )}
                      </span>
                    </span>
                  </Button>
                }
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden border border-white/10 bg-[#141414] p-0 text-zinc-100 sm:max-w-[calc(100vw-2rem)]"
          showCloseButton
        >
          <DialogTitle className="sr-only">Rollout Conversation</DialogTitle>
          <div className="grid h-full min-h-0 grid-cols-[280px_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col border-r border-white/10">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <h3 className="text-sm font-semibold text-zinc-100">Rollouts</h3>
                <p className="text-xs text-zinc-500">
                  {rows.length > 0
                    ? `${Math.min(dialogRolloutIndex + 1, rows.length)}/${rows.length}`
                    : "0/0"}
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                <div className="space-y-1.5">
                  {rows.map((row, index) => {
                    const isActive = index === dialogRolloutIndex;
                    const isChecked = Boolean(selectedRollouts[row.selectionKey]);
                    return (
                      <div
                        key={`${row.key}:dialog-item`}
                        className={`w-full rounded-md border px-2 py-2 transition-colors ${
                          isActive
                            ? "border-white/15 bg-black/80"
                            : "border-transparent bg-white/[0.02] hover:bg-white/[0.06]"
                        } ${isChecked ? "ring-1 ring-violet-500/60" : ""}`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="pt-0.5">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) =>
                                toggleRolloutSelection(row, checked === true)
                              }
                              aria-label={`Select rollout ${row.id} in dialog`}
                            />
                          </div>
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => setDialogRolloutIndex(index)}
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="text-xs text-zinc-400">#{row.id}</span>
                              <span className="text-sm font-semibold text-emerald-400">
                                {displayNumber(row.reward)}
                              </span>
                            </div>
                            <p className="line-clamp-2 text-xs text-zinc-300">
                              {row.prompt || "(no prompt text)"}
                            </p>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>

            <section className="flex min-h-0 flex-col">
              <div className="flex items-center gap-4 border-b border-white/10 px-4 py-3">
                <h3 className="text-sm font-semibold text-zinc-100">Conversation History</h3>
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <button
                    type="button"
                    className="hover:text-zinc-100"
                    onClick={collapseAll}
                  >
                    Collapse All
                  </button>
                  <span className="text-zinc-600">|</span>
                  <button
                    type="button"
                    className="hover:text-zinc-100"
                    onClick={expandAll}
                  >
                    Expand All
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3 pt-2">
                {selectedMessages.length > 0 ? (
                  selectedMessages.map((message) => {
                    const isExpanded = expandedMessageKeys.includes(message.key);
                    return (
                      <div
                        key={message.key}
                        className="overflow-hidden rounded-md border border-white/10 bg-black/50"
                      >
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
                          onClick={() => toggleMessage(message.key)}
                        >
                          <span className="text-xs font-semibold leading-none lowercase tracking-wide text-zinc-200">
                            {message.role}
                          </span>
                          <ChevronDown
                            className={`size-3.5 text-zinc-500 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        {isExpanded ? (
                          <div className="border-t border-white/10 px-4 py-2.5">
                            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-200">
                              {message.content}
                            </pre>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-md border border-white/10 bg-black/40 px-4 py-6 text-sm text-zinc-500">
                    No messages found for this rollout.
                  </div>
                )}
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
