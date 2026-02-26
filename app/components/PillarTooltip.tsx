"use client";

import { useEffect, useRef, useState } from "react";
import useStore from "../lib/store";
import { scrambleReveal, glitchReveal } from "../lib/textEffects";

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
        // Line starts near left-third of screen, ends at center
        startX: "25%",
        startY: "55%",
        endX: "45%",
        endY: "50%",
    },
    right: {
        label: "EXPERIENCE",
        startX: "75%",
        startY: "55%",
        endX: "55%",
        endY: "50%",
    },
} as const;

// Scramble constants
const SCRAMBLE_INTERVAL = 35;
const SCRAMBLE_CYCLES = 6;
const CHAR_STAGGER = 80;

// Line draw duration (ms)
const LINE_DRAW_MS = 300;
// How long to wait after line finishes before starting text scramble (ms)
const TEXT_DELAY_MS = 100;
// Fade-out duration (ms)
const FADE_OUT_MS = 250;
// Glitch animation duration for // SECTION tag (ms)
const GLITCH_DURATION_MS = 400;
const GLITCH_STEPS = 8;

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
    // Glitch state for "// SECTION" tag
    const [sectionDisplay, setSectionDisplay] = useState("");
    const [sectionGlitchDone, setSectionGlitchDone] = useState(false);

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
            setSectionDisplay("");
            setSectionGlitchDone(false);

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
                setSectionDisplay("");
                setSectionGlitchDone(false);
            }, FADE_OUT_MS);
            timersRef.current.push(t);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hoveredPillar, freeView, focusedPillar]);

    // Cleanup on unmount
    useEffect(() => clearTimers, []);

    // ── Scramble-reveal the label text ──
    const startScramble = (label: string) => {
        const { timers } = scrambleReveal({
            text: label,
            setDisplay,
            interval: SCRAMBLE_INTERVAL,
            cycles: SCRAMBLE_CYCLES,
            stagger: CHAR_STAGGER,
            onComplete: () => {
                setTextDone(true);
                startSectionGlitch();
            },
        });

        timersRef.current.push(...timers);
    };

    // ── Glitch-reveal the "// SECTION" tag ──
    const startSectionGlitch = () => {
        const { timers } = glitchReveal({
            text: "// SECTION",
            setDisplay: setSectionDisplay,
            duration: GLITCH_DURATION_MS,
            steps: GLITCH_STEPS,
            onComplete: () => setSectionGlitchDone(true),
        });

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
            {/* Analysis line (SVG) — no viewBox so percentages map 1:1 to viewport */}
            <svg className="absolute inset-0 w-full h-full">
                {/* Line from pillar to label */}
                <line
                    x1={config.startX}
                    y1={config.startY}
                    x2={`${
                        parseFloat(config.startX) +
                        (parseFloat(config.endX) - parseFloat(config.startX)) *
                            lineProgress
                    }%`}
                    y2={`${
                        parseFloat(config.startY) +
                        (parseFloat(config.endY) - parseFloat(config.startY)) *
                            lineProgress
                    }%`}
                    stroke={lineStroke}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                />
                {/* Small circle at the start (pillar anchor) */}
                <circle
                    cx={config.startX}
                    cy={config.startY}
                    r="4"
                    fill="none"
                    stroke={circleStroke}
                    strokeWidth="1"
                    style={{
                        opacity: lineProgress > 0 ? 1 : 0,
                    }}
                />
                {/* Dot at end of line */}
                {lineProgress >= 1 && (
                    <circle
                        cx={config.endX}
                        cy={config.endY}
                        r="3"
                        fill={dotFill}
                    />
                )}
            </svg>

            {/* Label text — positioned beside the arrow tip */}
            {lineProgress >= 1 && (
                <div
                    className="absolute"
                    style={{
                        left: config.endX,
                        top: config.endY,
                        // Blog (left pillar): text to the right of dot
                        // Experience (right pillar): text to the left of dot
                        transform: isLeft
                            ? "translate(clamp(8px, 1vw, 16px), -50%)"
                            : "translate(calc(-100% - clamp(8px, 1vw, 16px)), -50%)",
                        textAlign: isLeft ? "left" : "right",
                    }}
                >
                    <span
                        className="select-none whitespace-nowrap"
                        style={{
                            fontFamily:
                                "var(--font-open-sans), 'Avenir', sans-serif",
                            fontSize: "clamp(0.875rem, 2.5vw, 1.875rem)",
                            letterSpacing: "clamp(6px, 1.5vw, 16px)",
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
                    {/* Pre-reserved space for // SECTION tag so it doesn't push text */}
                    <div
                        style={{
                            marginTop: "clamp(3px, 0.5vw, 6px)",
                            fontSize: "clamp(0.5rem, 1vw, 0.75rem)",
                            letterSpacing: "clamp(2px, 0.5vw, 4px)",
                            fontFamily: "var(--font-geist-mono), monospace",
                            height: "1.2em",
                            overflow: "hidden",
                            // Compensate for the main text's trailing letter-spacing
                            // so SECTION aligns flush with the last visible character
                            paddingRight: isLeft
                                ? undefined
                                : "clamp(6px, 1.5vw, 16px)",
                            paddingLeft: isLeft
                                ? "clamp(6px, 1.5vw, 16px)"
                                : undefined,
                        }}
                    >
                        {textDone && (
                            <span
                                style={{
                                    color: sectionGlitchDone
                                        ? tagColor
                                        : scrambleColor,
                                    transition: sectionGlitchDone
                                        ? "color 200ms"
                                        : "none",
                                }}
                            >
                                {sectionDisplay || "\u00A0"}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
