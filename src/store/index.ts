import { configureStore } from "@reduxjs/toolkit";
import workspace from "./slices/workspaceSlice";
import query from "./slices/querySlice";
import grid from "./slices/gridSlice";
import ui from "./slices/uiSlice";

export const store = configureStore({
  reducer: { workspace, query, grid, ui },
  middleware: (gdm) => gdm({ serializableCheck: true, immutableCheck: false }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppThunk<R = void> = (dispatch: AppDispatch, getState: () => RootState) => Promise<R>;

