"use client";

import * as React from "react";
import {
  ArrowLeft,
  Check,
  Columns2,
  Copy,
  Grid3x3,
  Link2,
  MoreVertical,
  RefreshCw,
  Table2,
} from "lucide-react";
import Link from "next/link";

import { RunOverviewTab } from "@/components/overview-tab";
import { RolloutGridView } from "@/components/rollouts/rollout-grid-view";
import { RolloutSplitView } from "@/components/rollouts/rollout-split-view";
import { RolloutTableView } from "@/components/rollouts/rollout-table-view";
import { Button } from "@/components/ui/button";
import { StepSliderControl } from "@/components/step-slider-control";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

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
  version?: string;
};

type RunPayloadRun = {
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
  val_config?: unknown;
  run_config?: unknown;
  eval_config?: unknown;
  buffer_config?: unknown;
  environments?: RunEnvironment[];
  started_at?: string;
  completed_at?: string;
  created_at?: string;
  updated_at?: string;
  wandb_entity?: string;
  wandb_project?: string;
  wandb_run_name?: string;
};

type RunPayload = {
  run?: RunPayloadRun;
};

export type RawRun = {
  run_id: string;
  run_payload?: RunPayload;
  progress_payload?: JsonObject;
  checkpoints_payload?: JsonObject;
  metrics_payload?: {
    metrics?: unknown[];
  };
  distributions_payloads_by_step?: Record<string, unknown>;
  rollout_payloads_by_step?: Record<string, RawStepPayload>;
};

export type RawRolloutsData = {
  runs: RawRun[];
};

type RunRolloutsProps = {
  run: RawRun;
  backHref: string;
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
  lastMessage: string;
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

type DataViewMode = "table" | "split" | "grid";

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

function samplesForStep(run: RawRun, step: number | null): RawSample[] {
  if (step === null) {
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

export function RunRollouts({ run, backHref }: RunRolloutsProps) {
  const steps = React.useMemo<number[]>(() => {
    if (!run.rollout_payloads_by_step) {
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
  }, [run.run_id, steps.length]);

  const activeStep = steps[stepIndex] ?? null;
  const activeSamples = React.useMemo(
    () => samplesForStep(run, activeStep),
    [run, activeStep],
  );

  const rewardColumns = React.useMemo<string[]>(() => {
    if (!run.rollout_payloads_by_step) {
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

  const runName = run.run_payload?.run?.name ?? run.run_id;
  const runId = run.run_payload?.run?.id ?? run.run_id;
  const runMeta = run.run_payload?.run;
  const wandbUrl =
    runMeta?.wandb_entity && runMeta.wandb_project && runMeta.wandb_run_name
      ? `https://wandb.ai/${runMeta.wandb_entity}/${runMeta.wandb_project}/runs/${runMeta.wandb_run_name}`
      : null;

  const rows = React.useMemo<Row[]>(() => {
    return activeSamples.map((sample, index) => {
      const metrics = extractMetrics(sample);
      const numTurns = toNumber(metrics.num_turns);
      const idValue = sample.problem_id ?? sample.sample_id ?? index;
      const rowKey = `${activeStep ?? "na"}:${sample.problem_id ?? "na"}:${sample.sample_id ?? "na"}:${index}`;
      const selectionKey = getRolloutSelectionKey(runId, activeStep, rowKey);
      const messages = extractConversationMessages(sample);
      const lastMessage = messages.length
        ? messages[messages.length - 1]?.content ?? ""
        : "";

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
        lastMessage,
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
  const [dataViewMode, setDataViewMode] = React.useState<DataViewMode>("table");
  const [activeTab, setActiveTab] = React.useState("overview");

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

    const runById = new Map<string, RawRun>();
    runById.set(run.run_id, run);
    runById.set(runId, run);

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
  }, [run, runId, selectedRollouts]);

  React.useEffect(() => {
    if (copyStatus !== "copied") {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setCopyStatus("idle"), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

  React.useEffect(() => {
    if (dataViewMode === "split" && isDialogOpen) {
      setDialogOpen(false);
    }
  }, [dataViewMode, isDialogOpen]);

  const isLockedDataViewportMode =
    activeTab === "data" && (dataViewMode === "split" || dataViewMode === "grid");

  return (
    <main
      className={cn(
        "bg-black text-zinc-100",
        isLockedDataViewportMode ? "flex h-screen flex-col overflow-hidden" : "min-h-screen",
      )}
    >
      <header className="border-b border-zinc-800">
        <div className="mx-auto w-full max-w-[2100px] px-3 py-4 md:px-6 md:py-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Button
                asChild
                variant="ghost"
                size="icon-sm"
                className="size-7 shrink-0 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <Link href={backHref} aria-label="Back to runs" title="Back to runs">
                  <ArrowLeft className="size-3.5" />
                </Link>
              </Button>
              <h1 className="text-base font-semibold tracking-tight md:text-lg">
                {runName}
              </h1>
              <Button
                variant="ghost"
                size="icon-sm"
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

      <div
        className={cn(
          "mx-auto w-full max-w-[2100px] px-3 pb-4 pt-5 md:px-6 md:pb-6 md:pt-6",
          isLockedDataViewportMode && "flex min-h-0 flex-1 flex-col overflow-hidden",
        )}
      >
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className={cn("w-full gap-4", isLockedDataViewportMode && "flex h-full min-h-0 flex-col")}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
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
              <TabsTrigger value="checkpoints" className="text-xs md:text-sm">
                Checkpoints
              </TabsTrigger>
              <TabsTrigger value="resources" className="text-xs md:text-sm">
                Resources
              </TabsTrigger>
            </TabsList>

            {activeTab === "data" ? (
              <div className="flex items-center gap-2">
                <div
                  role="group"
                  className="flex items-center overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900"
                >
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={`rounded-none border-0 [&:not(:last-child)]:border-r [&:not(:last-child)]:border-zinc-700 ${
                      dataViewMode === "table"
                        ? "bg-zinc-700 text-zinc-100 hover:bg-zinc-700"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    }`}
                    onClick={() => setDataViewMode("table")}
                    aria-label="Table view"
                    title="Table view"
                  >
                    <Table2 className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={`rounded-none border-0 [&:not(:last-child)]:border-r [&:not(:last-child)]:border-zinc-700 ${
                      dataViewMode === "split"
                        ? "bg-zinc-700 text-zinc-100 hover:bg-zinc-700"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    }`}
                    onClick={() => setDataViewMode("split")}
                    aria-label="Split view"
                    title="Split view"
                  >
                    <Columns2 className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className={`rounded-none border-0 ${
                      dataViewMode === "grid"
                        ? "bg-zinc-700 text-zinc-100 hover:bg-zinc-700"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                    }`}
                    onClick={() => setDataViewMode("grid")}
                    aria-label="Grid view"
                    title="Grid view"
                  >
                    <Grid3x3 className="size-4" />
                  </Button>
                </div>
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
              </div>
            ) : activeTab === "overview" ? (
              <div className="flex items-center gap-2">
                {wandbUrl ? (
                  <Button
                    variant="secondary"
                    className="h-8 bg-zinc-800 px-3 text-xs font-semibold text-zinc-100 hover:bg-zinc-700"
                    asChild
                  >
                    <a href={wandbUrl} target="_blank" rel="noreferrer">
                      View on W&B
                    </a>
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    className="h-8 bg-zinc-800 px-3 text-xs font-semibold text-zinc-500"
                    disabled
                  >
                    View on W&B
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="icon-sm"
                  className="bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                  aria-label="Refresh page"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="size-4" />
                </Button>
              </div>
            ) : null}
          </div>

          <TabsContent value="overview">
            <RunOverviewTab run={run} />
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

          <TabsContent value="checkpoints">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6 text-zinc-400">
              Checkpoints tab placeholder.
            </div>
          </TabsContent>

          <TabsContent
            value="data"
            className={cn("space-y-4", isLockedDataViewportMode && "flex min-h-0 flex-1 flex-col")}
          >
            {dataViewMode === "table" ? (
              <RolloutTableView
                rows={rows}
                rewardColumns={rewardColumns}
                selectedRowKeys={selectedRollouts}
                visibleSelection={visibleSelection}
                onToggleVisibleSelection={toggleVisibleSelection}
                onToggleRowSelection={toggleRolloutSelection}
                onActivateRow={(index) => {
                  setDialogRolloutIndex(index);
                  setDialogOpen(true);
                }}
                formatNumber={displayNumber}
              />
            ) : dataViewMode === "split" ? (
              <RolloutSplitView
                rows={rows}
                activeIndex={dialogRolloutIndex}
                selectedRowKeys={selectedRollouts}
                onActiveIndexChange={setDialogRolloutIndex}
                onToggleRowSelection={toggleRolloutSelection}
                selectedMessages={selectedMessages}
                expandedMessageKeys={expandedMessageKeys}
                onToggleMessage={toggleMessage}
                onCollapseAll={collapseAll}
                onExpandAll={expandAll}
                formatNumber={displayNumber}
                className={cn(
                  "overflow-hidden rounded-md border border-white/10 bg-[#141414]",
                  isLockedDataViewportMode ? "flex-1 min-h-0" : "min-h-[600px]",
                )}
              />
            ) : (
              <RolloutGridView
                rows={rows}
                selectedRowKeys={selectedRollouts}
                onToggleRowSelection={toggleRolloutSelection}
                onActivateRow={(index) => {
                  setDialogRolloutIndex(index);
                  setDialogOpen(true);
                }}
                formatNumber={displayNumber}
                className={cn(isLockedDataViewportMode ? "flex-1 min-h-0" : "min-h-[600px]")}
              />
            )}
            <div className={cn("flex items-start justify-end gap-4", isLockedDataViewportMode && "shrink-0")}>
              <StepSliderControl
                steps={steps}
                stepIndex={stepIndex}
                onStepIndexChange={handleStepIndexChange}
                inline
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
          <RolloutSplitView
            rows={rows}
            activeIndex={dialogRolloutIndex}
            selectedRowKeys={selectedRollouts}
            onActiveIndexChange={setDialogRolloutIndex}
            onToggleRowSelection={toggleRolloutSelection}
            selectedMessages={selectedMessages}
            expandedMessageKeys={expandedMessageKeys}
            onToggleMessage={toggleMessage}
            onCollapseAll={collapseAll}
            onExpandAll={expandAll}
            formatNumber={displayNumber}
            className="h-full min-h-0"
          />
        </DialogContent>
      </Dialog>
    </main>
  );
}
