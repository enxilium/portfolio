"use client";

import { useEffect, useRef, useState } from "react";
import useStore from "../lib/store";

// ── Intro boot sequence that plays while models load ──
// Shows hacker-style initialization lines, then slides open "bunker doors".

// Each line: { text, delayBefore (ms) }
const BOOT_LINES = [
    { text: "> SYSTEM BOOT v3.17.2", delay: 300 },
    { text: "> Initializing stargate core...", delay: 600 },
    { text: "> Loading geometry buffers.............. OK", delay: 800 },
    { text: "> Decompressing Draco meshes........... OK", delay: 500 },
    { text: "> Fetching repositories................", delay: 700 },
    { text: "  ├─ portfolio-site ✓", delay: 300 },
    { text: "  ├─ shader-lab ✓", delay: 250 },
    { text: "  └─ stargate-engine ✓", delay: 250 },
    { text: "> Calibrating ring alignment........... OK", delay: 600 },
    { text: "> Establishing wormhole lock........... OK", delay: 500 },
    { text: "> All systems nominal", delay: 400 },
    { text: "> OPENING BUNKER DOORS", delay: 800 },
];

// Duration of the door-slide animation (ms)
const DOOR_SLIDE_MS = 1200;
// Duration to fade out the whole overlay after doors open (ms)
const FADE_OUT_MS = 600;

interface IntroSequenceProps {
    /** Called when the entire intro is finished and should be unmounted */
    onComplete: () => void;
    /** Whether the 3D scene has finished loading */
    sceneReady: boolean;
}

export default function IntroSequence({
    onComplete,
    sceneReady,
}: IntroSequenceProps) {
    // Lines that have been "typed" so far
    const [visibleLines, setVisibleLines] = useState<string[]>([]);
    // Whether boot text is done and we should open doors
    const [bootDone, setBootDone] = useState(false);
    // Whether the doors are sliding open
    const [doorsOpen, setDoorsOpen] = useState(false);
    // Whether the whole overlay is fading out
    const [fadingOut, setFadingOut] = useState(false);

    const terminalRef = useRef<HTMLDivElement>(null);
    // Track whether we've already waited for scene once
    const waitedForScene = useRef(false);

    // ── Type out boot lines one by one ──
    useEffect(() => {
        let cancelled = false;
        let timeout: ReturnType<typeof setTimeout>;

        const showLine = (index: number) => {
            if (cancelled || index >= BOOT_LINES.length) {
                if (!cancelled) setBootDone(true);
                return;
            }
            timeout = setTimeout(() => {
                if (cancelled) return;
                setVisibleLines((prev) => [...prev, BOOT_LINES[index].text]);
                showLine(index + 1);
            }, BOOT_LINES[index].delay);
        };

        // Small initial delay before first line
        timeout = setTimeout(() => showLine(0), 500);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, []);

    // Auto-scroll terminal to bottom
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [visibleLines]);

    // ── When boot is done AND scene is ready, open doors ──
    useEffect(() => {
        if (!bootDone) return;
        if (!sceneReady && !waitedForScene.current) {
            // Wait for scene — once it becomes ready, this effect re-runs
            waitedForScene.current = true;
            return;
        }

        // Start door opening
        const t1 = setTimeout(() => {
            setDoorsOpen(true);
            useStore.getState().setBunkerOpen(true);
        }, 200);
        // After doors finish sliding, start fade out
        const t2 = setTimeout(() => setFadingOut(true), 200 + DOOR_SLIDE_MS);
        // After fade out, call onComplete
        const t3 = setTimeout(
            () => onComplete(),
            200 + DOOR_SLIDE_MS + FADE_OUT_MS,
        );

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, [bootDone, sceneReady, onComplete]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{
                opacity: fadingOut ? 0 : 1,
                transition: `opacity ${FADE_OUT_MS}ms ease-in`,
                pointerEvents: fadingOut ? "none" : "auto",
            }}
        >
            {/* Left door */}
            <div
                className="absolute inset-y-0 left-0 w-1/2 bg-black"
                style={{
                    transform: doorsOpen
                        ? "translateX(-100%)"
                        : "translateX(0)",
                    transition: `transform ${DOOR_SLIDE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                }}
            />
            {/* Right door */}
            <div
                className="absolute inset-y-0 right-0 w-1/2 bg-black"
                style={{
                    transform: doorsOpen ? "translateX(100%)" : "translateX(0)",
                    transition: `transform ${DOOR_SLIDE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
                }}
            />

            {/* Terminal text — sits on top of the doors */}
            <div
                className="relative z-10 w-full max-w-xl px-6"
                style={{
                    opacity: doorsOpen ? 0 : 1,
                    transition: "opacity 400ms ease-out",
                }}
            >
                <div
                    ref={terminalRef}
                    className="max-h-80 overflow-hidden"
                    style={{
                        fontFamily: "var(--font-geist-mono), monospace",
                        fontSize: "0.8rem",
                        lineHeight: "1.6",
                        color: "#00ff88",
                    }}
                >
                    {visibleLines.map((line, i) => (
                        <div key={i} className="whitespace-pre">
                            {line}
                            {i === visibleLines.length - 1 && !bootDone && (
                                <span className="animate-blink">█</span>
                            )}
                        </div>
                    ))}
                    {visibleLines.length === 0 && (
                        <span className="animate-blink">█</span>
                    )}
                </div>
            </div>
        </div>
    );
}
