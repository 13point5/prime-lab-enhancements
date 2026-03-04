"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type RolloutSplitRowBase = {
  key: string;
  selectionKey: string;
  id: string;
  prompt: string;
  reward: number | null;
};

type ConversationMessage = {
  key: string;
  role: string;
  content: string;
};

type RolloutSplitViewProps<T extends RolloutSplitRowBase> = {
  rows: T[];
  activeIndex: number;
  selectedRowKeys: Record<string, unknown>;
  onActiveIndexChange: (index: number) => void;
  onToggleRowSelection: (row: T, checked: boolean) => void;
  selectedMessages: ConversationMessage[];
  expandedMessageKeys: string[];
  onToggleMessage: (key: string) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  formatNumber: (value: number | null) => string;
  className?: string;
};

export function RolloutSplitView<T extends RolloutSplitRowBase>({
  rows,
  activeIndex,
  selectedRowKeys,
  onActiveIndexChange,
  onToggleRowSelection,
  selectedMessages,
  expandedMessageKeys,
  onToggleMessage,
  onCollapseAll,
  onExpandAll,
  formatNumber,
  className,
}: RolloutSplitViewProps<T>) {
  const boundedIndex = rows.length > 0 ? Math.min(Math.max(activeIndex, 0), rows.length - 1) : 0;

  return (
    <div className={cn("grid min-h-0 grid-cols-[280px_minmax(0,1fr)]", className)}>
      <aside className="flex min-h-0 flex-col border-r border-white/10">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-100">Rollouts</h3>
          <p className="text-xs text-zinc-500">
            {rows.length > 0 ? `${boundedIndex + 1}/${rows.length}` : "0/0"}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="space-y-1.5">
            {rows.map((row, index) => {
              const isActive = index === boundedIndex;
              const isChecked = Boolean(selectedRowKeys[row.selectionKey]);
              return (
                <div
                  key={`${row.key}:split-item`}
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
                        onCheckedChange={(checked) => onToggleRowSelection(row, checked === true)}
                        aria-label={`Select rollout ${row.id}`}
                      />
                    </div>
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => onActiveIndexChange(index)}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-xs text-zinc-400">#{row.id}</span>
                        <span className="text-sm font-semibold text-emerald-400">
                          {formatNumber(row.reward)}
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
            <button type="button" className="hover:text-zinc-100" onClick={onCollapseAll}>
              Collapse All
            </button>
            <span className="text-zinc-600">|</span>
            <button type="button" className="hover:text-zinc-100" onClick={onExpandAll}>
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
                    onClick={() => onToggleMessage(message.key)}
                  >
                    <span className="text-xs font-semibold lowercase leading-none tracking-wide text-zinc-200">
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
  );
}
