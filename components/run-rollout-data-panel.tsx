"use client";

import * as React from "react";
import { Check, Columns2, Grid3x3, Table2 } from "lucide-react";

import type { RawRun } from "@/components/run-rollouts";
import { RolloutGridView } from "@/components/rollouts/rollout-grid-view";
import { RolloutSplitView } from "@/components/rollouts/rollout-split-view";
import { RolloutTableView } from "@/components/rollouts/rollout-table-view";
import { StepSliderControl } from "@/components/step-slider-control";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  extractConversationMessages,
  getLastAssistantMessageKey,
  getLastConversationPreview,
} from "@/lib/rollout-conversation";
import {
  readRolloutViewModeStore,
  type RolloutDataViewMode,
  writeRolloutViewModeStore,
} from "@/lib/run-selection-storage";
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

type SelectedRolloutEntry = {
  run_id: string;
  run_name: string;
  step: number | null;
  row: Row;
};

type RunRolloutDataPanelProps = {
  run: RawRun;
  className?: string;
  controlsStart?: React.ReactNode;
  requestedStep?: number | null;
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

    const firstText = messages.find((message) => typeof message.content === "string");
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
  if (sample.num_output_tokens !== null && sample.num_output_tokens !== undefined) {
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

function samplesForStep(run: RawRun, step: number | null): RawSample[] {
  if (step === null) {
    return [];
  }
  const payload = run.rollout_payloads_by_step?.[String(step)] as RawStepPayload | undefined;
  if (!payload || !Array.isArray(payload.samples)) {
    return [];
  }
  return payload.samples.filter(
    (sample): sample is RawSample =>
      !!sample && typeof sample === "object" && !Array.isArray(sample),
  );
}

export function RunRolloutDataPanel({
  run,
  className,
  controlsStart,
  requestedStep,
}: RunRolloutDataPanelProps) {
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

  const resolveStepIndex = React.useCallback(
    (candidateSteps: number[]) => {
      if (candidateSteps.length === 0) {
        return 0;
      }

      if (requestedStep === null || requestedStep === undefined || !Number.isFinite(requestedStep)) {
        return candidateSteps.length - 1;
      }

      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const [index, step] of candidateSteps.entries()) {
        const distance = Math.abs(step - requestedStep);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      }
      return nearestIndex;
    },
    [requestedStep],
  );

  React.useEffect(() => {
    setStepIndex(resolveStepIndex(steps));
  }, [resolveStepIndex, run.run_id, steps]);

  const activeStep = steps[stepIndex] ?? null;
  const activeSamples = React.useMemo(() => samplesForStep(run, activeStep), [run, activeStep]);

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
        if (!rawSample || typeof rawSample !== "object" || Array.isArray(rawSample)) {
          continue;
        }
        const sample = rawSample as RawSample;
        const metrics = extractMetrics(sample);
        for (const key of Object.keys(metrics)) {
          if (key !== "reward" && key !== "num_turns" && key.endsWith("_reward")) {
            keys.add(key);
          }
        }
      }
    }

    return [...keys].sort((a, b) => a.localeCompare(b));
  }, [run]);

  const runName = run.run_payload?.run?.name ?? run.run_id;
  const runId = run.run_payload?.run?.id ?? run.run_id;

  const rows = React.useMemo<Row[]>(() => {
    return activeSamples.map((sample, index) => {
      const metrics = extractMetrics(sample);
      const numTurns = toNumber(metrics.num_turns);
      const idValue = sample.problem_id ?? sample.sample_id ?? index;
      const rowKey = `${activeStep ?? "na"}:${sample.problem_id ?? "na"}:${sample.sample_id ?? "na"}:${index}`;
      const selectionKey = getRolloutSelectionKey(runId, activeStep, rowKey);
      const messages = extractConversationMessages(sample);
      const lastMessage = getLastConversationPreview(messages);

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
  const [selectedRollouts, setSelectedRollouts] = React.useState<Record<string, SelectedRolloutEntry>>({});
  const [copyStatus, setCopyStatus] = React.useState<"idle" | "copied" | "error">("idle");
  const [dataViewMode, setDataViewMode] = React.useState<RolloutDataViewMode>("table");
  const [hasLoadedRolloutViewMode, setHasLoadedRolloutViewMode] = React.useState(false);

  const selectedCount = React.useMemo(() => Object.keys(selectedRollouts).length, [selectedRollouts]);

  React.useEffect(() => {
    setDataViewMode(readRolloutViewModeStore());
    setHasLoadedRolloutViewMode(true);
  }, []);

  React.useEffect(() => {
    if (!hasLoadedRolloutViewMode) {
      return;
    }
    writeRolloutViewModeStore(dataViewMode);
  }, [dataViewMode, hasLoadedRolloutViewMode]);

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

  const toggleVisibleSelection = React.useCallback((checked: boolean) => {
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
  }, [rows, runId, runName]);

  const selectedRollout =
    rows.length > 0 ? rows[Math.min(Math.max(dialogRolloutIndex, 0), rows.length - 1)] : null;

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
    const lastAssistantMessageKey = getLastAssistantMessageKey(selectedMessages);
    setExpandedMessageKeys(lastAssistantMessageKey ? [lastAssistantMessageKey] : []);
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
      const aStep = a.step ?? Number.POSITIVE_INFINITY;
      const bStep = b.step ?? Number.POSITIVE_INFINITY;
      if (aStep !== bStep) {
        return aStep - bStep;
      }
      return compareSampleIds(a.row.sample.sample_id, b.row.sample.sample_id);
    });

    const lines: string[] = [];
    lines.push("# RL Rollout Export");
    lines.push(`Exported At: ${new Date().toISOString()}`);
    lines.push(`Selected Rollouts: ${items.length}`);
    lines.push("");
    lines.push(`## Run ${runId}`);
    lines.push(`- Name: ${runName}`);
    lines.push(`- Environment: ${run.run_payload?.run?.environments?.[0]?.id ?? "n/a"}`);
    lines.push(`- Model: ${run.run_payload?.run?.base_model ?? "n/a"}`);
    lines.push(`- Status: ${run.run_payload?.run?.status ?? "n/a"}`);
    lines.push("");

    const uniqueSteps = [...new Set(items.map((item) => formatStepLabel(item.step)))];

    for (const stepLabel of uniqueSteps) {
      lines.push(`### Checkpoint ${stepLabel}`);
      lines.push("");

      const stepItems = items
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
            if (message.content) {
              lines.push("````text");
              lines.push(message.content);
              lines.push("````");
            }
            if (message.toolCalls.length > 0) {
              lines.push("Tool Calls:");
              lines.push("````json");
              lines.push(JSON.stringify(message.toolCalls, null, 2));
              lines.push("````");
            }
            if (!message.content && message.toolCalls.length === 0) {
              lines.push("````text");
              lines.push("(no message content)");
              lines.push("````");
            }
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
  }, [run, runId, runName, selectedRollouts]);

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

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {controlsStart}
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

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
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
            className="min-h-0 flex-1 overflow-hidden rounded-md border border-white/10 bg-[#141414]"
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
            className="min-h-0 flex-1"
          />
        )}

        <div className="shrink-0">
          <div className="flex items-start justify-end gap-4">
            <StepSliderControl
              steps={steps}
              stepIndex={stepIndex}
              onStepIndexChange={handleStepIndexChange}
              inline
            />
          </div>
        </div>
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
    </div>
  );
}
