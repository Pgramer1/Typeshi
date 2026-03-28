import { useEffect, useRef, useState, useCallback } from "react";
import { generateTest } from "./words";
import { useSound } from "./useSound";

const TIME_MODES = [15, 30, 60, 120];
const WORD_COUNT = 60;

// Split sentence into words for word-based rendering
function buildWords(sentence) {
  return sentence.split(" ").map((word) => word.split(""));
}

function App() {
  const [selectedTime, setSelectedTime] = useState(60);
  const [sentence, setSentence] = useState(() => generateTest(WORD_COUNT));
  const [input, setInput] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [wpm, setWpm] = useState(0);
  const [hasFinished, setHasFinished] = useState(false);
  const [liveWpm, setLiveWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [timeLeft, setTimeLeft] = useState(60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [errors, setErrors] = useState(0);
  const [totalTyped, setTotalTyped] = useState(0);
  const [caretPos, setCaretPos] = useState({ top: 0, left: 0 });
  const [errorWordIndex, setErrorWordIndex] = useState(null); // for shake animation

  const containerRef = useRef(null);
  const wordsRef = useRef(null);
  const charRefs = useRef({}); // key: globalCharIndex → DOM span
  const { playClick, playError } = useSound(soundEnabled);

  const words = buildWords(sentence);

  // Global char index → word index + char index within word
  const getWordAndCharIndex = useCallback((globalIndex) => {
    let idx = 0;
    for (let w = 0; w < words.length; w++) {
      if (globalIndex < idx + words[w].length) {
        return { wordIndex: w, charIndex: globalIndex - idx };
      }
      idx += words[w].length + 1; // +1 for space
    }
    return null;
  }, [words]);

  // Auto-focus on mount
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Sync timeLeft when selectedTime changes (before test starts)
  useEffect(() => {
    if (!timerRunning && !hasFinished) {
      setTimeLeft(selectedTime);
    }
  }, [selectedTime, timerRunning, hasFinished]);

  // Timer countdown
  useEffect(() => {
    if (!timerRunning || timeLeft === 0) return;
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
  }, [timerRunning, timeLeft]);

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

  // Accuracy = correct keypresses / total keypresses
  useEffect(() => {
    if (totalTyped === 0) { setAccuracy(100); return; }
    const correctPresses = totalTyped - errors;
    setAccuracy(((correctPresses / totalTyped) * 100).toFixed(1));
  }, [totalTyped, errors]);

  // Finish detection
  useEffect(() => {
    if (!hasFinished && input === sentence) {
      const elapsedMinutes = (Date.now() - startTime) / 1000 / 60;
      setWpm(calcWpm(input, sentence, elapsedMinutes));
      setHasFinished(true);
      setTimerRunning(false);
    }
  }, [input, sentence, startTime, hasFinished, calcWpm]);

  // Final WPM on timer end
  useEffect(() => {
    if (hasFinished && startTime) {
      const elapsedMinutes = (Date.now() - startTime) / 1000 / 60;
      const finalWpm = calcWpm(input, sentence, elapsedMinutes);
      setWpm(finalWpm > 0 ? finalWpm : liveWpm);
    }
  }, [hasFinished]); // eslint-disable-line

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
      if (e.key === "Escape") { e.preventDefault(); resetTest(); return; }
      if (hasFinished) return;

      if (e.key === "Backspace") {
        setInput((prev) => prev.slice(0, -1));
        return;
      }
      if (e.key.length !== 1) return;

      if (!startTime) {
        setStartTime(Date.now());
        setTimerRunning(true);
      }
      if (input.length >= sentence.length) return;

      const nextChar = sentence[input.length];
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

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [input, hasFinished, startTime, sentence, playClick, playError, getWordAndCharIndex]);

  const resetTest = useCallback(() => {
    setInput("");
    setStartTime(null);
    setWpm(0);
    setLiveWpm(0);
    setAccuracy(100);
    setHasFinished(false);
    setTimeLeft(selectedTime);
    setTimerRunning(false);
    setErrors(0);
    setTotalTyped(0);
    setSentence(generateTest(WORD_COUNT));
    setErrorWordIndex(null);
    setTimeout(() => containerRef.current?.focus(), 0);
  }, [selectedTime]);

  const handleTimeSelect = (t) => {
    if (timerRunning) return;
    setSelectedTime(t);
    setTimeLeft(t);
    // resetTest will pick up new selectedTime via useCallback dep
    setInput("");
    setStartTime(null);
    setWpm(0);
    setLiveWpm(0);
    setAccuracy(100);
    setHasFinished(false);
    setTimerRunning(false);
    setErrors(0);
    setTotalTyped(0);
    setSentence(generateTest(WORD_COUNT));
    setTimeout(() => containerRef.current?.focus(), 0);
  };

  const timerPercent = (timeLeft / selectedTime) * 100;
  const hasStarted = !!startTime;

  // ── Results Screen ──────────────────────────────────────────────────────────
  if (hasFinished) {
    const finalWpm = wpm || liveWpm;
    const correctChars = input.split("").filter((c, i) => c === sentence[i]).length;
    const incorrectChars = totalTyped - (totalTyped - errors); // = errors
    const grade =
      finalWpm >= 100 ? { label: "S", color: "#e2b714" } :
        finalWpm >= 80 ? { label: "A", color: "#4caf50" } :
          finalWpm >= 60 ? { label: "B", color: "#2196f3" } :
            finalWpm >= 40 ? { label: "C", color: "#ff9800" } :
              { label: "D", color: "#ca4754" };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-10 px-4" style={{ background: "#0e0e0f" }}>
        {/* Logo */}
        <div className="flex items-center gap-2 absolute top-6 left-8">
          <img src="/TypeShi_logo.png" alt="TypeShi" style={{ height: "28px", opacity: 0.7 }} />
          <span className="font-mono font-bold text-lg" style={{ color: "#e2b714", opacity: 0.7 }}>TypeShi</span>
        </div>

        <div className="results-card flex flex-col items-center gap-8 w-full max-w-xl">
          <p className="text-xs font-mono uppercase tracking-[0.3em]" style={{ color: "#646669" }}>— results —</p>

          {/* WPM + Grade */}
          <div className="flex items-end gap-6">
            <div className="text-center">
              <div className="font-mono font-bold" style={{ fontSize: "7rem", lineHeight: 1, color: "#e2b714" }}>
                {finalWpm}
              </div>
              <div className="text-sm font-mono mt-1" style={{ color: "#646669" }}>wpm</div>
            </div>
            <div className="mb-4 text-center">
              <div className="font-mono font-bold text-5xl" style={{ color: grade.color }}>{grade.label}</div>
              <div className="text-xs font-mono mt-1" style={{ color: "#646669" }}>grade</div>
            </div>
          </div>

          {/* WPM bar */}
          <div className="w-full" style={{ background: "#1e1e20", borderRadius: "8px", height: "8px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.min((finalWpm / 150) * 100, 100)}%`,
                background: "linear-gradient(90deg, #e2b714, #f0c830)",
                borderRadius: "8px",
                transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
              }}
            />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-6 w-full font-mono text-center">
            {[
              { label: "accuracy", value: `${accuracy}%`, color: "#e2b714" },
              { label: "correct", value: correctChars, color: "#4caf50" },
              { label: "incorrect", value: errors, color: "#ca4754" },
              { label: "time", value: `${selectedTime}s`, color: "#e2b714" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex flex-col gap-1" style={{ background: "#1e1e20", borderRadius: "10px", padding: "14px 8px" }}>
                <span className="text-2xl font-bold" style={{ color }}>{value}</span>
                <span className="text-xs" style={{ color: "#646669" }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={resetTest}
              className="font-mono font-semibold px-10 py-3 rounded-xl transition-all duration-200"
              style={{ background: "#e2b714", color: "#0e0e0f", border: "none", cursor: "pointer", fontSize: "1rem" }}
              onMouseEnter={e => { e.target.style.background = "#f0c830"; e.target.style.transform = "scale(1.04)"; }}
              onMouseLeave={e => { e.target.style.background = "#e2b714"; e.target.style.transform = "scale(1)"; }}
            >
              try again ↺
            </button>
            <p className="text-xs font-mono" style={{ color: "#3a3d42" }}>
              press <kbd style={{ background: "#1e1e20", padding: "2px 6px", borderRadius: "4px", color: "#646669" }}>esc</kbd> to restart
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Typing Screen ───────────────────────────────────────────────────────
  return (
    <div
      tabIndex={0}
      ref={containerRef}
      className="min-h-screen flex flex-col items-center justify-center gap-8 px-4 outline-none"
      style={{ background: "#0e0e0f" }}
    >
      {/* Top Nav */}
      <nav className="w-full max-w-2xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/TypeShi_logo.png" alt="TypeShi" style={{ height: "28px", opacity: 0.85 }} />
          <span className="font-mono font-bold text-lg" style={{ color: "#e2b714" }}>TypeShi</span>
        </div>
        <button
          onClick={() => setSoundEnabled((p) => !p)}
          title={soundEnabled ? "Mute sounds" : "Enable sounds"}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", opacity: 0.6, transition: "opacity 0.2s" }}
          onMouseEnter={e => e.target.style.opacity = 1}
          onMouseLeave={e => e.target.style.opacity = 0.6}
        >
          {soundEnabled ? "🔊" : "🔇"}
        </button>
      </nav>

      {/* Time mode selector */}
      <div className="flex items-center gap-1 p-1 rounded-xl font-mono text-sm" style={{ background: "#1a1a1c" }}>
        {TIME_MODES.map((t) => (
          <button
            key={t}
            onClick={() => handleTimeSelect(t)}
            disabled={timerRunning}
            className="px-5 py-1.5 rounded-lg transition-all duration-200 font-mono text-sm"
            style={{
              background: selectedTime === t ? "#e2b714" : "transparent",
              color: selectedTime === t ? "#0e0e0f" : "#646669",
              border: "none",
              cursor: timerRunning ? "not-allowed" : "pointer",
              fontWeight: selectedTime === t ? "700" : "400",
              opacity: timerRunning && selectedTime !== t ? 0.3 : 1,
            }}
          >
            {t}s
          </button>
        ))}
      </div>

      {/* Stats bar — only visible after typing starts */}
      <div
        className="flex gap-10 font-mono transition-all duration-500"
        style={{ opacity: hasStarted ? 1 : 0, transform: hasStarted ? "translateY(0)" : "translateY(-8px)" }}
      >
        <div className="text-center">
          <div className="font-bold" style={{ fontSize: "2rem", color: timeLeft <= 10 ? "#ca4754" : "#e2b714", lineHeight: 1 }}>
            {timeLeft}
          </div>
          <div className="text-xs mt-0.5" style={{ color: "#646669" }}>time</div>
        </div>
        <div className="text-center">
          <div className="font-bold" style={{ fontSize: "2rem", color: "#e2b714", lineHeight: 1 }}>{liveWpm}</div>
          <div className="text-xs mt-0.5" style={{ color: "#646669" }}>wpm</div>
        </div>
        <div className="text-center">
          <div className="font-bold" style={{ fontSize: "2rem", color: "#e2b714", lineHeight: 1 }}>{accuracy}</div>
          <div className="text-xs mt-0.5" style={{ color: "#646669" }}>acc%</div>
        </div>
      </div>

      {/* Timer progress bar */}
      <div className="w-full max-w-2xl rounded-full overflow-hidden" style={{ height: "2px", background: "#1e1e20", marginTop: hasStarted ? "0" : "-32px", transition: "margin 0.4s" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${timerPercent}%`,
            background: timeLeft <= 10 ? "#ca4754" : "#e2b714",
            transition: "width 1s linear, background 0.5s",
          }}
        />
      </div>

      {/* Words display */}
      <div
        ref={wordsRef}
        className="relative w-full max-w-2xl select-none"
        style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.35rem", lineHeight: "2.6rem", color: "#3a3d42" }}
      >
        {/* Smooth sliding caret */}
        <div
          style={{
            position: "absolute",
            top: caretPos.top + 2,
            left: caretPos.left - 1,
            width: "2px",
            height: "1.7rem",
            background: "#e2b714",
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
                const isCurrent = globalIndex === input.length;
                const isCorrect = isTyped && char === input[globalIndex];
                const isWrong = isTyped && char !== input[globalIndex];

                return (
                  <span
                    key={charIndex}
                    ref={(el) => { charRefs.current[globalIndex] = el; }}
                    style={{
                      color: isCorrect ? "#d1d0c5" : isWrong ? "#ca4754" : "#3a3d42",
                      transition: "color 0.08s",
                      textDecoration: isWrong ? "underline" : "none",
                      textDecorationColor: "#ca4754",
                    }}
                  >
                    {char}
                  </span>
                );
              })}
              {/* Register space position for caret */}
              <span
                ref={(el) => { charRefs.current[globalStart + wordChars.length] = el; }}
                style={{ color: "transparent" }}
              >
                {" "}
              </span>
            </span>
          );
        })}
      </div>

      {/* Restart button + hint */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={resetTest}
          className="font-mono text-sm px-6 py-2 rounded-lg transition-all duration-150"
          style={{ background: "#1a1a1c", color: "#646669", border: "none", cursor: "pointer" }}
          onMouseEnter={e => { e.currentTarget.style.color = "#e2b714"; e.currentTarget.style.background = "#222226"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "#646669"; e.currentTarget.style.background = "#1a1a1c"; }}
        >
          restart ↺
        </button>
        <p className="text-xs font-mono" style={{ color: "#2a2d30" }}>
          <kbd style={{ background: "#1a1a1c", padding: "1px 5px", borderRadius: "3px", color: "#3a3d42" }}>esc</kbd> restart
        </p>
      </div>
    </div>
  );
}

export default App;
