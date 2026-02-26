// ── Shared text scramble/glitch utilities ──
// Centralized logic for scramble-reveal, glitch-reveal, and idle-scramble
// effects used across ScrambleTitle, PillarTooltip, and future components.

// Pool of glyphs to cycle through during scramble animations
export const GLYPH_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!?<>+=";

// ── Scramble-reveal ──
// Each character cycles through random glyphs before settling on its target.
// Characters are staggered so they resolve left-to-right.

interface ScrambleRevealOptions {
    /** The target string to reveal */
    text: string;
    /** React setState for the display array */
    setDisplay: React.Dispatch<React.SetStateAction<string[]>>;
    /** Time (ms) between glyph swaps for one character (default: 35) */
    interval?: number;
    /** How many random glyphs to show before settling (default: 6) */
    cycles?: number;
    /** Delay (ms) between starting each successive character (default: 80) */
    stagger?: number;
    /** Called when all characters have settled */
    onComplete?: () => void;
}

interface ScrambleRevealResult {
    /** All scheduled timers — caller is responsible for clearing on cleanup */
    timers: ReturnType<typeof setTimeout>[];
    /** Total duration (ms) of the full animation */
    duration: number;
}

export function scrambleReveal({
    text,
    setDisplay,
    interval = 35,
    cycles = 6,
    stagger = 80,
    onComplete,
}: ScrambleRevealOptions): ScrambleRevealResult {
    const chars = text.split("");
    const timers: ReturnType<typeof setTimeout>[] = [];

    chars.forEach((targetChar, charIndex) => {
        if (targetChar === " ") {
            const t = setTimeout(() => {
                setDisplay((prev) => {
                    const next = [...prev];
                    next[charIndex] = " ";
                    return next;
                });
            }, charIndex * stagger);
            timers.push(t);
            return;
        }

        for (let cycle = 0; cycle <= cycles; cycle++) {
            const delay = charIndex * stagger + cycle * interval;
            const t = setTimeout(() => {
                setDisplay((prev) => {
                    const next = [...prev];
                    if (cycle === cycles) {
                        next[charIndex] = targetChar;
                    } else {
                        next[charIndex] =
                            GLYPH_POOL[
                                Math.floor(Math.random() * GLYPH_POOL.length)
                            ];
                    }
                    return next;
                });
            }, delay);
            timers.push(t);
        }
    });

    const duration = (chars.length - 1) * stagger + cycles * interval + 50;

    if (onComplete) {
        const doneTimer = setTimeout(onComplete, duration);
        timers.push(doneTimer);
    }

    return { timers, duration };
}

// ── Glitch-reveal ──
// A string progressively resolves from random characters to the target,
// with "/" and " " always shown correctly. Used for tags like "// SECTION".

interface GlitchRevealOptions {
    /** The target string to reveal */
    text: string;
    /** React setState for the display string */
    setDisplay: React.Dispatch<React.SetStateAction<string>>;
    /** Total duration of the glitch animation (ms, default: 400) */
    duration?: number;
    /** Number of intermediate glitch steps (default: 8) */
    steps?: number;
    /** Characters to leave unscrambled (default: [" ", "/"]) */
    preserveChars?: string[];
    /** Called when the final text is set */
    onComplete?: () => void;
}

interface GlitchRevealResult {
    timers: ReturnType<typeof setTimeout>[];
}

export function glitchReveal({
    text,
    setDisplay,
    duration = 400,
    steps = 8,
    preserveChars = [" ", "/"],
    onComplete,
}: GlitchRevealOptions): GlitchRevealResult {
    const stepInterval = duration / steps;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const preserveSet = new Set(preserveChars);

    for (let step = 0; step <= steps; step++) {
        const t = setTimeout(() => {
            if (step === steps) {
                setDisplay(text);
                onComplete?.();
            } else {
                const progress = step / steps;
                const glitched = text
                    .split("")
                    .map((ch) => {
                        if (preserveSet.has(ch)) return ch;
                        if (Math.random() < progress) return ch;
                        return GLYPH_POOL[
                            Math.floor(Math.random() * GLYPH_POOL.length)
                        ];
                    })
                    .join("");
                setDisplay(glitched);
            }
        }, step * stepInterval);
        timers.push(t);
    }

    return { timers };
}

// ── Idle scramble ──
// After a text has resolved, randomly re-scramble individual characters
// at random intervals, then settle them back. Creates a living/glitchy feel.

interface IdleScrambleOptions {
    /** The fully resolved target text */
    text: string;
    /** React setState for the display array */
    setDisplay: React.Dispatch<React.SetStateAction<string[]>>;
    /** Minimum delay (ms) between idle triggers (default: 2000) */
    minDelay?: number;
    /** Maximum delay (ms) between idle triggers (default: 8000) */
    maxDelay?: number;
    /** How many random glyphs to cycle through before re-settling (default: 5) */
    cycles?: number;
    /** Interval (ms) between glyph swaps during idle (default: 50) */
    interval?: number;
}

interface IdleScrambleResult {
    /** Call to stop the idle loop and clear all timers */
    stop: () => void;
}

export function idleScramble({
    text,
    setDisplay,
    minDelay = 2000,
    maxDelay = 8000,
    cycles = 5,
    interval = 50,
}: IdleScrambleOptions): IdleScrambleResult {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Indices of non-space characters eligible for scrambling
    const candidates = text
        .split("")
        .map((ch, i) => (ch !== " " ? i : -1))
        .filter((i) => i >= 0);

    const scheduleNext = () => {
        if (cancelled) return;
        const delay = minDelay + Math.random() * (maxDelay - minDelay);
        const t = setTimeout(() => {
            if (cancelled) return;
            const charIndex =
                candidates[Math.floor(Math.random() * candidates.length)];

            for (let cycle = 0; cycle <= cycles; cycle++) {
                const ct = setTimeout(() => {
                    if (cancelled) return;
                    setDisplay((prev) => {
                        const next = [...prev];
                        if (cycle === cycles) {
                            next[charIndex] = text[charIndex];
                        } else {
                            next[charIndex] =
                                GLYPH_POOL[
                                    Math.floor(
                                        Math.random() * GLYPH_POOL.length,
                                    )
                                ];
                        }
                        return next;
                    });
                }, cycle * interval);
                timers.push(ct);
            }

            scheduleNext();
        }, delay);
        timers.push(t);
    };

    scheduleNext();

    return {
        stop: () => {
            cancelled = true;
            timers.forEach(clearTimeout);
        },
    };
}
