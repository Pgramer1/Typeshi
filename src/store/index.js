import { configureStore } from "@reduxjs/toolkit";
import settingsReducer from "./settingsSlice";

export const store = configureStore({
  reducer: {
    settings: settingsReducer,
  },
});

store.subscribe(() => {
  try {
    const { settings } = store.getState();
    localStorage.setItem("typeshi.settings", JSON.stringify(settings));
  } catch {
    // Ignore persistence errors in private mode or restricted environments.
  }
});
