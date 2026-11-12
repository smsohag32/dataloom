import { get, set } from "idb-keyval";
import { store } from "./index";
import { queryActions } from "./slices/querySlice";
import { uiActions, THEME_KEY } from "./slices/uiSlice";

const KEY = "dataloom:v1";

interface Persisted {
  history?: ReturnType<typeof store.getState>["query"]["history"];
  snippets?: ReturnType<typeof store.getState>["query"]["snippets"];
  sidebarCollapsed?: boolean;
}

/** Load persisted workspace preferences, then keep IndexedDB in sync (debounced). */
export async function initPersistence(): Promise<void> {
  try {
    const saved = await get<Persisted>(KEY);
    if (saved) {
      store.dispatch(queryActions.hydrated({ history: saved.history, snippets: saved.snippets }));
      if (typeof saved.sidebarCollapsed === "boolean") store.dispatch(uiActions.sidebarSet(saved.sidebarCollapsed));
    }
  } catch {
    /* IndexedDB unavailable (private mode) – run without persistence. */
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = "";
  store.subscribe(() => {
    const s = store.getState();
    try {
      localStorage.setItem(THEME_KEY, s.ui.theme);
    } catch {
      /* ignore */
    }
    const snapshot: Persisted = {
      history: s.query.history,
      snippets: s.query.snippets,
      sidebarCollapsed: s.ui.sidebarCollapsed,
    };
    const json = JSON.stringify(snapshot);
    if (json === last) return;
    last = json;
    clearTimeout(timer);
    timer = setTimeout(() => void set(KEY, snapshot).catch(() => undefined), 400);
  });
}

