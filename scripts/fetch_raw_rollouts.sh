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
    --output raw-rollouts-multi-2026-03-10.json runA runB runC

When the output path matches `raw-rollouts-*.json`, the script consolidates all
existing rollout snapshot files in that directory into the chosen output file,
dedupes runs by run ID, and removes the older sibling snapshot files so only
one remains.

This script also fetches:
  - run metadata (`prime rl get`)
  - progress (`prime rl progress`)
  - checkpoints (`prime rl checkpoints`)
  - training metrics (`prime rl metrics`)
  - reward/advantage distributions for all available distribution steps
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

  if ! raw="$(COLUMNS=1000000 "$@" 2>"$err_file")"; then
    echo "Command failed: $*" >&2
    cat "$err_file" >&2
    rm -f "$err_file"
    rm -f "$raw_file"
    return 1
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


def repair_json_text(source: str) -> str:
    result: list[str] = []
    in_string = False
    index = 0
    hex_digits = set("0123456789abcdefABCDEF")

    while index < len(source):
        char = source[index]

        if not in_string:
            result.append(char)
            if char == '"':
                in_string = True
            index += 1
            continue

        if char == '"':
            result.append(char)
            in_string = False
            index += 1
            continue

        if char == "\\":
            if index + 1 >= len(source):
                result.append("\\\\")
                index += 1
                continue

            next_char = source[index + 1]
            if next_char in '"\\/bfnrt':
                result.append(char)
                result.append(next_char)
                index += 2
                continue

            if next_char == "u":
                unicode_escape = source[index + 2:index + 6]
                if len(unicode_escape) == 4 and all(digit in hex_digits for digit in unicode_escape):
                    result.append("\\u")
                    result.append(unicode_escape)
                    index += 6
                    continue

            result.append("\\\\")
            index += 1
            continue

        if char == "\n":
            result.append("\\n")
            index += 1
            continue

        if char == "\r":
            result.append("\\r")
            index += 1
            continue

        if char == "\t":
            result.append("\\t")
            index += 1
            continue

        if ord(char) < 0x20:
            result.append(f"\\u{ord(char):04x}")
            index += 1
            continue

        result.append(char)
        index += 1

    return "".join(result)

if not text:
    raise SystemExit("Expected JSON output but command returned nothing.")

try:
    parsed = json.loads(text)
except json.JSONDecodeError as exc:
    repaired = repair_json_text(text)
    try:
        parsed = json.loads(repaired)
    except json.JSONDecodeError:
        snippet = text[:1000]
        raise SystemExit(f"Failed to parse JSON output: {exc}\nOutput snippet:\n{snippet}") from exc

dest.write_text(json.dumps(parsed))
PY
  then
    echo "Failed while parsing JSON from command: $*" >&2
    rm -f "$raw_file"
    return 1
  fi
  rm -f "$raw_file"
  return 0
}

run_and_capture_json_quiet() {
  local dest="$1"
  shift
  run_and_capture_json "$dest" "$@" 2>/dev/null
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

extract_distribution_steps() {
  local progress_file="$1"

  python3 - "$progress_file" <<'PY'
import json
import sys
from pathlib import Path

progress = json.loads(Path(sys.argv[1]).read_text())
raw_steps = progress.get("steps_with_distributions") or []
steps = sorted({int(step) for step in raw_steps})

for step in steps:
    print(step)
PY
}

read_rollout_page_meta() {
  local payload_file="$1"

  python3 - "$payload_file" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text())
samples = payload.get("samples") or []
total = payload.get("total")

print(len(samples))
print(total if isinstance(total, int) else "")
PY
}

merge_rollout_pages() {
  local pages_dir="$1"
  local dest="$2"
  local run_id="$3"
  local limit="$4"

  python3 - "$pages_dir" "$dest" "$run_id" "$limit" <<'PY'
import json
import sys
from pathlib import Path

pages_dir = Path(sys.argv[1])
dest = Path(sys.argv[2])
run_id = sys.argv[3]
limit = int(sys.argv[4])

samples = []
total = None
for payload_file in sorted(pages_dir.glob("*.json"), key=lambda p: int(p.stem)):
    payload = json.loads(payload_file.read_text())
    page_samples = payload.get("samples") or []
    if total is None and isinstance(payload.get("total"), int):
        total = payload["total"]
    samples.extend(page_samples)

samples = samples[:limit]
result = {
    "run_id": run_id,
    "samples": samples,
    "total": total if total is not None else len(samples),
    "page": 1,
    "limit": len(samples),
    "total_pages": 1,
}

dest.write_text(json.dumps(result))
PY
}

fetch_rollout_payload() {
  local run_id="$1"
  local step="$2"
  local limit="$3"
  local dest="$4"
  local pages_dir="${dest%.json}.pages"
  local page=1
  local collected=0
  local total=""
  local consecutive_failures=0

  mkdir -p "$pages_dir"

  while (( collected < limit )); do
    local page_file="${pages_dir}/${page}.json"

    if ! run_and_capture_json_quiet "$page_file" prime rl rollouts "$run_id" -s "$step" -n 1 -p "$page"; then
      echo "[fetch]     page ${page} failed; skipping" >&2
      rm -f "$page_file"
      consecutive_failures=$((consecutive_failures + 1))
      if (( consecutive_failures >= 3 )); then
        break
      fi
      if [[ -n "$total" ]] && (( page >= total )); then
        break
      fi
      page=$((page + 1))
      continue
    fi

    local page_count="0"
    local page_total=""
    local meta_index=0
    while IFS= read -r meta_line; do
      if (( meta_index == 0 )); then
        page_count="$meta_line"
      elif (( meta_index == 1 )); then
        page_total="$meta_line"
      fi
      meta_index=$((meta_index + 1))
    done < <(read_rollout_page_meta "$page_file")

    if [[ -n "$page_total" ]]; then
      total="$page_total"
    fi

    if (( page_count == 0 )); then
      rm -f "$page_file"
      break
    fi

    consecutive_failures=0
    collected=$((collected + page_count))
    if [[ -n "$total" ]] && (( page >= total )); then
      break
    fi

    page=$((page + 1))
  done

  merge_rollout_pages "$pages_dir" "$dest" "$run_id" "$limit"
}

for run_id in "${run_ids[@]}"; do
  run_dir="${tmp_dir}/${run_id}"
  mkdir -p "${run_dir}/rollouts" "${run_dir}/distributions"

  echo "[fetch] run ${run_id}" >&2
  run_and_capture_json "${run_dir}/run.json" prime rl get "${run_id}" -o json || exit 1
  run_and_capture_json "${run_dir}/progress.json" prime rl progress "${run_id}" || exit 1
  run_and_capture_json "${run_dir}/checkpoints.json" prime rl checkpoints "${run_id}" -o json || exit 1
  run_and_capture_json "${run_dir}/metrics.json" prime rl metrics "${run_id}" || exit 1

  steps=()
  while IFS= read -r step; do
    steps+=("$step")
  done < <(extract_steps "${run_dir}/progress.json")
  if [[ ${#steps[@]} -eq 0 ]]; then
    echo "[fetch]   no sample steps found" >&2
  fi

  for step in "${steps[@]}"; do
    echo "[fetch]   step ${step}" >&2
    fetch_rollout_payload \
      "${run_id}" \
      "${step}" \
      "${limit}" \
      "${run_dir}/rollouts/${step}.json" \
      || exit 1
  done

  distribution_steps=()
  while IFS= read -r step; do
    distribution_steps+=("$step")
  done < <(extract_distribution_steps "${run_dir}/progress.json")
  if [[ ${#distribution_steps[@]} -eq 0 ]]; then
    echo "[fetch]   no distribution steps found" >&2
  fi

  for step in "${distribution_steps[@]}"; do
    echo "[fetch]   distribution step ${step}" >&2
    run_and_capture_json \
      "${run_dir}/distributions/${step}.json" \
      prime rl distributions "${run_id}" -s "${step}" \
      || exit 1
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
    metrics_payload = json.loads((run_dir / "metrics.json").read_text())

    rollout_payloads_by_step = {}
    for rollout_file in sorted((run_dir / "rollouts").glob("*.json"), key=lambda p: int(p.stem)):
        rollout_payloads_by_step[rollout_file.stem] = json.loads(rollout_file.read_text())

    distributions_payloads_by_step = {}
    for distribution_file in sorted((run_dir / "distributions").glob("*.json"), key=lambda p: int(p.stem)):
        distributions_payloads_by_step[distribution_file.stem] = json.loads(distribution_file.read_text())

    result["runs"].append(
        {
            "run_id": run_id,
            "run_payload": run_payload,
            "progress_payload": progress_payload,
            "checkpoints_payload": checkpoints_payload,
            "metrics_payload": metrics_payload,
            "distributions_payloads_by_step": distributions_payloads_by_step,
            "rollout_payloads_by_step": rollout_payloads_by_step,
        }
    )

def is_snapshot_file(path: Path) -> bool:
    return path.name.startswith("raw-rollouts-") and path.suffix.lower() == ".json"


def canonical_run_id(run: dict) -> str | None:
    payload = run.get("run_payload")
    if isinstance(payload, dict):
        run_meta = payload.get("run")
        if isinstance(run_meta, dict):
            run_id = run_meta.get("id")
            if isinstance(run_id, str) and run_id:
                return run_id

    run_id = run.get("run_id")
    if isinstance(run_id, str) and run_id:
        return run_id
    return None


def merge_mapping(base: object, incoming: object) -> dict:
    merged: dict = {}
    if isinstance(base, dict):
        merged.update(base)
    if isinstance(incoming, dict):
        merged.update(incoming)
    return merged


def merge_run_records(base: dict, incoming: dict) -> dict:
    merged = dict(base)
    merged.update(incoming)

    for key in ("run_payload", "progress_payload", "checkpoints_payload", "metrics_payload"):
        if key in incoming and incoming.get(key) is not None:
            merged[key] = incoming[key]
        elif key in base:
            merged[key] = base[key]

    merged["rollout_payloads_by_step"] = merge_mapping(
        base.get("rollout_payloads_by_step"),
        incoming.get("rollout_payloads_by_step"),
    )
    merged["distributions_payloads_by_step"] = merge_mapping(
        base.get("distributions_payloads_by_step"),
        incoming.get("distributions_payloads_by_step"),
    )
    merged["run_id"] = incoming.get("run_id") or base.get("run_id")

    return merged


def merge_snapshots(existing_snapshots: list[dict], generated_snapshot: dict) -> dict:
    merged_runs: dict[str, dict] = {}
    modes: list[str] = []
    limits: list[int] = []

    for snapshot in [*existing_snapshots, generated_snapshot]:
        mode = snapshot.get("steps_mode")
        if isinstance(mode, str) and mode:
            modes.append(mode)

        limit_value = snapshot.get("limit")
        if isinstance(limit_value, int):
            limits.append(limit_value)

        for run in snapshot.get("runs", []):
            if not isinstance(run, dict):
                continue

            run_id = canonical_run_id(run)
            if not run_id:
                continue

            if run_id in merged_runs:
                merged_runs[run_id] = merge_run_records(merged_runs[run_id], run)
            else:
                merged_runs[run_id] = run

    merged_mode = generated_snapshot.get("steps_mode", "all")
    distinct_modes = {mode for mode in modes if mode}
    if len(distinct_modes) > 1:
        merged_mode = "mixed"
    elif len(distinct_modes) == 1:
        merged_mode = next(iter(distinct_modes))

    merged_limit = max(limits) if limits else generated_snapshot.get("limit", 100)

    return {
        "generated_at": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "steps_mode": merged_mode,
        "limit": merged_limit,
        "runs": list(merged_runs.values()),
    }


if output_path == "-":
    print(json.dumps(result, indent=2))
else:
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    existing_snapshots: list[dict] = []
    sibling_snapshot_files: list[Path] = []

    if is_snapshot_file(output_file):
        sibling_snapshot_files = sorted(
            output_file.parent.glob("raw-rollouts-*.json"),
            key=lambda path: (path.stat().st_mtime, path.name),
        )
        for snapshot_file in sibling_snapshot_files:
            existing_snapshots.append(json.loads(snapshot_file.read_text()))

    merged_result = merge_snapshots(existing_snapshots, result)
    output_file.write_text(json.dumps(merged_result, indent=2) + "\n")

    if is_snapshot_file(output_file):
        output_resolved = output_file.resolve()
        for snapshot_file in sibling_snapshot_files:
            if snapshot_file.resolve() != output_resolved:
                snapshot_file.unlink()
PY
