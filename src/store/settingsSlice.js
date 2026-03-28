import { createSlice } from "@reduxjs/toolkit";

const DEFAULT_SETTINGS = {
  selectedMode: "time",
  selectedTime: 60,
  selectedWordCount: 60,
  soundEnabled: true,
  brainrotEnabled: false,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem("typeshi.settings");
    if (!raw) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(raw);
    return {
      selectedMode: ["time", "words"].includes(parsed.selectedMode)
        ? parsed.selectedMode
        : DEFAULT_SETTINGS.selectedMode,
      selectedTime: [15, 30, 60].includes(parsed.selectedTime)
        ? parsed.selectedTime
        : DEFAULT_SETTINGS.selectedTime,
      selectedWordCount: [10, 25, 60].includes(parsed.selectedWordCount)
        ? parsed.selectedWordCount
        : DEFAULT_SETTINGS.selectedWordCount,
      soundEnabled:
        typeof parsed.soundEnabled === "boolean"
          ? parsed.soundEnabled
          : DEFAULT_SETTINGS.soundEnabled,
      brainrotEnabled:
        typeof parsed.brainrotEnabled === "boolean"
          ? parsed.brainrotEnabled
          : DEFAULT_SETTINGS.brainrotEnabled,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const settingsSlice = createSlice({
  name: "settings",
  initialState: loadSettings(),
  reducers: {
    setSelectedMode(state, action) {
      state.selectedMode = action.payload;
    },
    setSelectedTime(state, action) {
      state.selectedTime = action.payload;
    },
    setSelectedWordCount(state, action) {
      state.selectedWordCount = action.payload;
    },
    toggleSound(state) {
      state.soundEnabled = !state.soundEnabled;
    },
    toggleBrainrot(state) {
      state.brainrotEnabled = !state.brainrotEnabled;
    },
  },
});

export const {
  setSelectedMode,
  setSelectedTime,
  setSelectedWordCount,
  toggleSound,
  toggleBrainrot,
} = settingsSlice.actions;

export default settingsSlice.reducer;
