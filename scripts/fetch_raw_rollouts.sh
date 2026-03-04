#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Fetch raw Prime RL rollout payloads for one or more run IDs.

Usage:
  scripts/fetch_raw_rollouts.sh [options] <run_id> [run_id ...]

Options:
  --steps <all|last3>  Which rollout steps to fetch (default: all)
  --limit <n>          Number of rollout samples per step (default: 100)
  --output, -o <path>  Output file path. Use "-" for stdout (default: -)
  --help, -h           Show this help

Example:
  scripts/fetch_raw_rollouts.sh --steps last3 --limit 200 \
    --output raw-rollouts.json runA runB runC
EOF
}

steps_mode="all"
limit=100
output_path="-"
declare -a run_ids=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --steps)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --steps" >&2
        exit 1
      fi
      steps_mode="$2"
      shift 2
      ;;
    --limit)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --limit" >&2
        exit 1
      fi
      limit="$2"
      shift 2
      ;;
    --output|-o)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --output" >&2
        exit 1
      fi
      output_path="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --)
      shift
      run_ids+=("$@")
      break
      ;;
    -*)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
    *)
      run_ids+=("$1")
      shift
      ;;
  esac
done

if [[ "$steps_mode" != "all" && "$steps_mode" != "last3" ]]; then
  echo "--steps must be one of: all, last3" >&2
  exit 1
fi

if ! [[ "$limit" =~ ^[0-9]+$ ]] || (( limit <= 0 )); then
  echo "--limit must be a positive integer" >&2
  exit 1
fi

if [[ ${#run_ids[@]} -eq 0 ]]; then
  echo "Provide at least one run ID." >&2
  usage >&2
  exit 1
fi

for bin in prime python3; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "Missing required command: $bin" >&2
    exit 1
  fi
done

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

run_and_capture_json() {
  local dest="$1"
  shift
  local raw
  local err_file
  local raw_file
  err_file="$(mktemp)"
  raw_file="$(mktemp)"

  if ! raw="$(COLUMNS=100000 "$@" 2>"$err_file")"; then
    echo "Command failed: $*" >&2
    cat "$err_file" >&2
    rm -f "$err_file"
    rm -f "$raw_file"
    exit 1
  fi

  if [[ -s "$err_file" ]]; then
    cat "$err_file" >&2
  fi
  rm -f "$err_file"
  printf '%s' "$raw" > "$raw_file"

  if ! python3 - "$dest" "$raw_file" <<'PY'
import json
import re
import sys
from pathlib import Path

dest = Path(sys.argv[1])
raw_file = Path(sys.argv[2])
text = raw_file.read_text()
text = re.sub(r"\x1b\[[0-9;]*[A-Za-z]", "", text).strip()

if not text:
    raise SystemExit("Expected JSON output but command returned nothing.")

try:
    parsed = json.loads(text)
except json.JSONDecodeError as exc:
    snippet = text[:1000]
    raise SystemExit(f"Failed to parse JSON output: {exc}\nOutput snippet:\n{snippet}")

dest.write_text(json.dumps(parsed))
PY
  then
    echo "Failed while parsing JSON from command: $*" >&2
    rm -f "$raw_file"
    exit 1
  fi
  rm -f "$raw_file"
}

extract_steps() {
  local progress_file="$1"

  python3 - "$progress_file" "$steps_mode" <<'PY'
import json
import sys
from pathlib import Path

progress = json.loads(Path(sys.argv[1]).read_text())
mode = sys.argv[2]

raw_steps = progress.get("steps_with_samples") or []
steps = sorted({int(step) for step in raw_steps})
if mode == "last3":
    steps = steps[-3:]

for step in steps:
    print(step)
PY
}

for run_id in "${run_ids[@]}"; do
  run_dir="${tmp_dir}/${run_id}"
  mkdir -p "${run_dir}/rollouts"

  echo "[fetch] run ${run_id}" >&2
  run_and_capture_json "${run_dir}/run.json" prime rl get "${run_id}" -o json
  run_and_capture_json "${run_dir}/progress.json" prime rl progress "${run_id}"
  run_and_capture_json "${run_dir}/checkpoints.json" prime rl checkpoints "${run_id}" -o json

  steps=()
  while IFS= read -r step; do
    steps+=("$step")
  done < <(extract_steps "${run_dir}/progress.json")
  if [[ ${#steps[@]} -eq 0 ]]; then
    echo "[fetch]   no sample steps found" >&2
  fi

  for step in "${steps[@]}"; do
    echo "[fetch]   step ${step}" >&2
    run_and_capture_json \
      "${run_dir}/rollouts/${step}.json" \
      prime rl rollouts "${run_id}" -s "${step}" -n "${limit}"
  done

  printf '%s\n' "${run_id}" >> "${tmp_dir}/run_ids.txt"
done

python3 - "$tmp_dir" "$output_path" "$steps_mode" "$limit" <<'PY'
import datetime as dt
import json
import sys
from pathlib import Path

tmp_dir = Path(sys.argv[1])
output_path = sys.argv[2]
steps_mode = sys.argv[3]
limit = int(sys.argv[4])

run_ids_file = tmp_dir / "run_ids.txt"
run_ids = [
    line.strip() for line in run_ids_file.read_text().splitlines() if line.strip()
] if run_ids_file.exists() else []

result = {
    "generated_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
    "steps_mode": steps_mode,
    "limit": limit,
    "runs": [],
}

for run_id in run_ids:
    run_dir = tmp_dir / run_id
    run_payload = json.loads((run_dir / "run.json").read_text())
    progress_payload = json.loads((run_dir / "progress.json").read_text())
    checkpoints_payload = json.loads((run_dir / "checkpoints.json").read_text())

    rollout_payloads_by_step = {}
    for rollout_file in sorted((run_dir / "rollouts").glob("*.json"), key=lambda p: int(p.stem)):
        rollout_payloads_by_step[rollout_file.stem] = json.loads(rollout_file.read_text())

    result["runs"].append(
        {
            "run_id": run_id,
            "run_payload": run_payload,
            "progress_payload": progress_payload,
            "checkpoints_payload": checkpoints_payload,
            "rollout_payloads_by_step": rollout_payloads_by_step,
        }
    )

output_text = json.dumps(result, indent=2)
if output_path == "-":
    print(output_text)
else:
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    output_file.write_text(output_text + "\n")
PY
