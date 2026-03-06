"use client";

import * as React from "react";
import { ArrowLeft, BarChart3, Layers3, LayoutPanelTop, LineChart } from "lucide-react";

import { RunRollouts, type RawRolloutsData, type RawRun } from "@/components/run-rollouts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ComparisonConcept = {
  id: string;
  title: string;
  summary: string;
  tradeoffs: string;
  icon: React.ReactNode;
  highlights: string[];
};

function asNumber(value: unknown): number | null {
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

function formatDateTime(value: string | undefined): string {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function formatProgress(step: number | null, maxSteps: number | null): string {
  if (step === null && maxSteps === null) {
    return "-";
  }
  if (step === null) {
    return `- / ${maxSteps}`;
  }
  if (!maxSteps || maxSteps <= 0) {
    return String(step);
  }
  const pct = Math.min(Math.round((step / maxSteps) * 100), 100);
  return `${step} / ${maxSteps} (${pct}%)`;
}

function getStatusTone(status: string): "default" | "secondary" | "destructive" | "outline" {
  const normalized = status.toLowerCase();
  if (normalized === "completed" || normalized === "succeeded") {
    return "default";
  }
  if (normalized === "failed" || normalized === "error") {
    return "destructive";
  }
  if (normalized === "running" || normalized === "in_progress") {
    return "secondary";
  }
  return "outline";
}

const concepts: ComparisonConcept[] = [
  {
    id: "overlay",
    title: "Variation A — Overlay compare",
    summary: "Pick an environment, then toggle multiple runs directly on shared metric charts.",
    tradeoffs: "Fast and familiar like W&B; can feel busy when many runs are visible.",
    icon: <LineChart className="size-4" />,
    highlights: [
      "Env-first filter rail to keep charts semantically comparable.",
      "Run chips with visibility toggles and future per-run color slots.",
      "Legend doubles as selection control and run metadata quick view.",
    ],
  },
  {
    id: "baseline-diff",
    title: "Variation B — Baseline + deltas",
    summary: "Anchor on one baseline run, then compare all selected runs as delta lines.",
    tradeoffs: "Great for regression analysis; less intuitive for first-time users.",
    icon: <BarChart3 className="size-4" />,
    highlights: [
      "Baseline selector pinned above charts.",
      "Secondary runs shown as absolute and delta tabs.",
      "Future-ready for rollout-level overlays by inheriting baseline context.",
    ],
  },
  {
    id: "small-multiples",
    title: "Variation C — Small multiples",
    summary: "Show one chart card per run (same env), with synced axes and optional brush sync.",
    tradeoffs: "Higher scanability and no color dependency; uses more vertical space.",
    icon: <LayoutPanelTop className="size-4" />,
    highlights: [
      "Stable run ordering with pinning for key experiments.",
      "Compact sparkline grid and expandable detailed panel.",
      "Future rollout comparison can reuse card-per-run pattern.",
    ],
  },
];

export function RunWorkspace({ data }: { data: RawRolloutsData | null }) {
  const runs = React.useMemo(() => data?.runs ?? [], [data]);
  const [selectedRunId, setSelectedRunId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!runs.length) {
      setSelectedRunId(null);
      return;
    }
    if (!selectedRunId || !runs.some((run) => run.run_id === selectedRunId)) {
      setSelectedRunId(runs[0]?.run_id ?? null);
    }
  }, [runs, selectedRunId]);

  const selectedRun = React.useMemo<RawRun | null>(() => {
    if (!selectedRunId) {
      return null;
    }
    return runs.find((run) => run.run_id === selectedRunId) ?? null;
  }, [runs, selectedRunId]);

  const selectedRunData = React.useMemo<RawRolloutsData | null>(
    () => (selectedRun ? { runs: [selectedRun] } : null),
    [selectedRun],
  );

  if (selectedRunData) {
    return (
      <div className="bg-black">
        <div className="mx-auto w-full max-w-[2100px] px-3 pt-4 md:px-6">
          <Button
            variant="secondary"
            className="h-8 bg-zinc-800 text-xs text-zinc-100 hover:bg-zinc-700"
            onClick={() => setSelectedRunId(null)}
          >
            <ArrowLeft className="size-4" />
            Back to runs
          </Button>
        </div>
        <RunRollouts data={selectedRunData} />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto w-full max-w-[2100px] space-y-6 px-3 py-5 md:px-6 md:py-6">
        <section className="space-y-2">
          <h1 className="text-lg font-semibold tracking-tight md:text-xl">Runs</h1>
          <p className="text-sm text-zinc-400">
            Select a run to open the detailed view. The first page stays focused on run discovery.
          </p>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 md:p-4">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Env</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Step</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length ? (
                runs.map((run) => {
                  const meta = run.run_payload?.run;
                  const name = meta?.name ?? run.run_id;
                  const status = meta?.status ?? "unknown";
                  const env = meta?.environments?.[0]?.id ?? "-";
                  const step = asNumber(run.progress_payload?.latest_step);
                  const maxSteps = asNumber(meta?.max_steps);
                  const updatedAt =
                    (run.progress_payload?.last_updated_at as string | undefined) ??
                    meta?.completed_at ??
                    meta?.updated_at ??
                    meta?.created_at;

                  return (
                    <TableRow
                      key={run.run_id}
                      className="cursor-pointer border-zinc-800 hover:bg-zinc-900/80"
                      onClick={() => setSelectedRunId(run.run_id)}
                    >
                      <TableCell className="max-w-80 whitespace-normal font-medium text-zinc-100">
                        {name}
                      </TableCell>
                      <TableCell>{env}</TableCell>
                      <TableCell className="max-w-72 whitespace-normal">{meta?.base_model ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusTone(status)}>{status}</Badge>
                      </TableCell>
                      <TableCell>{step ?? "-"}</TableCell>
                      <TableCell>{formatProgress(step, maxSteps)}</TableCell>
                      <TableCell>{formatDateTime(updatedAt)}</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow className="border-zinc-800">
                  <TableCell colSpan={7} className="py-8 text-center text-zinc-400">
                    No runs found in the loaded rollouts file.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Layers3 className="size-4 text-zinc-400" />
            <h2 className="text-base font-semibold tracking-tight md:text-lg">
              Multi-run chart UX concepts (same env only)
            </h2>
          </div>
          <p className="text-sm text-zinc-400">
            3 options for comparing multiple runs in one environment before we add run-level colors and projects.
          </p>
          <div className="grid gap-3 lg:grid-cols-3">
            {concepts.map((concept) => (
              <Card key={concept.id} className="border-zinc-800 bg-zinc-950/60">
                <CardHeader className="space-y-2">
                  <CardTitle className="flex items-center gap-2 text-sm text-zinc-100 md:text-base">
                    {concept.icon}
                    {concept.title}
                  </CardTitle>
                  <CardDescription className="text-zinc-300">{concept.summary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
                    {concept.highlights.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-zinc-500">Tradeoff: {concept.tradeoffs}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
