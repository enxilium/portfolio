"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import useStore from "../lib/store";

// ── Stargate Activation Overlay ──
// When the user holds LMB in default view:
//  1. Screen starts shaking (CSS transform)
//  2. Dust particles fall from the ceiling (canvas overlay)
//  3. Blue glow intensifies from center
//  4. At climax → flash white → fade into new scene

// Total hold duration to reach climax (ms)
const ACTIVATION_DURATION = 4000;
// White flash duration (ms)
const FLASH_DURATION = 800;

// Dust particle count
const DUST_COUNT = 120;

interface DustParticle {
    x: number; // 0..1 normalized
    y: number; // 0..1 normalized
    speed: number; // fall speed per second (normalized)
    size: number; // pixel size
    opacity: number; // 0..1
    drift: number; // horizontal drift per second
}

function createDust(): DustParticle {
    return {
        x: Math.random(),
        y: -Math.random() * 0.3, // start above viewport
        speed: 0.08 + Math.random() * 0.15,
        size: 1 + Math.random() * 2.5,
        opacity: 0.3 + Math.random() * 0.5,
        drift: (Math.random() - 0.5) * 0.02,
    };
}

interface StargateActivationProps {
    /** Called when the activation completes and the new scene should appear */
    onTransitionComplete: () => void;
}

export default function StargateActivation({
    onTransitionComplete,
}: StargateActivationProps) {
    const freeView = useStore((s) => s.freeView);
    const hoveredPillar = useStore((s) => s.hoveredPillar);
    const focusedPillar = useStore((s) => s.focusedPillar);
    // Activation progress 0..1
    const [progress, setProgress] = useState(0);
    // Whether we've hit the climax and should flash
    const [flashing, setFlashing] = useState(false);
    // Whether we're showing the new scene
    const [transitioned, setTransitioned] = useState(false);
    // Whether LMB is currently held
    const holdingRef = useRef(false);
    const progressRef = useRef(0);
    const rafRef = useRef<number>(0);
    const startTimeRef = useRef<number>(0);
    // Store the activation speed in the Zustand store for StargateAnimation to read
    const setActivationProgress = useStore((s) => s.setActivationProgress);

    // Shake offsets — updated in the animation loop, read during render
    const shakeRef = useRef({ x: 0, y: 0 });
    const [shake, setShake] = useState({ x: 0, y: 0 });

    // Dust particles
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const dustParticles = useRef<DustParticle[]>([]);

    // ── LMB hold tracking ──
    const handleMouseDown = useCallback(
        (e: MouseEvent) => {
            if (e.button !== 0 || freeView || transitioned) return;
            // Don't activate stargate while interacting with pillars
            if (hoveredPillar || focusedPillar) return;
            // Don't activate stargate while content overlay is open
            if (useStore.getState().contentOverlay) return;
            // Only register hold on the canvas — ignore clicks on UI elements
            const target = e.target as HTMLElement;
            if (target.closest("button, input, label, [role='button'], .z-50"))
                return;
            holdingRef.current = true;
            startTimeRef.current =
                performance.now() - progressRef.current * ACTIVATION_DURATION;
        },
        [freeView, transitioned, hoveredPillar, focusedPillar],
    );

    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (e.button !== 0) return;
        holdingRef.current = false;
    }, []);

    useEffect(() => {
        window.addEventListener("mousedown", handleMouseDown);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousedown", handleMouseDown);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [handleMouseDown, handleMouseUp]);

    // ── Animation loop ──
    useEffect(() => {
        if (transitioned) return;

        // Initialize dust
        dustParticles.current = Array.from({ length: DUST_COUNT }, createDust);
        let lastTime = performance.now();

        const tick = (now: number) => {
            const dt = (now - lastTime) / 1000; // seconds
            lastTime = now;

            // Update progress
            if (holdingRef.current && !freeView) {
                progressRef.current = Math.min(
                    1,
                    progressRef.current + dt / (ACTIVATION_DURATION / 1000),
                );
            } else {
                // Decay progress when not holding
                progressRef.current = Math.max(
                    0,
                    progressRef.current - dt * 0.5,
                );
            }

            setProgress(progressRef.current);
            setActivationProgress(progressRef.current);

            // Update shake
            if (progressRef.current > 0.1) {
                shakeRef.current = {
                    x: (Math.random() - 0.5) * progressRef.current * 12,
                    y: (Math.random() - 0.5) * progressRef.current * 12,
                };
            } else {
                shakeRef.current = { x: 0, y: 0 };
            }
            setShake({ ...shakeRef.current });

            // Check if climax reached
            if (progressRef.current >= 1 && !flashing) {
                setFlashing(true);
                holdingRef.current = false;
                setTimeout(() => {
                    setTransitioned(true);
                    onTransitionComplete();
                }, FLASH_DURATION);
                return;
            }

            // ── Draw dust particles ──
            const canvas = canvasRef.current;
            if (canvas && progressRef.current > 0.05) {
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    const w = canvas.width;
                    const h = canvas.height;
                    ctx.clearRect(0, 0, w, h);

                    const intensity = progressRef.current;
                    dustParticles.current.forEach((p) => {
                        // Update position
                        p.y += p.speed * dt * (0.5 + intensity * 2);
                        p.x += p.drift * dt;

                        // Reset if fallen below viewport
                        if (p.y > 1.1) {
                            p.x = Math.random();
                            p.y = -0.05;
                            p.speed = 0.08 + Math.random() * 0.15;
                        }

                        // Draw
                        ctx.globalAlpha = p.opacity * intensity;
                        ctx.fillStyle = "#c8b8a0";
                        ctx.beginPath();
                        ctx.arc(
                            p.x * w,
                            p.y * h,
                            p.size * (0.5 + intensity),
                            0,
                            Math.PI * 2,
                        );
                        ctx.fill();
                    });
                }
            } else if (canvasRef.current) {
                const ctx = canvasRef.current.getContext("2d");
                ctx?.clearRect(
                    0,
                    0,
                    canvasRef.current.width,
                    canvasRef.current.height,
                );
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [
        freeView,
        transitioned,
        flashing,
        setActivationProgress,
        onTransitionComplete,
    ]);

    // ── Resize dust canvas ──
    useEffect(() => {
        const resize = () => {
            const canvas = canvasRef.current;
            if (canvas) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
        };
        resize();
        window.addEventListener("resize", resize);
        return () => window.removeEventListener("resize", resize);
    }, []);

    if (transitioned) return null;

    return (
        <>
            {/* Screen shake wrapper — applies to entire viewport via CSS */}
            {progress > 0.1 && (
                <style>{`
                    html, body {
                        overflow: hidden !important;
                    }
                    .scene-root {
                        transform: translate(${shake.x}px, ${shake.y}px);
                    }
                `}</style>
            )}

            {/* Dust particle canvas */}
            <canvas
                ref={canvasRef}
                className="pointer-events-none fixed inset-0 z-30"
                style={{ opacity: progress > 0.05 ? 1 : 0 }}
            />

            {/* White glow from center */}
            {progress > 0.15 && (
                <div
                    className="pointer-events-none fixed inset-0 z-20"
                    style={{
                        background: `radial-gradient(circle at 50% 50%, rgba(255, 255, 255, ${progress * 0.6}) 0%, rgba(220, 220, 220, ${progress * 0.3}) 30%, transparent 70%)`,
                    }}
                />
            )}

            {/* White flash */}
            <div
                className="pointer-events-none fixed inset-0 z-40"
                style={{
                    backgroundColor: "white",
                    opacity: flashing ? 1 : 0,
                    transition: `opacity ${FLASH_DURATION / 2}ms ease-in`,
                }}
            />
        </>
    );
}
