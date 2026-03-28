import { useRef, useCallback } from "react";

/**
 * Custom hook for typing sound effects using Web Audio API.
 * No external audio files needed — sounds are synthesized in-browser.
 */
export const useSound = (enabled = true) => {
    const audioCtxRef = useRef(null);

    const getCtx = () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioCtxRef.current;
    };

    /**
     * Play a short click sound for correct keypresses
     */
    const playClick = useCallback(() => {
        if (!enabled) return;
        try {
            const ctx = getCtx();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.type = "square";
            oscillator.frequency.setValueAtTime(800, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.04);

            gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.05);
        } catch {
            // Silently fail if audio is not available
        }
    }, [enabled]);

    /**
     * Play a lower-pitched thud sound for incorrect keypresses
     */
    const playError = useCallback(() => {
        if (!enabled) return;
        try {
            const ctx = getCtx();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscillator.type = "sawtooth";
            oscillator.frequency.setValueAtTime(200, ctx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08);

            gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

            oscillator.start(ctx.currentTime);
            oscillator.stop(ctx.currentTime + 0.1);
        } catch {
            // Silently fail if audio is not available
        }
    }, [enabled]);

    return { playClick, playError };
};
