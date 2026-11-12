import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { SortingState, VisibilityState } from "@tanstack/react-table";
import type { OutputView } from "@/types";

export interface SelectedCell {
  column: string;
  rowIndex: number;
  value: string | number | boolean | null;
}

interface GridState {
  sorting: SortingState;
  columnVisibility: VisibilityState;
  globalFilter: string;
  selectedCell: SelectedCell | null;
  outputView: OutputView;
}

const initialState: GridState = {
  sorting: [],
  columnVisibility: {},
  globalFilter: "",
  selectedCell: null,
  outputView: "table",
};

const slice = createSlice({
  name: "grid",
  initialState,
  reducers: {
    sortingChanged(s, a: PayloadAction<SortingState>) {
      s.sorting = a.payload;
    },
    visibilityChanged(s, a: PayloadAction<VisibilityState>) {
      s.columnVisibility = a.payload;
    },
    filterChanged(s, a: PayloadAction<string>) {
      s.globalFilter = a.payload;
    },
    cellSelected(s, a: PayloadAction<SelectedCell | null>) {
      s.selectedCell = a.payload;
    },
    outputViewChanged(s, a: PayloadAction<OutputView>) {
      s.outputView = a.payload;
    },
    /** Reset view state that depends on the result's column set. */
    resultReset(s) {
      s.sorting = [];
      s.columnVisibility = {};
      s.selectedCell = null;
    },
  },
});

export const gridActions = slice.actions;
export default slice.reducer;

