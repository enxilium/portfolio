"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import useStore from "../lib/store";
import { scrambleReveal, idleScramble } from "../lib/textEffects";

// ── Scramble-reveal title: each character rapidly iterates through random
//    glyphs before settling on the target character. ──

const TARGET_TEXT = "JACE MU";

// Scramble timing overrides for the title
const SCRAMBLE_INTERVAL = 40;
const SCRAMBLE_CYCLES = 8;
const CHAR_STAGGER = 120;

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

        const { timers } = scrambleReveal({
            text: TARGET_TEXT,
            setDisplay,
            interval: SCRAMBLE_INTERVAL,
            cycles: SCRAMBLE_CYCLES,
            stagger: CHAR_STAGGER,
            onComplete: () => {
                if (!interrupted.current) setResolved(true);
            },
        });

        animFrames.current = timers;
        return cleanup;
    }, [active, cleanup]);

    // ── Idle animation: randomly re-scramble individual characters ──
    useEffect(() => {
        if (!resolved || !active) return;

        const { stop } = idleScramble({
            text: TARGET_TEXT,
            setDisplay,
        });

        return stop;
    }, [resolved, active]);

    // ── If freeView activates before resolved, interrupt the animation ──
    useEffect(() => {
        if (freeView && !resolved) {
            interrupted.current = true;
            cleanup();
        }
    }, [freeView, resolved, cleanup]);

    // ── Derive opacity from reactive state (no refs in render) ──
    // freeView going true before resolved effectively interrupts;
    // the CSS transition handles the fade.
    const opacity =
        active && !freeView && !hoveredPillar && !focusedPillar ? 1 : 0;

    return (
        <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center z-10"
            style={{
                opacity,
                transition: "opacity 600ms ease-in-out",
            }}
        >
            <h1
                className="text-xl sm:text-2xl md:text-3xl px-4 sm:px-8 select-none"
                style={{
                    fontFamily: "var(--font-open-sans), 'Avenir', sans-serif",
                    letterSpacing: "clamp(12px, 4vw, 30px)",
                    paddingLeft: "clamp(12px, 4vw, 30px)",
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
