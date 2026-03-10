const RUN_SELECTION_STORAGE_KEY = "prime-lab-selected-runs-by-environment.v1";
const ROLLOUT_VIEW_MODE_STORAGE_KEY = "prime-lab-rollout-view-mode.v1";

type RunSelectionStore = Record<string, string[]>;
export type RolloutDataViewMode = "table" | "split" | "grid";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRolloutDataViewMode(value: unknown): value is RolloutDataViewMode {
  return value === "table" || value === "split" || value === "grid";
}

export function readRunSelectionStore(): RunSelectionStore {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(RUN_SELECTION_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const result: RunSelectionStore = {};
    for (const [environment, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isStringArray(value)) {
        continue;
      }
      result[environment] = [...new Set(value)];
    }
    return result;
  } catch {
    return {};
  }
}

export function writeRunSelectionStore(store: RunSelectionStore): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(RUN_SELECTION_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore localStorage write errors.
  }
}

export function readRolloutViewModeStore(): RolloutDataViewMode {
  if (typeof window === "undefined") {
    return "table";
  }

  try {
    const raw = window.localStorage.getItem(ROLLOUT_VIEW_MODE_STORAGE_KEY);
    if (!raw) {
      return "table";
    }

    const parsed = JSON.parse(raw) as unknown;
    return isRolloutDataViewMode(parsed) ? parsed : "table";
  } catch {
    return "table";
  }
}

export function writeRolloutViewModeStore(mode: RolloutDataViewMode): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ROLLOUT_VIEW_MODE_STORAGE_KEY, JSON.stringify(mode));
  } catch {
    // Ignore localStorage write errors.
  }
}
