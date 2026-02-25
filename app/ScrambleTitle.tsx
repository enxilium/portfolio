"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import useStore from "./store";

// ── Scramble-reveal title: each character rapidly iterates through random
//    glyphs before settling on the target character. ──

const TARGET_TEXT = "JACE MU";

// Pool of glyphs to cycle through during the scramble
const GLYPH_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!?<>+=";

// Time (ms) between glyph changes during scramble for one character
const SCRAMBLE_INTERVAL = 40;
// How many random glyphs to show before settling on the target
const SCRAMBLE_CYCLES = 8;
// Delay (ms) between starting the scramble of each successive character
const CHAR_STAGGER = 120;

// ── Idle animation: after resolving, randomly re-scramble individual chars ──
// Min/max delay (ms) before the next random character fires
const IDLE_MIN_DELAY = 2000;
const IDLE_MAX_DELAY = 8000;
// How many random glyphs an idle char cycles through before re-settling
const IDLE_CYCLES = 5;
// Interval between idle glyph swaps (ms)
const IDLE_INTERVAL = 50;

interface ScrambleTitleProps {
    /** Whether the intro sequence is complete and the title should begin */
    active: boolean;
}

export default function ScrambleTitle({ active }: ScrambleTitleProps) {
    // The currently displayed characters (array of strings, one per char)
    const [display, setDisplay] = useState<string[]>(
        Array(TARGET_TEXT.length).fill(""),
    );
    // Whether the scramble animation has fully resolved
    const [resolved, setResolved] = useState(false);
    // Whether we should be visible at all
    const [visible, setVisible] = useState(false);

    const freeView = useStore((s) => s.freeView);
    const hoveredPillar = useStore((s) => s.hoveredPillar);
    const focusedPillar = useStore((s) => s.focusedPillar);
    const isNight = useStore((s) => s.isNight);
    const animFrames = useRef<ReturnType<typeof setTimeout>[]>([]);
    const interrupted = useRef(false);

    const cleanup = useCallback(() => {
        animFrames.current.forEach(clearTimeout);
        animFrames.current = [];
    }, []);

    // ── Start the scramble sequence when active ──
    useEffect(() => {
        if (!active || interrupted.current) return;
        setVisible(true);

        const chars = TARGET_TEXT.split("");
        const timers: ReturnType<typeof setTimeout>[] = [];

        chars.forEach((targetChar, charIndex) => {
            // For spaces, resolve immediately
            if (targetChar === " ") {
                const t = setTimeout(() => {
                    setDisplay((prev) => {
                        const next = [...prev];
                        next[charIndex] = " ";
                        return next;
                    });
                }, charIndex * CHAR_STAGGER);
                timers.push(t);
                return;
            }

            // Schedule SCRAMBLE_CYCLES random glyphs, then settle
            for (let cycle = 0; cycle <= SCRAMBLE_CYCLES; cycle++) {
                const delay =
                    charIndex * CHAR_STAGGER + cycle * SCRAMBLE_INTERVAL;
                const t = setTimeout(() => {
                    if (interrupted.current) return;
                    setDisplay((prev) => {
                        const next = [...prev];
                        if (cycle === SCRAMBLE_CYCLES) {
                            // Final cycle — show real character
                            next[charIndex] = targetChar;
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
                }, delay);
                timers.push(t);
            }
        });

        // Mark resolved after last char settles
        const totalTime =
            (chars.length - 1) * CHAR_STAGGER +
            SCRAMBLE_CYCLES * SCRAMBLE_INTERVAL +
            100;
        const resolveTimer = setTimeout(() => {
            if (!interrupted.current) setResolved(true);
        }, totalTime);
        timers.push(resolveTimer);

        animFrames.current = timers;
        return cleanup;
    }, [active, cleanup]);

    // ── Idle animation: randomly re-scramble individual characters ──
    useEffect(() => {
        if (!resolved || !active) return;

        let cancelled = false;
        const idleTimers: ReturnType<typeof setTimeout>[] = [];

        const scheduleNext = () => {
            if (cancelled) return;
            const delay =
                IDLE_MIN_DELAY +
                Math.random() * (IDLE_MAX_DELAY - IDLE_MIN_DELAY);
            const t = setTimeout(() => {
                if (cancelled) return;
                // Pick a random non-space character index
                const candidates = TARGET_TEXT.split("")
                    .map((ch, i) => (ch !== " " ? i : -1))
                    .filter((i) => i >= 0);
                const charIndex =
                    candidates[Math.floor(Math.random() * candidates.length)];

                // Cycle through IDLE_CYCLES random glyphs, then settle back
                for (let cycle = 0; cycle <= IDLE_CYCLES; cycle++) {
                    const ct = setTimeout(() => {
                        if (cancelled) return;
                        setDisplay((prev) => {
                            const next = [...prev];
                            if (cycle === IDLE_CYCLES) {
                                next[charIndex] = TARGET_TEXT[charIndex];
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
                    }, cycle * IDLE_INTERVAL);
                    idleTimers.push(ct);
                }

                scheduleNext();
            }, delay);
            idleTimers.push(t);
        };

        scheduleNext();

        return () => {
            cancelled = true;
            idleTimers.forEach(clearTimeout);
        };
    }, [resolved, active]);

    // ── If freeView activates before resolved, interrupt and fade away ──
    useEffect(() => {
        if (freeView && !resolved) {
            interrupted.current = true;
            cleanup();
            // Fade out
            setVisible(false);
        }
    }, [freeView, resolved, cleanup]);

    // ── Fade out during freeView, pillar hover, or pillar focus ──
    const showTitle = visible && active;
    const opacity =
        showTitle && !freeView && !hoveredPillar && !focusedPillar ? 1 : 0;

    return (
        <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center z-10"
            style={{
                opacity,
                transition: "opacity 600ms ease-in-out",
            }}
        >
            <h1
                className="text-3xl px-8 select-none"
                style={{
                    fontFamily: "var(--font-open-sans), 'Avenir', sans-serif",
                    letterSpacing: "30px",
                    paddingLeft: "30px",
                    textAlign: "center",
                    color: isNight ? "#ffffff" : "#000000",
                    transition: "color 600ms ease-in-out",
                }}
            >
                {display.map((ch, i) => (
                    <span
                        key={i}
                        style={{
                            display: "inline-block",
                            minWidth: ch === " " ? "0.5em" : undefined,
                            // Unresolved chars get a slight glow
                            color:
                                ch && ch !== TARGET_TEXT[i]
                                    ? isNight
                                        ? "#999"
                                        : "#666"
                                    : undefined,
                        }}
                    >
                        {ch || "\u00A0"}
                    </span>
                ))}
            </h1>
        </div>
    );
}
