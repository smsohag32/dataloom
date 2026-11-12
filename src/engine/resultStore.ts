import { useSyncExternalStore } from "react";
import type { QueryResult } from "@/types";

/**
 * Query results can be hundreds of thousands of rows — far too large (and not
 * serialisable-friendly) for Redux. They live here, keyed by tab id; Redux only
 * stores lightweight metadata (status, duration, row count).
 */
const results = new Map<string, QueryResult>();
let version = 0;
const listeners = new Set<() => void>();

const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

export const resultStore = {
  get: (tabId: string | null | undefined) => (tabId ? results.get(tabId) : undefined),
  set(tabId: string, r: QueryResult) {
    results.set(tabId, r);
    emit();
  },
  delete(tabId: string) {
    if (results.delete(tabId)) emit();
  },
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Subscribe to the result of a tab. */
export function useResult(tabId: string | null | undefined): QueryResult | undefined {
  useSyncExternalStore(subscribe, () => version);
  return resultStore.get(tabId);
}

