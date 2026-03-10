"use client";

import * as React from "react";
import { ChevronRight, Copy, Wrench } from "lucide-react";

import type { ConversationToolCall } from "@/lib/rollout-conversation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type RolloutToolCallCardProps = {
  toolCall: ConversationToolCall;
  className?: string;
};

function compactText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
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

function truncateText(text: string, maxLength = 92): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}...`;
}

function toJsonCodeBlock(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

function getCallSummary(toolCall: ConversationToolCall): string {
  const paramsPreview = compactText(toJsonCodeBlock(toolCall.arguments));
  if (paramsPreview) {
    return truncateText(paramsPreview);
  }
  return "null";
}

function getResultValue(toolCall: ConversationToolCall): unknown {
  if (toolCall.outputs.length === 0) {
    return null;
  }

  if (toolCall.outputs.length === 1) {
    return parseMaybeJson(toolCall.outputs[0]?.content ?? "");
  }

  return toolCall.outputs.map((output) => parseMaybeJson(output.content));
}

async function copyToClipboard(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}

export function RolloutToolCallCard({ toolCall, className }: RolloutToolCallCardProps) {
  const [isExpanded, setExpanded] = React.useState(false);
  const paramsJson = React.useMemo(() => toJsonCodeBlock(toolCall.arguments), [toolCall.arguments]);
  const resultJson = React.useMemo(() => toJsonCodeBlock(getResultValue(toolCall)), [toolCall]);
  const summary = React.useMemo(() => getCallSummary(toolCall), [toolCall]);
  const copyPayload = React.useMemo(
    () =>
      JSON.stringify(
        {
          params: toolCall.arguments ?? null,
          result: getResultValue(toolCall),
        },
        null,
        2,
      ),
    [toolCall],
  );

  return (
    <div className={cn("overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]", className)}>
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <Wrench className="size-3.5 shrink-0 text-zinc-400" />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-sm font-medium text-zinc-100">{toolCall.name}</span>
              <span className="truncate font-mono text-xs text-zinc-400">{summary}</span>
            </div>
          </div>
        </button>

        <span
          className="max-w-40 truncate font-mono text-[11px] text-zinc-500"
          title={toolCall.id}
        >
          {toolCall.id}
        </span>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-zinc-500 hover:bg-white/5 hover:text-zinc-100"
          onClick={async (event) => {
            event.stopPropagation();
            await copyToClipboard(copyPayload);
          }}
          aria-label="Copy tool trace"
          title="Copy tool trace"
        >
          <Copy />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-zinc-500 hover:bg-white/5 hover:text-zinc-100"
          onClick={() => setExpanded((current) => !current)}
          aria-label={isExpanded ? "Collapse details" : "Expand details"}
          title={isExpanded ? "Collapse details" : "Expand details"}
        >
          <ChevronRight className={cn("transition-transform", isExpanded && "rotate-90")} />
        </Button>
      </div>

      {isExpanded ? (
        <div className="px-2.5 pb-2.5">
          <Separator className="mb-2.5 bg-white/10" />
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Params</p>
              <pre className="overflow-x-auto rounded-md bg-black/40 p-2.5 font-mono text-[11px] leading-5 text-zinc-200">
                {paramsJson}
              </pre>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Result</p>
              <pre className="overflow-x-auto rounded-md bg-black/40 p-2.5 font-mono text-[11px] leading-5 text-zinc-200">
                {resultJson}
              </pre>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
