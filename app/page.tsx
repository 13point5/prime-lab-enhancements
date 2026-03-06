import { RunsHome } from "@/components/runs-home";
import { loadLatestRolloutData } from "@/lib/rollouts-data";

export default function Page() {
  const data = loadLatestRolloutData();
  return <RunsHome data={data} />;
}
