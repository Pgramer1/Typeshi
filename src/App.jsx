import { useEffect, useRef, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { generateTest } from "./words";
import { useSound } from "./useSound";
import {
  setSelectedMode,
  setSelectedTime,
  setSelectedWordCount,
  toggleSound,
  toggleBrainrot,
} from "./store/settingsSlice";

const TIME_MODES = [15, 30, 60];
const WORD_MODES = [10, 25, 60];
const BRAINROT_DECOR = [
  { icon: "🔥", top: "16%", left: "14%", delay: "0s" },
  { icon: "💀", top: "24%", left: "18%", delay: "0.4s" },
  { icon: "💯", top: "18%", right: "14%", delay: "0.2s" },
  { icon: "👾", top: "30%", right: "17%", delay: "0.6s" },
  { icon: "⚡", top: "65%", left: "18%", delay: "0.3s" },
  { icon: "💩", top: "63%", right: "20%", delay: "0.8s" },
];
const BRAINROT_POP_TEXT = [
  "sheesh!",
  "GOAT",
  "rizzler!",
  "ohio energy",
  "sigma!",
  "aura+",
];
const BRAINROT_TIER_TEXT = {
  elite: ["GOAT", "sigma!", "aura+", "sheesh!"],
  good: ["sheesh!", "rizzler!", "aura+", "GOAT"],
  okay: ["ohio energy", "rizzler!", "sheesh!"],
  low: ["ohio energy", "sheesh!"],
};
const BRAINROT_TIER_EMOJI = {
  elite: "💯",
  good: "🔥",
  okay: "💀",
  low: "💩",
};
const BRAINROT_TIER_COLOR = {
  elite: "#ffe66d",
  good: "#7dff00",
  okay: "#95f2ff",
  low: "#ff72d2",
};
const BRAINROT_TIER_SHADOW = {
  elite: "0 0 12px rgba(255,230,109,0.95), 0 0 20px rgba(255,132,77,0.65)",
  good: "0 0 10px rgba(125,255,0,0.9), 0 0 18px rgba(255,114,210,0.6)",
  okay: "0 0 10px rgba(149,242,255,0.9), 0 0 18px rgba(108,170,255,0.5)",
  low: "0 0 10px rgba(255,114,210,0.85), 0 0 18px rgba(165,114,255,0.5)",
};

// Split sentence into words for word-based rendering
function buildWords(sentence) {
  return sentence.split(" ").map((word) => word.split(""));
}

function App() {
  const dispatch = useDispatch();
  const selectedMode = useSelector((state) => state.settings.selectedMode);
  const selectedTime = useSelector((state) => state.settings.selectedTime);
  const selectedWordCount = useSelector(
    (state) => state.settings.selectedWordCount,
  );
  const soundEnabled = useSelector((state) => state.settings.soundEnabled);
  const brainrotEnabled = useSelector((state) => state.settings.brainrotEnabled);

  const [sentence, setSentence] = useState(() =>
    generateTest(selectedWordCount, brainrotEnabled),
  );
  const [input, setInput] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [wpm, setWpm] = useState(0);
  const [hasFinished, setHasFinished] = useState(false);
  const [liveWpm, setLiveWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [timeLeft, setTimeLeft] = useState(selectedTime);
  const [timerRunning, setTimerRunning] = useState(false);
  const [errors, setErrors] = useState(0);
  const [totalTyped, setTotalTyped] = useState(0);
  const [caretPos, setCaretPos] = useState({ top: 0, left: 0 });
  const [errorWordIndex, setErrorWordIndex] = useState(null); // for shake animation
  const [brainrotPops, setBrainrotPops] = useState([]);

  const containerRef = useRef(null);
  const wordsRef = useRef(null);
  const charRefs = useRef({}); // key: globalCharIndex -> DOM span
  const lastPopAtRef = useRef(0);
  const popTimeoutsRef = useRef([]);
  const { playClick, playError } = useSound(soundEnabled);
// Build words array for rendering and indexing
  const words = buildWords(sentence);

  // Global char index -> word index + char index within word
  const getWordAndCharIndex = useCallback(
    (globalIndex) => {
      let idx = 0;
      for (let w = 0; w < words.length; w++) {
        if (globalIndex < idx + words[w].length) {
          return { wordIndex: w, charIndex: globalIndex - idx };
        }
        idx += words[w].length + 1; // +1 for space
      }
      return null;
    },
    [words],
  );

  const getPerformanceTier = useCallback((currentWpm, currentAccuracy) => {
    if (currentWpm >= 100 || currentAccuracy >= 96) return "elite";
    if (currentWpm >= 72 || currentAccuracy >= 90) return "good";
    if (currentWpm >= 42 || currentAccuracy >= 80) return "okay";
    return "low";
  }, []);

  const spawnBrainrotPop = useCallback((tier) => {
    if (!brainrotEnabled) return;

    const isEmoji = Math.random() < 0.5;
    const textPool = BRAINROT_TIER_TEXT[tier] || BRAINROT_POP_TEXT;
    const payload = isEmoji
      ? BRAINROT_TIER_EMOJI[tier]
      : textPool[Math.floor(Math.random() * textPool.length)];

    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const next = {
      id,
      payload,
      top: `${32 + Math.random() * 46}%`,
      left: `${14 + Math.random() * 72}%`,
      rotate: `${-20 + Math.random() * 40}deg`,
      size: isEmoji ? `${2 + Math.random() * 1.2}rem` : `${1 + Math.random() * 0.65}rem`,
      color: BRAINROT_TIER_COLOR[tier],
      shadow: BRAINROT_TIER_SHADOW[tier],
      duration: 2 + Math.random() * 0.8,
    };

    setBrainrotPops((prev) => [...prev.slice(-18), next]);

    const timeoutId = window.setTimeout(() => {
      setBrainrotPops((prev) => prev.filter((pop) => pop.id !== id));
      popTimeoutsRef.current = popTimeoutsRef.current.filter((activeId) => activeId !== timeoutId);
    }, 2400);
    popTimeoutsRef.current.push(timeoutId);
  }, [brainrotEnabled]);
// Start a fresh test with given time and word count (used for mode changes and resets)
  const startFreshTest = useCallback((nextTime, nextWordCount, nextBrainrot) => {
    setInput("");
    setStartTime(null);
    setWpm(0);
    setLiveWpm(0);
    setAccuracy(100);
    setHasFinished(false);
    setTimeLeft(nextTime);
    setTimerRunning(false);
    setErrors(0);
    setTotalTyped(0);
    setSentence(generateTest(nextWordCount, nextBrainrot));
    setBrainrotPops([]);
    setErrorWordIndex(null);
    setTimeout(() => containerRef.current?.focus(), 0);
  }, []);

// Reset test on mode or settings change
  const resetTest = useCallback(() => {
    startFreshTest(selectedTime, selectedWordCount, brainrotEnabled);
  }, [selectedTime, selectedWordCount, brainrotEnabled, startFreshTest]);

  // Auto-focus on mount
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      popTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    };
  }, []);

  // Sync timeLeft when selectedTime changes (before test starts)
  useEffect(() => {
    if (!timerRunning && !hasFinished) {
      setTimeLeft(selectedTime);
    }
  }, [selectedTime, timerRunning, hasFinished]);

  // Timer countdown
  useEffect(() => {
    if (selectedMode !== "time" || !timerRunning || timeLeft === 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimerRunning(false);
          setHasFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedMode, timerRunning, timeLeft]);

  // WPM = correctly completed words / elapsed minutes
  const calcWpm = useCallback((typedInput, targetSentence, elapsed) => {
    if (elapsed <= 0) return 0;
    const targetWords = targetSentence.split(" ");
    let charIndex = 0;
    let correctWords = 0;
    for (const word of targetWords) {
      const typedWord = typedInput.slice(charIndex, charIndex + word.length);
      if (typedWord === word) correctWords++;
      charIndex += word.length + 1;
      if (charIndex > typedInput.length) break;
    }
    return Math.round(correctWords / elapsed);
  }, []);

  // Live WPM
  useEffect(() => {
    if (startTime && input.length > 0) {
      const elapsedMinutes = (Date.now() - startTime) / 1000 / 60;
      setLiveWpm(calcWpm(input, sentence, elapsedMinutes));
    } else {
      setLiveWpm(0);
    }
  }, [input, startTime, sentence, calcWpm]);

  useEffect(() => {
    if (!brainrotEnabled || !startTime || hasFinished || input.length < 3) return;

    const numericAccuracy = Number.parseFloat(String(accuracy)) || 0;
    const tier = getPerformanceTier(liveWpm, numericAccuracy);

    const now = Date.now();
    const burstGap = {
      elite: 160,
      good: 240,
      okay: 340,
      low: 460,
    }[tier];

    if (now - lastPopAtRef.current < burstGap) return;

    lastPopAtRef.current = now;
    const burstCount = {
      elite: 3,
      good: 2,
      okay: 2,
      low: 1,
    }[tier];

    for (let i = 0; i < burstCount; i++) {
      spawnBrainrotPop(tier);
    }
  }, [
    brainrotEnabled,
    startTime,
    hasFinished,
    input,
    liveWpm,
    accuracy,
    getPerformanceTier,
    spawnBrainrotPop,
  ]);

  // Accuracy = correct keypresses / total keypresses
  useEffect(() => {
    if (totalTyped === 0) {
      setAccuracy(100);
      return;
    }
    const correctPresses = totalTyped - errors;
    setAccuracy(((correctPresses / totalTyped) * 100).toFixed(1));
  }, [totalTyped, errors]);

  // Finish detection
  useEffect(() => {
    if (
      !hasFinished
      && startTime
      && selectedMode === "words"
      && input.length >= sentence.length
    ) {
      const elapsedMinutes = (Date.now() - startTime) / 1000 / 60;
      setWpm(calcWpm(input, sentence, elapsedMinutes));
      setHasFinished(true);
      setTimerRunning(false);
    }
  }, [input, sentence, startTime, hasFinished, calcWpm, selectedMode]);

  // Final WPM on timer end
  useEffect(() => {
    if (hasFinished && startTime) {
      const elapsedMinutes = (Date.now() - startTime) / 1000 / 60;
      const finalWpm = calcWpm(input, sentence, elapsedMinutes);
      setWpm(finalWpm > 0 ? finalWpm : liveWpm);
    }
  }, [hasFinished, startTime, input, sentence, liveWpm, calcWpm]);

  // Update caret position based on current char span
  useEffect(() => {
    const span = charRefs.current[input.length];
    const container = wordsRef.current;
    if (span && container) {
      const spanRect = span.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setCaretPos({
        top: spanRect.top - containerRect.top,
        left: spanRect.left - containerRect.left,
      });
    }
  }, [input]);

  // Keydown handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        resetTest();
        return;
      }
      if (hasFinished) return;

      if (e.key === "Backspace") {
        setInput((prev) => prev.slice(0, -1));
        return;
      }
      if (e.key.length !== 1) return;
// Start timer on first keypress
      if (!startTime) {
        setStartTime(Date.now());
        setTimerRunning(selectedMode === "time");
      }
// Auto-extend sentence in time mode if nearing end
      let activeSentence = sentence;
      if (selectedMode === "words" && input.length >= activeSentence.length) return;
      if (selectedMode === "time" && input.length >= activeSentence.length) {
        activeSentence = `${activeSentence} ${generateTest(selectedWordCount, brainrotEnabled)}`;
        setSentence(activeSentence);
      }
      if (input.length >= activeSentence.length) return;
// Check correctness of the keypress
      const nextChar = activeSentence[input.length];
      const isCorrect = e.key === nextChar;
      setTotalTyped((prev) => prev + 1);

      if (isCorrect) {
        playClick();
      } else {
        playError();
        setErrors((prev) => prev + 1);
        // Shake the current word
        const pos = getWordAndCharIndex(input.length);
        if (pos) {
          setErrorWordIndex(pos.wordIndex);
          setTimeout(() => setErrorWordIndex(null), 400);
        }
      }

      // Always advance cursor (wrong chars render red)
      setInput((prev) => prev + e.key);
    };
// Attach keydown listener to the window to capture all keypresses, not just when the container is focused
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    input,
    hasFinished,
    startTime,
    sentence,
    selectedMode,
    selectedWordCount,
    brainrotEnabled,
    playClick,
    playError,
    getWordAndCharIndex,
    resetTest,
  ]);
// Handlers for mode and setting changes
  const handleModeSelect = (mode) => {
    if (timerRunning || selectedMode === mode) return;
    dispatch(setSelectedMode(mode));
    startFreshTest(selectedTime, selectedWordCount, brainrotEnabled);
  };

  const handleTimeSelect = (t) => {
    if (timerRunning || (selectedMode === "time" && selectedTime === t)) return;
    dispatch(setSelectedMode("time"));
    dispatch(setSelectedTime(t));
    startFreshTest(t, selectedWordCount, brainrotEnabled);
  };

  const handleWordCountSelect = (count) => {
    if (timerRunning || (selectedMode === "words" && selectedWordCount === count)) return;
    dispatch(setSelectedMode("words"));
    dispatch(setSelectedWordCount(count));
    startFreshTest(selectedTime, count, brainrotEnabled);
  };

  const handleBrainrotToggle = () => {
    if (timerRunning) return;
    const nextBrainrot = !brainrotEnabled;
    dispatch(toggleBrainrot());
    startFreshTest(selectedTime, selectedWordCount, nextBrainrot);
  };
// Derived values for rendering
  const timerPercent = (timeLeft / selectedTime) * 100;
  const typedWords = input.trim() ? input.trim().split(/\s+/).length : 0;
  const typedWordsDisplay = Math.min(typedWords, selectedWordCount);
  const wordsProgressPercent = Math.min((typedWords / selectedWordCount) * 100, 100);
  const theme = brainrotEnabled
    ? {
      appBackground:
          "radial-gradient(circle at 25% 15%, #2d0a52 0%, #0a122c 42%, #061a23 70%, #13070f 100%)",
      panelBackground: "linear-gradient(135deg, #140a23 0%, #061a22 50%, #220e2f 100%)",
      panelBorder: "#7a35ff",
      panelShadow: "0 0 14px rgba(122,53,255,0.8), 0 0 24px rgba(0,255,153,0.45)",
      accent: "#7dff00",
      accentAlt: "#ff72d2",
      accentText: "#0b0b0c",
      muted: "#cdc3ff",
      subtle: "#95f2ff",
      cardBackground: "#0b1023",
      controlBackground: "#0b1321",
      wordDefault: "#9092a8",
      wordCorrect: "#f4f8ff",
      wordWrong: "#ff5c86",
      danger: "#ff5c86",
      kbdBackground: "#241838",
      uiFont: "'Press Start 2P', 'JetBrains Mono', monospace",
      wordFont: "'VT323', 'JetBrains Mono', monospace",
    }
    : {
      appBackground: "#0e0e0f",
      panelBackground: "linear-gradient(180deg, #17181b 0%, #131416 100%)",
      panelBorder: "#242428",
      panelShadow: "0 12px 28px rgba(0,0,0,0.25)",
      accent: "#e2b714",
      accentAlt: "#e2b714",
      accentText: "#0e0e0f",
      muted: "#8c8f94",
      subtle: "#7f8288",
      cardBackground: "#1f2024",
      controlBackground: "#202024",
      wordDefault: "#3a3d42",
      wordCorrect: "#d1d0c5",
      wordWrong: "#ca4754",
      danger: "#ca4754",
      kbdBackground: "#1a1a1c",
      uiFont: "'JetBrains Mono', monospace",
      wordFont: "'JetBrains Mono', monospace",
    };
  const modeHint =
    selectedMode === "time"
      ? `time mode active - test ends in ${selectedTime}s`
      : `words mode active - test ends at ${selectedWordCount} words`;
  const brainrotHint = brainrotEnabled
    ? "brainrot mode on - funky visuals + slang word pool"
    : "classic mode on - clean visuals + default word pool";
  const hasStarted = !!startTime;

  // -- Results Screen ----------------------------------------------------------
  if (hasFinished) {
    const finalWpm = wpm || liveWpm;
    const correctChars = input.split("").filter((c, i) => c === sentence[i]).length;
    const grade =
      finalWpm >= 100
        ? { label: "S", color: "#e2b714" }
        : finalWpm >= 80
          ? { label: "A", color: "#4caf50" }
          : finalWpm >= 60
            ? { label: "B", color: "#2196f3" }
            : finalWpm >= 40
              ? { label: "C", color: "#ff9800" }
              : { label: "D", color: "#ca4754" };

    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-10 px-4"
        style={{ background: theme.appBackground, fontFamily: theme.uiFont }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 absolute top-6 left-8">
          <img
            src="/TypeShi_logo.png"
            alt="TypeShi"
            style={{ height: "28px", opacity: 0.7 }}
          />
          <span
            className="font-mono font-bold text-lg"
            style={{
              color: theme.accent,
              opacity: 0.9,
              fontFamily: theme.uiFont,
              textShadow: brainrotEnabled ? "0 0 10px rgba(125,255,0,0.7)" : "none",
            }}
          >
            TypeShi
          </span>
        </div>

        <div className="results-card flex flex-col items-center gap-8 w-full max-w-xl">
          <p
            className="text-xs font-mono uppercase tracking-[0.3em]"
            style={{ color: theme.muted }}
          >
            - results -
          </p>

          {/* WPM + Grade */}
          <div className="flex items-end gap-6">
            <div className="text-center">
              <div
                className="font-mono font-bold"
                style={{ fontSize: "7rem", lineHeight: 1, color: theme.accent }}
              >
                {finalWpm}
              </div>
              <div className="text-sm font-mono mt-1" style={{ color: theme.muted }}>
                wpm
              </div>
            </div>
            <div className="mb-4 text-center">
              <div className="font-mono font-bold text-5xl" style={{ color: grade.color }}>
                {grade.label}
              </div>
              <div className="text-xs font-mono mt-1" style={{ color: theme.muted }}>
                grade
              </div>
            </div>
          </div>

          {/* WPM bar */}
          <div
            className="w-full"
            style={{
              background: theme.controlBackground,
              borderRadius: "8px",
              height: "8px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min((finalWpm / 150) * 100, 100)}%`,
                background: `linear-gradient(90deg, ${theme.accent}, ${theme.accentAlt})`,
                borderRadius: "8px",
                transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
              }}
            />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-6 w-full font-mono text-center">
            {[
              { label: "mode", value: selectedMode, color: "#2196f3" },
              { label: "accuracy", value: `${accuracy}%`, color: theme.accent },
              { label: "correct", value: correctChars, color: "#4caf50" },
              { label: "incorrect", value: errors, color: theme.danger },
              { label: "words", value: selectedWordCount, color: theme.accent },
              { label: "time", value: `${selectedTime}s`, color: theme.accent },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="flex flex-col gap-1"
                style={{
                  background: theme.cardBackground,
                  borderRadius: "10px",
                  padding: "14px 8px",
                }}
              >
                <span className="text-2xl font-bold" style={{ color }}>
                  {value}
                </span>
                <span className="text-xs" style={{ color: theme.muted }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={resetTest}
              className="font-mono font-semibold px-10 py-3 rounded-xl transition-all duration-200"
              style={{
                background: theme.accent,
                color: theme.accentText,
                border: "none",
                cursor: "pointer",
                fontSize: "1rem",
              }}
              onMouseEnter={(e) => {
                e.target.style.background = theme.accentAlt;
                e.target.style.transform = "scale(1.04)";
              }}
              onMouseLeave={(e) => {
                e.target.style.background = theme.accent;
                e.target.style.transform = "scale(1)";
              }}
            >
              try again ↺
            </button>
            <p className="text-xs font-mono" style={{ color: theme.subtle }}>
              press{" "}
              <kbd
                style={{
                  background: theme.kbdBackground,
                  padding: "2px 6px",
                  borderRadius: "4px",
                  color: theme.muted,
                }}
              >
                esc
              </kbd>{" "}
              to restart
            </p>
          </div>
        </div>
      </div>
    );
  }

  // -- Main Typing Screen ------------------------------------------------------
  return (
    <div
      tabIndex={0}
      ref={containerRef}
      className={`min-h-screen flex flex-col items-center justify-center gap-8 px-4 outline-none relative overflow-hidden ${brainrotEnabled ? "brainrot-page" : ""}`}
      style={{ background: theme.appBackground, fontFamily: theme.uiFont }}
    >
      {brainrotEnabled && (
        <>
          {BRAINROT_DECOR.map((sticker) => (
            <span
              key={`${sticker.icon}-${sticker.top}-${sticker.left || sticker.right}`}
              className="brainrot-sticker"
              style={{
                top: sticker.top,
                left: sticker.left,
                right: sticker.right,
                animationDelay: sticker.delay,
              }}
            >
              {sticker.icon}
            </span>
          ))}

          {brainrotPops.map((pop) => (
            <span
              key={pop.id}
              className="brainrot-pop"
              style={{
                top: pop.top,
                left: pop.left,
                transform: `rotate(${pop.rotate})`,
                fontSize: pop.size,
                color: pop.color,
                textShadow: pop.shadow,
                animationDuration: `${pop.duration}s`,
              }}
            >
              {pop.payload}
            </span>
          ))}
        </>
      )}

      {/* Top Nav */}
      <nav className="w-full max-w-2xl flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <img
            src="/TypeShi_logo.png"
            alt="TypeShi"
            style={{ height: "28px", opacity: 0.85 }}
          />
          <span
            className="font-mono font-bold text-lg"
            style={{
              color: theme.accent,
              fontFamily: theme.uiFont,
              textShadow: brainrotEnabled ? "0 0 12px rgba(125,255,0,0.75)" : "none",
            }}
          >
            TypeShi
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleBrainrotToggle}
            disabled={timerRunning}
            title={brainrotEnabled ? "Switch to classic mode" : "Enable brainrot mode"}
            className="font-mono text-xs uppercase tracking-wide px-3 py-1.5 rounded-lg transition-all duration-200"
            style={{
              background: brainrotEnabled ? theme.accent : theme.controlBackground,
              color: brainrotEnabled ? theme.accentText : theme.muted,
              border: `1px solid ${brainrotEnabled ? theme.accent : theme.panelBorder}`,
              cursor: timerRunning ? "not-allowed" : "pointer",
              opacity: timerRunning ? 0.45 : 1,
            }}
          >
            {brainrotEnabled ? "brainrot on" : "brainrot off"}
          </button>
          <button
            onClick={() => dispatch(toggleSound())}
            title={soundEnabled ? "Mute sounds" : "Enable sounds"}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "1.2rem",
              opacity: 0.7,
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => {
              e.target.style.opacity = 1;
            }}
            onMouseLeave={(e) => {
              e.target.style.opacity = 0.7;
            }}
          >
            {soundEnabled ? "🔊" : "🔇"}
          </button>
        </div>
      </nav>

      {/* Mode selectors */}
      <div
        className="w-full max-w-2xl rounded-2xl p-3 sm:p-4 flex flex-col gap-3 relative z-10"
        style={{
          background: theme.panelBackground,
          border: `1px solid ${theme.panelBorder}`,
          boxShadow: theme.panelShadow,
          fontFamily: theme.uiFont,
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="flex items-center gap-1 p-1 rounded-xl font-mono text-sm"
            style={{ background: "#0f1012", border: `1px solid ${theme.panelBorder}` }}
          >
            {[
              { key: "words", label: "words mode" },
              { key: "time", label: "time mode" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleModeSelect(key)}
                disabled={timerRunning}
                className="px-3 py-1.5 rounded-lg transition-all duration-200 font-mono text-xs uppercase tracking-wide"
                style={{
                  background: selectedMode === key ? theme.accent : "transparent",
                  color: selectedMode === key ? theme.accentText : theme.muted,
                  border: "none",
                  cursor: timerRunning ? "not-allowed" : "pointer",
                  fontWeight: selectedMode === key ? "700" : "500",
                  opacity: timerRunning && selectedMode !== key ? 0.35 : 1,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <p className="font-mono text-xs uppercase tracking-wide" style={{ color: theme.subtle }}>
            {modeHint}
          </p>
        </div>

        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl font-mono text-sm"
            style={{
              background: selectedMode === "words" ? theme.cardBackground : "#141518",
              border: selectedMode === "words"
                ? `1px solid ${theme.accent}`
                : `1px solid ${theme.panelBorder}`,
              opacity: selectedMode === "words" ? 1 : 0.6,
            }}
          >
            <span className="text-xs uppercase tracking-wide" style={{ color: theme.muted }}>
              words
            </span>
            <div className="flex items-center justify-end gap-1 flex-wrap">
              {WORD_MODES.map((count) => (
                <button
                  key={count}
                  onClick={() => handleWordCountSelect(count)}
                  disabled={timerRunning}
                  className="min-w-12 px-3 py-1.5 rounded-lg transition-all duration-200 font-mono text-sm"
                  style={{
                    background: selectedWordCount === count ? theme.accent : theme.controlBackground,
                    color: selectedWordCount === count ? theme.accentText : theme.muted,
                    border: "none",
                    cursor: timerRunning ? "not-allowed" : "pointer",
                    fontWeight: selectedWordCount === count ? "700" : "500",
                    opacity: timerRunning && selectedWordCount !== count ? 0.35 : 1,
                  }}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <div
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl font-mono text-sm"
            style={{
              background: selectedMode === "time" ? theme.cardBackground : "#141518",
              border: selectedMode === "time"
                ? `1px solid ${theme.accent}`
                : `1px solid ${theme.panelBorder}`,
              opacity: selectedMode === "time" ? 1 : 0.6,
            }}
          >
            <span className="text-xs uppercase tracking-wide" style={{ color: theme.muted }}>
              time
            </span>
            <div className="flex items-center justify-end gap-1 flex-wrap">
              {TIME_MODES.map((t) => (
                <button
                  key={t}
                  onClick={() => handleTimeSelect(t)}
                  disabled={timerRunning}
                  className="min-w-14 px-3 py-1.5 rounded-lg transition-all duration-200 font-mono text-sm"
                  style={{
                    background: selectedTime === t ? theme.accent : theme.controlBackground,
                    color: selectedTime === t ? theme.accentText : theme.muted,
                    border: "none",
                    cursor: timerRunning ? "not-allowed" : "pointer",
                    fontWeight: selectedTime === t ? "700" : "500",
                    opacity: timerRunning && selectedTime !== t ? 0.35 : 1,
                  }}
                >
                  {t}s
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-xs font-mono" style={{ color: theme.subtle }}>
          {timerRunning
            ? "mode settings are locked while the test is running"
            : "tip: selecting a words or time value switches to that mode automatically"}
          {" | "}
          {brainrotHint}
        </p>
      </div>

      {/* Stats bar -- only visible after typing starts */}
      <div
        className="flex gap-10 font-mono transition-all duration-500 relative z-10"
        style={{
          opacity: hasStarted ? 1 : 0,
          transform: hasStarted ? "translateY(0)" : "translateY(-8px)",
        }}
      >
        <div className="text-center">
          <div
            className="font-bold"
            style={{
              fontSize: "2rem",
              color:
                selectedMode === "time" && timeLeft <= 10
                  ? theme.danger
                  : theme.accent,
              lineHeight: 1,
            }}
          >
            {selectedMode === "time" ? timeLeft : `${typedWordsDisplay}/${selectedWordCount}`}
          </div>
          <div className="text-xs mt-0.5" style={{ color: theme.muted }}>
            {selectedMode === "time" ? "time" : "words"}
          </div>
        </div>
        <div className="text-center">
          <div className="font-bold" style={{ fontSize: "2rem", color: theme.accent, lineHeight: 1 }}>
            {liveWpm}
          </div>
          <div className="text-xs mt-0.5" style={{ color: theme.muted }}>
            wpm
          </div>
        </div>
        <div className="text-center">
          <div className="font-bold" style={{ fontSize: "2rem", color: theme.accent, lineHeight: 1 }}>
            {accuracy}
          </div>
          <div className="text-xs mt-0.5" style={{ color: theme.muted }}>
            acc%
          </div>
        </div>
      </div>

      {/* Timer progress bar */}
      <div
        className="w-full max-w-2xl rounded-full overflow-hidden relative z-10"
        style={{
          height: "2px",
          background: theme.controlBackground,
          marginTop: hasStarted ? "0" : "-32px",
          transition: "margin 0.4s",
        }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${selectedMode === "time" ? timerPercent : wordsProgressPercent}%`,
            background:
              selectedMode === "time" && timeLeft <= 10 ? theme.danger : theme.accent,
            transition: "width 1s linear, background 0.5s",
          }}
        />
      </div>

      {/* Words display */}
      <div
        ref={wordsRef}
        className="relative w-full max-w-2xl select-none z-10"
        style={{
          fontFamily: theme.wordFont,
          fontSize: brainrotEnabled ? "2.05rem" : "1.35rem",
          lineHeight: brainrotEnabled ? "2.35rem" : "2.6rem",
          letterSpacing: brainrotEnabled ? "0.04em" : "normal",
          textShadow: brainrotEnabled ? "0 0 8px rgba(149,242,255,0.2)" : "none",
          color: theme.wordDefault,
        }}
      >
        {/* Smooth sliding caret */}
        <div
          style={{
            position: "absolute",
            top: caretPos.top + 2,
            left: caretPos.left - 1,
            width: "2px",
            height: brainrotEnabled ? "2.1rem" : "1.7rem",
            background: theme.accent,
            borderRadius: "2px",
            transition: "top 0.08s ease, left 0.08s ease",
            animation: "blink 1.1s step-end infinite",
            zIndex: 10,
            pointerEvents: "none",
          }}
        />

        {/* Words */}
        {words.map((wordChars, wordIndex) => {
          // Global char index of first char of this word
          let globalStart = 0;
          for (let w = 0; w < wordIndex; w++) globalStart += words[w].length + 1;

          return (
            <span
              key={wordIndex}
              className="inline-block mr-3"
              style={{
                animation: errorWordIndex === wordIndex ? "shake 0.35s ease" : "none",
              }}
            >
              {wordChars.map((char, charIndex) => {
                const globalIndex = globalStart + charIndex;
                const isTyped = globalIndex < input.length;
                const isCorrect = isTyped && char === input[globalIndex];
                const isWrong = isTyped && char !== input[globalIndex];

                return (
                  <span
                    key={charIndex}
                    ref={(el) => {
                      charRefs.current[globalIndex] = el;
                    }}
                    style={{
                      color: isCorrect ? theme.wordCorrect : isWrong ? theme.wordWrong : theme.wordDefault,
                      transition: "color 0.08s",
                      textDecoration: isWrong ? "underline" : "none",
                      textDecorationColor: theme.wordWrong,
                    }}
                  >
                    {char}
                  </span>
                );
              })}
              {/* Register space position for caret */}
              <span
                ref={(el) => {
                  charRefs.current[globalStart + wordChars.length] = el;
                }}
                style={{ color: "transparent" }}
              >
                {" "}
              </span>
            </span>
          );
        })}
      </div>

      {/* Restart button + hint */}
      <div className="flex flex-col items-center gap-2 relative z-10">
        <button
          onClick={resetTest}
          className="font-mono text-sm px-6 py-2 rounded-lg transition-all duration-150"
          style={{
            background: theme.kbdBackground,
            color: theme.muted,
            border: "none",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = theme.accent;
            e.currentTarget.style.background = theme.controlBackground;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = theme.muted;
            e.currentTarget.style.background = theme.kbdBackground;
          }}
        >
          restart ↺
        </button>
        <p className="text-xs font-mono" style={{ color: theme.subtle }}>
          <kbd
            style={{
              background: theme.kbdBackground,
              padding: "1px 5px",
              borderRadius: "3px",
              color: theme.muted,
            }}
          >
            esc
          </kbd>{" "}
          restart
        </p>
      </div>
    </div>
  );
}

export default App;
