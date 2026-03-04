"use client";

import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type RolloutGridRowBase = {
  key: string;
  selectionKey: string;
  id: string;
  reward: number | null;
  lastMessage: string;
};

type RolloutGridViewProps<T extends RolloutGridRowBase> = {
  rows: T[];
  selectedRowKeys: Record<string, unknown>;
  onToggleRowSelection: (row: T, checked: boolean) => void;
  onActivateRow: (index: number) => void;
  formatNumber: (value: number | null) => string;
  className?: string;
};

export function RolloutGridView<T extends RolloutGridRowBase>({
  rows,
  selectedRowKeys,
  onToggleRowSelection,
  onActivateRow,
  formatNumber,
  className,
}: RolloutGridViewProps<T>) {
  return (
    <div className={cn("flex min-h-0 flex-col rounded-md border border-white/10 bg-[#141414] p-3", className)}>
      {rows.length > 0 ? (
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {rows.map((row, index) => {
              const isChecked = Boolean(selectedRowKeys[row.selectionKey]);
              return (
                <div
                  key={`${row.key}:grid-item`}
                  className={`h-[320px] overflow-hidden rounded-md border px-2 py-2 transition-colors ${
                    isChecked
                      ? "border-white/15 bg-black/80 ring-1 ring-violet-500/60"
                      : "border-transparent bg-white/[0.02] hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex h-full min-h-0 items-stretch gap-2">
                    <div className="pt-0.5 shrink-0">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => onToggleRowSelection(row, checked === true)}
                        aria-label={`Select rollout ${row.id}`}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      />
                    </div>
                    <button
                      type="button"
                      className="h-full min-w-0 flex-1 min-h-0 text-left flex flex-col"
                      onClick={() => onActivateRow(index)}
                    >
                      <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-xs text-zinc-400">#{row.id}</span>
                        <span className="shrink-0 text-sm font-semibold text-emerald-400">
                          {formatNumber(row.reward)}
                        </span>
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
                        <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-zinc-200">
                          {row.lastMessage || "(no messages)"}
                        </pre>
                      </div>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-zinc-500">No rollout data available.</div>
      )}
    </div>
  );
}
