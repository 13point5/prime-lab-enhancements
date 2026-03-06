import fs from "node:fs";
import path from "node:path";

import { RunWorkspace } from "@/components/run-workspace";
import { type RawRolloutsData } from "@/components/run-rollouts";

function loadLatestRolloutData(): RawRolloutsData | null {
  const root = process.cwd();
  const files = fs
    .readdirSync(root)
    .filter((name) => /^raw-rollouts-.*\.json$/i.test(name))
    .map((name) => ({
      name,
      mtimeMs: fs.statSync(path.join(root, name)).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const latest = files[0];
  if (!latest) {
    return null;
  }

  const fullPath = path.join(root, latest.name);
  const raw = fs.readFileSync(fullPath, "utf8");
  return JSON.parse(raw) as RawRolloutsData;
}

export default function Page() {
  const data = loadLatestRolloutData();
  return <RunWorkspace data={data} />;
}
