"use client";

import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RolloutTableRowBase = {
  key: string;
  selectionKey: string;
  id: string;
  task: string;
  prompt: string;
  info: string;
  reward: number | null;
  metrics: Record<string, unknown>;
  numTurns: number | null;
};

type VisibleSelection = {
  total: number;
  selected: number;
  allSelected: boolean;
};

type RolloutTableViewProps<T extends RolloutTableRowBase> = {
  rows: T[];
  rewardColumns: string[];
  selectedRowKeys: Record<string, unknown>;
  visibleSelection: VisibleSelection;
  onToggleVisibleSelection: (checked: boolean) => void;
  onToggleRowSelection: (row: T, checked: boolean) => void;
  onActivateRow: (index: number) => void;
  formatNumber: (value: number | null) => string;
};

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

export function RolloutTableView<T extends RolloutTableRowBase>({
  rows,
  rewardColumns,
  selectedRowKeys,
  visibleSelection,
  onToggleVisibleSelection,
  onToggleRowSelection,
  onActivateRow,
  formatNumber,
}: RolloutTableViewProps<T>) {
  return (
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
          {rewardColumns.map((column) => (
            <col key={column} className="w-40" />
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
                onCheckedChange={(checked) => onToggleVisibleSelection(checked === true)}
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
              className={`cursor-pointer border-b-0 transition-colors hover:!bg-white/[0.08] ${
                index % 2 === 0 ? "bg-white/[0.02]" : ""
              } ${selectedRowKeys[row.selectionKey] ? "bg-violet-500/[0.12]" : ""}`}
              onClick={() => onActivateRow(index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onActivateRow(index);
                }
              }}
              tabIndex={0}
            >
              <TableCell className="max-w-10 border-b border-white/5 px-3 py-2">
                <Checkbox
                  checked={Boolean(selectedRowKeys[row.selectionKey])}
                  onCheckedChange={(checked) => onToggleRowSelection(row, checked === true)}
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
                {formatNumber(row.reward)}
              </TableCell>
              {rewardColumns.map((column) => (
                <TableCell
                  key={column}
                  className="border-b border-white/5 px-3 py-2 text-right text-sm text-zinc-300"
                >
                  {formatNumber(toNumber(row.metrics[column]))}
                </TableCell>
              ))}
              <TableCell className="border-b border-white/5 px-3 py-2 text-right text-sm text-zinc-300">
                {formatNumber(row.numTurns)}
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
  );
}
