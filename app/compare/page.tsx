import { RunsCompare } from "@/components/runs-compare";
import { loadLatestRolloutData } from "@/lib/rollouts-data";

type ComparePageProps = {
  searchParams: Promise<{
    environment?: string;
    runs?: string;
  }>;
};

function parseRunIds(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return [...new Set(raw.split(",").map((value) => value.trim()).filter((value) => value.length > 0))];
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const params = await searchParams;
  const data = loadLatestRolloutData();

  return (
    <RunsCompare
      data={data}
      initialEnvironmentKey={params.environment ?? null}
      initialRunIds={parseRunIds(params.runs)}
    />
  );
}

