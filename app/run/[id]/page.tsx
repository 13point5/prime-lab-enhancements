import { notFound } from "next/navigation";

import { RunRollouts } from "@/components/run-rollouts";
import { findRunById, loadLatestRolloutData } from "@/lib/rollouts-data";

type RunPageProps = {
  params: Promise<{ id: string }>;
};

export default async function RunPage({ params }: RunPageProps) {
  const { id } = await params;
  const data = loadLatestRolloutData();
  const run = findRunById(data, id);

  if (!run) {
    notFound();
  }

  return <RunRollouts run={run} backHref="/" />;
}
