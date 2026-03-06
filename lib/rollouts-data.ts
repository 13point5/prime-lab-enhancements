import fs from "node:fs";
import path from "node:path";

import type { RawRolloutsData, RawRun } from "@/components/run-rollouts";

export function loadLatestRolloutData(): RawRolloutsData {
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
    return { runs: [] };
  }

  const fullPath = path.join(root, latest.name);
  const raw = fs.readFileSync(fullPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<RawRolloutsData>;
  return {
    runs: Array.isArray(parsed.runs) ? parsed.runs : [],
  };
}

export function findRunById(data: RawRolloutsData, id: string): RawRun | null {
  if (data.runs.length === 0) {
    return null;
  }

  for (const run of data.runs) {
    const canonicalId = run.run_payload?.run?.id ?? run.run_id;
    if (run.run_id === id || canonicalId === id) {
      return run;
    }
  }

  return null;
}
