"use client";

import { useEffect, useRef, useState } from "react";
import useStore from "./store";

// ── Night/day color helpers ──
function useNightColors() {
    const isNight = useStore((s) => s.isNight);
    return {
        isNight,
        lineStroke: isNight ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)",
        circleStroke: isNight ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
        dotFill: isNight ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)",
        accentLine: isNight ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
        textColor: isNight ? "#ffffff" : "#1a1a1a",
        scrambleColor: isNight ? "#aaa" : "#888",
        tagColor: isNight ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
    };
}

// ── Detroit: Become Human-style analysis tooltip for pillar hover ──
// A line extends from the pillar toward the center, ending at a label that
// scramble-reveals its text.

// Pillar config: screen-space anchor points and label text
const PILLAR_CONFIG = {
    left: {
        label: "BLOG",
        // Line starts near left-third of screen, ends near center
        startX: "25%",
        startY: "55%",
        endX: "42%",
        endY: "45%",
    },
    right: {
        label: "EXPERIENCE",
        startX: "75%",
        startY: "55%",
        endX: "58%",
        endY: "45%",
    },
} as const;

// Scramble constants (reuse same pool as ScrambleTitle)
const GLYPH_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!?<>+=";
const SCRAMBLE_INTERVAL = 35;
const SCRAMBLE_CYCLES = 6;
const CHAR_STAGGER = 80;

// Line draw duration (ms)
const LINE_DRAW_MS = 300;
// How long to wait after line finishes before starting text scramble (ms)
const TEXT_DELAY_MS = 100;
// Fade-out duration (ms)
const FADE_OUT_MS = 250;

export default function PillarTooltip() {
    const hoveredPillar = useStore((s) => s.hoveredPillar);
    const freeView = useStore((s) => s.freeView);
    const focusedPillar = useStore((s) => s.focusedPillar);

    const {
        lineStroke,
        circleStroke,
        dotFill,
        accentLine,
        textColor,
        scrambleColor,
        tagColor,
    } = useNightColors();

    // The pillar we're currently animating for (persists through fade-out)
    const [activePillar, setActivePillar] = useState<"left" | "right" | null>(
        null,
    );
    // Animation phases
    const [lineProgress, setLineProgress] = useState(0); // 0..1
    const [display, setDisplay] = useState<string[]>([]);
    const [textDone, setTextDone] = useState(false);
    const [fadingOut, setFadingOut] = useState(false);

    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const rafRef = useRef<number>(0);
    const lineStartRef = useRef(0);

    // Cleanup helper
    const clearTimers = () => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
        cancelAnimationFrame(rafRef.current);
    };

    // ── React to hover changes ──
    useEffect(() => {
        // Hide tooltip when focused on a pillar (camera zoomed in)
        const target = freeView || focusedPillar ? null : hoveredPillar;

        if (target && target !== activePillar) {
            // New pillar hovered — start animation
            clearTimers();
            setFadingOut(false);
            setActivePillar(target);
            setLineProgress(0);
            setTextDone(false);

            const config = PILLAR_CONFIG[target];
            const label = config.label;
            setDisplay(Array(label.length).fill(""));

            // Animate line draw
            lineStartRef.current = performance.now();
            const animateLine = () => {
                const elapsed = performance.now() - lineStartRef.current;
                const p = Math.min(1, elapsed / LINE_DRAW_MS);
                setLineProgress(p);
                if (p < 1) {
                    rafRef.current = requestAnimationFrame(animateLine);
                } else {
                    // Line finished — start text scramble after delay
                    const t = setTimeout(() => {
                        startScramble(label);
                    }, TEXT_DELAY_MS);
                    timersRef.current.push(t);
                }
            };
            rafRef.current = requestAnimationFrame(animateLine);
        } else if (!target && activePillar && !fadingOut) {
            // Hover ended — fade out
            clearTimers();
            setFadingOut(true);
            const t = setTimeout(() => {
                setActivePillar(null);
                setLineProgress(0);
                setDisplay([]);
                setTextDone(false);
                setFadingOut(false);
            }, FADE_OUT_MS);
            timersRef.current.push(t);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hoveredPillar, freeView, focusedPillar]);

    // Cleanup on unmount
    useEffect(() => clearTimers, []);

    // ── Scramble-reveal the label text ──
    const startScramble = (label: string) => {
        const chars = label.split("");
        const timers: ReturnType<typeof setTimeout>[] = [];

        chars.forEach((targetChar, charIndex) => {
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

            for (let cycle = 0; cycle <= SCRAMBLE_CYCLES; cycle++) {
                const delay =
                    charIndex * CHAR_STAGGER + cycle * SCRAMBLE_INTERVAL;
                const t = setTimeout(() => {
                    setDisplay((prev) => {
                        const next = [...prev];
                        if (cycle === SCRAMBLE_CYCLES) {
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

        const totalTime =
            (chars.length - 1) * CHAR_STAGGER +
            SCRAMBLE_CYCLES * SCRAMBLE_INTERVAL +
            50;
        const doneTimer = setTimeout(() => setTextDone(true), totalTime);
        timers.push(doneTimer);

        timersRef.current.push(...timers);
    };

    if (!activePillar) return null;

    const config = PILLAR_CONFIG[activePillar];
    const label = config.label;
    const isLeft = activePillar === "left";

    // Compute the SVG line endpoints (percentages → viewport pixels via CSS)
    // We'll use an absolutely positioned SVG + absolutely positioned text
    const opacity = fadingOut ? 0 : 1;

    return (
        <div
            className="pointer-events-none fixed inset-0 z-10"
            style={{
                opacity,
                transition: `opacity ${FADE_OUT_MS}ms ease-out`,
            }}
        >
            {/* Analysis line (SVG) */}
            <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
            >
                {/* Line from pillar to label */}
                <line
                    x1={parseFloat(config.startX)}
                    y1={parseFloat(config.startY)}
                    x2={
                        parseFloat(config.startX) +
                        (parseFloat(config.endX) - parseFloat(config.startX)) *
                            lineProgress
                    }
                    y2={
                        parseFloat(config.startY) +
                        (parseFloat(config.endY) - parseFloat(config.startY)) *
                            lineProgress
                    }
                    stroke={lineStroke}
                    strokeWidth="0.12"
                    strokeLinecap="round"
                />
                {/* Small circle at the start (pillar anchor) */}
                <circle
                    cx={parseFloat(config.startX)}
                    cy={parseFloat(config.startY)}
                    r="0.3"
                    fill="none"
                    stroke={circleStroke}
                    strokeWidth="0.1"
                    style={{
                        opacity: lineProgress > 0 ? 1 : 0,
                    }}
                />
                {/* Dot at end of line */}
                {lineProgress >= 1 && (
                    <circle
                        cx={parseFloat(config.endX)}
                        cy={parseFloat(config.endY)}
                        r="0.2"
                        fill={dotFill}
                    />
                )}
            </svg>

            {/* Label text — positioned at the end of the line */}
            {lineProgress >= 1 && (
                <div
                    className="absolute"
                    style={{
                        left: config.endX,
                        top: config.endY,
                        transform: isLeft
                            ? "translate(-100%, -140%)"
                            : "translate(0%, -140%)",
                    }}
                >
                    {/* Thin horizontal accent line above text */}
                    <div
                        style={{
                            width: "100%",
                            height: "1px",
                            background: accentLine,
                            marginBottom: "6px",
                        }}
                    />
                    <span
                        className="select-none whitespace-nowrap"
                        style={{
                            fontFamily:
                                "var(--font-open-sans), 'Avenir', sans-serif",
                            fontSize: "1rem",
                            letterSpacing: "8px",
                            color: textColor,
                            transition: "color 600ms ease-in-out",
                        }}
                    >
                        {display.map((ch, i) => (
                            <span
                                key={i}
                                style={{
                                    display: "inline-block",
                                    minWidth: ch === " " ? "0.4em" : undefined,
                                    color:
                                        ch && ch !== label[i]
                                            ? scrambleColor
                                            : undefined,
                                    transition: "color 80ms",
                                }}
                            >
                                {ch || "\u00A0"}
                            </span>
                        ))}
                    </span>
                    {/* Subtle category tag beneath */}
                    {textDone && (
                        <div
                            style={{
                                marginTop: "4px",
                                fontSize: "0.6rem",
                                letterSpacing: "3px",
                                color: tagColor,
                                fontFamily: "var(--font-geist-mono), monospace",
                            }}
                        >
                            {isLeft ? "// SECTION" : "// SECTION"}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
