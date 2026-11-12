import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ResolvedTheme, ThemeMode } from "@/types";

export const THEME_KEY = "dataloom-theme";

function systemTheme(): ResolvedTheme {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === "system" ? systemTheme() : mode;
}

function initialTheme(): ThemeMode {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "light" || t === "dark" || t === "system") return t;
  } catch {
    /* ignore */
  }
  return "system";
}

interface UiState {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  dragging: boolean;
}

const theme = initialTheme();
const initialState: UiState = {
  theme,
  resolvedTheme: resolveTheme(theme),
  sidebarCollapsed: false,
  commandPaletteOpen: false,
  dragging: false,
};

const slice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    themeSet(s, a: PayloadAction<ThemeMode>) {
      s.theme = a.payload;
      s.resolvedTheme = resolveTheme(a.payload);
    },
    systemThemeChanged(s) {
      if (s.theme === "system") s.resolvedTheme = systemTheme();
    },
    sidebarToggled(s) {
      s.sidebarCollapsed = !s.sidebarCollapsed;
    },
    sidebarSet(s, a: PayloadAction<boolean>) {
      s.sidebarCollapsed = a.payload;
    },
    paletteSet(s, a: PayloadAction<boolean>) {
      s.commandPaletteOpen = a.payload;
    },
    draggingSet(s, a: PayloadAction<boolean>) {
      s.dragging = a.payload;
    },
  },
});

export const uiActions = slice.actions;
export default slice.reducer;

