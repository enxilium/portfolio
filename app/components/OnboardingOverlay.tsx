"use client";

import { useEffect, useRef, useState } from "react";
import useStore from "../lib/store";

// ── Onboarding phase state machine ──
// PRESS_F       → user lands on page, sees "Press F to freelook"
// DRAG_TO_PAN   → user pressed F, sees "Drag mouse to pan around"
// DRAGGING      → user is dragging, text fades and stays hidden
// PRESS_F_BACK  → user stopped dragging, sees "Press F again to switch back"
// HOLD_LMB      → user returned to normal view, sees "Hold left mouse button to enter"
// DONE          → user held LMB, overlay dismissed permanently
type Phase =
    | "PRESS_F"
    | "DRAG_TO_PAN"
    | "DRAGGING"
    | "PRESS_F_BACK"
    | "HOLD_LMB"
    | "DONE";

// Duration (ms) for opacity fade transitions between phases
const FADE_MS = 600;

// ── Keycap icon — renders a keyboard-key shape ──
function Keycap({ children }: { children: React.ReactNode }) {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "2rem",
                height: "2rem",
                padding: "0 0.5rem",
                borderRadius: "0.375rem",
                background: "rgba(255, 255, 255, 0.18)",
                border: "1px solid rgba(255, 255, 255, 0.45)",
                borderBottom: "3px solid rgba(255, 255, 255, 0.55)",
                boxShadow: "0 2px 6px rgba(0, 0, 0, 0.35)",
                color: "white",
                fontFamily: "var(--font-open-sans), sans-serif",
                fontWeight: 700,
                fontSize: "0.875rem",
                lineHeight: 1,
            }}
        >
            {children}
        </span>
    );
}

// ── Left mouse button icon — mouse outline with left button filled ──
function MouseLeftIcon() {
    return (
        <svg
            viewBox="0 0 24 40"
            className="inline-block h-8 align-middle"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Mouse body */}
            <rect
                x="2"
                y="2"
                width="20"
                height="36"
                rx="10"
                stroke="white"
                strokeWidth="2"
            />
            {/* Horizontal button divider */}
            <line
                x1="2.5"
                y1="16"
                x2="21.5"
                y2="16"
                stroke="white"
                strokeWidth="1.5"
            />
            {/* Vertical button divider */}
            <line
                x1="12"
                y1="3"
                x2="12"
                y2="16"
                stroke="white"
                strokeWidth="1.5"
            />
            {/* Left button highlight */}
            <path
                d="M12 2 A10 10 0 0 0 2 12 L2 16 L12 16 Z"
                fill="white"
                fillOpacity="0.5"
            />
        </svg>
    );
}

// ── Phase content — returns the message for the current phase ──
function PhaseContent({ phase }: { phase: Phase }) {
    switch (phase) {
        case "PRESS_F":
            return (
                <span className="flex items-center gap-2">
                    Press <Keycap>F</Keycap> to freelook
                </span>
            );
        case "DRAG_TO_PAN":
            return <span>Drag mouse to pan around</span>;
        case "PRESS_F_BACK":
            return (
                <span className="flex items-center gap-2">
                    Press <Keycap>F</Keycap> again to switch back to normal view
                </span>
            );
        case "HOLD_LMB":
            return (
                <span className="flex items-center gap-2">
                    Hold <MouseLeftIcon /> to enter
                </span>
            );
        default:
            return null;
    }
}

// Helper to update phase + ref together
function usePhaseState(initial: Phase) {
    const [phase, setPhaseState] = useState<Phase>(initial);
    const phaseRef = useRef<Phase>(initial);
    const setPhase = (p: Phase) => {
        phaseRef.current = p;
        setPhaseState(p);
    };
    return [phase, setPhase, phaseRef] as const;
}

export default function OnboardingOverlay() {
    const [phase, setPhase, phaseRef] = usePhaseState("PRESS_F");
    const [show, setShow] = useState(true);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
    );

    // Clear any pending timer
    const clearPending = () => {
        if (timerRef.current !== undefined) {
            clearTimeout(timerRef.current);
            timerRef.current = undefined;
        }
    };

    // ── React to store changes via subscription (avoids setState-in-effect) ──
    useEffect(() => {
        const unsubscribe = useStore.subscribe((state, prevState) => {
            const p = phaseRef.current;

            // freeView toggled ON
            if (state.freeView && !prevState.freeView) {
                if (p === "PRESS_F") {
                    clearPending();
                    setShow(false);
                    timerRef.current = setTimeout(() => {
                        setPhase("DRAG_TO_PAN");
                        setShow(true);
                    }, FADE_MS);
                }
            }

            // freeView toggled OFF
            if (!state.freeView && prevState.freeView) {
                if (p === "DRAG_TO_PAN") {
                    // User pressed F back without ever dragging → skip to HOLD_LMB
                    clearPending();
                    setShow(false);
                    timerRef.current = setTimeout(() => {
                        setPhase("HOLD_LMB");
                        setShow(true);
                    }, FADE_MS);
                } else if (p === "DRAGGING") {
                    // Edge case: exited freeView while dragging
                    clearPending();
                    setPhase("HOLD_LMB");
                    setShow(true);
                } else if (p === "PRESS_F_BACK") {
                    // User pressed F to return → cross-fade to HOLD_LMB
                    clearPending();
                    setShow(false);
                    timerRef.current = setTimeout(() => {
                        setPhase("HOLD_LMB");
                        setShow(true);
                    }, FADE_MS);
                }
            }

            // isDragging toggled ON
            if (state.isDragging && !prevState.isDragging) {
                if (p === "DRAG_TO_PAN") {
                    clearPending();
                    setShow(false);
                    timerRef.current = setTimeout(() => {
                        setPhase("DRAGGING");
                    }, FADE_MS);
                }
            }

            // isDragging toggled OFF
            if (!state.isDragging && prevState.isDragging) {
                if (p === "DRAGGING") {
                    clearPending();
                    setPhase("PRESS_F_BACK");
                    setShow(true);
                }
            }
        });

        return () => {
            unsubscribe();
            clearPending();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Detect left-mouse-button hold in HOLD_LMB phase ──
    useEffect(() => {
        if (phase !== "HOLD_LMB") return;

        const handleMouseDown = (e: MouseEvent) => {
            if (e.button === 0) {
                setShow(false);
                clearPending();
                timerRef.current = setTimeout(() => setPhase("DONE"), FADE_MS);
            }
        };

        window.addEventListener("mousedown", handleMouseDown);
        return () => {
            window.removeEventListener("mousedown", handleMouseDown);
            clearPending();
        };
    }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

    const focusedPillar = useStore((s) => s.focusedPillar);

    if (phase === "DONE") return null;

    return (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center">
            <div
                className="transition-opacity"
                style={{
                    opacity: show && !focusedPillar ? 1 : 0,
                    transitionDuration: `${FADE_MS}ms`,
                }}
            >
                <div
                    className="animate-pulse-opacity text-white text-lg font-medium tracking-wide select-none drop-shadow-lg"
                    style={{ fontFamily: "var(--font-open-sans), sans-serif" }}
                >
                    <PhaseContent phase={phase} />
                </div>
            </div>
        </div>
    );
}
