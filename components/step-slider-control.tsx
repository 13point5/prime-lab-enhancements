"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const SLIDER_MAX_WIDTH = 360;
const MIN_TICK_SPACING_PX = 56;

type StepSliderControlProps = {
  steps: number[];
  stepIndex: number;
  onStepIndexChange: (index: number) => void;
  /** When true, uses w-fit instead of w-full for inline layout */
  inline?: boolean;
  trailingAction?: React.ReactNode;
};

function niceInterval(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 2.5) return 2.5 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function roundTick(value: number): number {
  return Number(value.toFixed(6));
}

function formatTick(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return String(Number(value.toFixed(2)));
}

function buildDisplayTicks(steps: number[]): number[] {
  if (steps.length === 0) {
    return [];
  }

  const start = steps[0];
  const end = steps[steps.length - 1];
  if (start === end) {
    return [start];
  }

  const maxLabels = Math.max(2, Math.floor(SLIDER_MAX_WIDTH / MIN_TICK_SPACING_PX) + 1);
  const targetIntervals = Math.max(1, maxLabels - 1);
  const interval = niceInterval((end - start) / targetIntervals);

  const ticks: number[] = [start];
  let current = start + interval;
  let guard = 0;
  while (current < end && guard < 100) {
    ticks.push(roundTick(current));
    current += interval;
    guard += 1;
  }
  ticks.push(end);

  return ticks.filter((tick, index) => index === 0 || tick > ticks[index - 1]);
}

export function StepSliderControl({
  steps,
  stepIndex,
  onStepIndexChange,
  inline = false,
  trailingAction,
}: StepSliderControlProps) {
  const maxIndex = Math.max(steps.length - 1, 0);
  const activeStep = steps[stepIndex] ?? null;
  const canPrev = stepIndex > 0;
  const canNext = stepIndex < steps.length - 1;
  const displayTicks = buildDisplayTicks(steps);

  if (inline) {
    return (
      <div className="flex min-w-[420px] w-fit items-center gap-2 md:gap-3">
        <div className="flex min-w-[280px] max-w-[360px] flex-col">
          <div className="flex h-8 items-center gap-1">
            <span className="w-10 shrink-0 text-xs text-zinc-400">Step:</span>
            <Slider
              value={[stepIndex]}
              min={0}
              max={maxIndex}
              step={1}
              onValueChange={(value) => onStepIndexChange(value[0] ?? 0)}
              className="w-full [&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-thumb]]:border-zinc-500 [&_[data-slot=slider-thumb]]:bg-black [&_[data-slot=slider-track]]:bg-zinc-200 [&_[data-slot=slider-range]]:bg-zinc-200"
            />
          </div>
          <div className="mt-0.5 flex items-center gap-1">
            <span className="w-10 shrink-0" aria-hidden />
            <div className="flex flex-1 justify-between px-1 text-[11px] text-zinc-500">
              {displayTicks.map((step) => (
                <span key={step}>{formatTick(step)}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex h-8 shrink-0 items-stretch overflow-hidden rounded-md border border-zinc-700 bg-black">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center border-r border-zinc-700 text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-40"
            onClick={() => canPrev && onStepIndexChange(stepIndex - 1)}
            disabled={!canPrev}
            aria-label="Previous step"
          >
            <ChevronLeft className="size-3" />
          </button>
          <div className="flex min-w-14 items-center justify-center border-r border-zinc-700 px-2 text-xs font-semibold text-zinc-100">
            {activeStep ?? "-"}
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-40"
            onClick={() => canNext && onStepIndexChange(stepIndex + 1)}
            disabled={!canNext}
            aria-label="Next step"
          >
            <ChevronRight className="size-3" />
          </button>
        </div>
        <Button
          variant="secondary"
          className="h-8 bg-zinc-800 px-3 text-xs font-semibold text-zinc-100 hover:bg-zinc-700"
          onClick={() => onStepIndexChange(maxIndex)}
          disabled={steps.length === 0}
        >
          Jump to Latest
        </Button>
        {trailingAction}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-2 md:gap-3">
      <div className="w-full min-w-[280px] max-w-[360px]">
        <div className="flex items-center gap-1">
          <span className="w-10 shrink-0 text-xs text-zinc-400">Step:</span>
          <Slider
            value={[stepIndex]}
            min={0}
            max={maxIndex}
            step={1}
            onValueChange={(value) => onStepIndexChange(value[0] ?? 0)}
            className="w-full [&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-thumb]]:border-zinc-500 [&_[data-slot=slider-thumb]]:bg-black [&_[data-slot=slider-track]]:bg-zinc-200 [&_[data-slot=slider-range]]:bg-zinc-200"
          />
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="w-10 shrink-0" aria-hidden />
          <div className="flex flex-1 justify-between px-1 text-[11px] text-zinc-500">
            {displayTicks.map((step) => (
              <span key={step}>{formatTick(step)}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex h-8 shrink-0 items-stretch overflow-hidden rounded-md border border-zinc-700 bg-black">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center border-r border-zinc-700 text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-40"
          onClick={() => canPrev && onStepIndexChange(stepIndex - 1)}
          disabled={!canPrev}
          aria-label="Previous step"
        >
          <ChevronLeft className="size-3" />
        </button>
        <div className="flex min-w-14 items-center justify-center border-r border-zinc-700 px-2 text-xs font-semibold text-zinc-100">
          {activeStep ?? "-"}
        </div>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-40"
          onClick={() => canNext && onStepIndexChange(stepIndex + 1)}
          disabled={!canNext}
          aria-label="Next step"
        >
          <ChevronRight className="size-3" />
        </button>
      </div>

      <Button
        variant="secondary"
        className="h-8 bg-zinc-800 px-3 text-xs font-semibold text-zinc-100 hover:bg-zinc-700"
        onClick={() => onStepIndexChange(maxIndex)}
        disabled={steps.length === 0}
      >
        Jump to Latest
      </Button>
      {trailingAction}
    </div>
  );
}
