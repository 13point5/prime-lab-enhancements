const RUN_SELECTION_STORAGE_KEY = "prime-lab-selected-runs-by-environment.v1";

type RunSelectionStore = Record<string, string[]>;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
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

