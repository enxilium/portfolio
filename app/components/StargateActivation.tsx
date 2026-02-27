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
    // Whether we've hit the climax and should flash (triggers React render)
    const [flashing, setFlashing] = useState(false);
    // Whether we're showing the new scene (triggers React render)
    const [transitioned, setTransitioned] = useState(false);
    // Whether LMB is currently held
    const holdingRef = useRef(false);
    const progressRef = useRef(0);
    const rafRef = useRef<number>(0);
    const startTimeRef = useRef<number>(0);
    // Store the activation speed in the Zustand store for StargateAnimation to read
    const setActivationProgress = useStore((s) => s.setActivationProgress);

    // DOM refs for direct manipulation — avoids React re-renders at 60fps
    const sceneRootStyleRef = useRef<HTMLStyleElement | null>(null);
    const glowRef = useRef<HTMLDivElement>(null);
    const flashRef = useRef<HTMLDivElement>(null);

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

    // Create a <style> element for shake transform (injected once, updated via textContent)
    useEffect(() => {
        const style = document.createElement("style");
        document.head.appendChild(style);
        sceneRootStyleRef.current = style;
        return () => {
            style.remove();
            sceneRootStyleRef.current = null;
        };
    }, []);

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

            const progress = progressRef.current;
            setActivationProgress(progress);

            // ── Update shake via direct DOM manipulation (no React re-render) ──
            if (progress > 0.1) {
                const sx = (Math.random() - 0.5) * progress * 12;
                const sy = (Math.random() - 0.5) * progress * 12;
                if (sceneRootStyleRef.current) {
                    sceneRootStyleRef.current.textContent = `html, body { overflow: hidden !important; } .scene-root { transform: translate(${sx}px, ${sy}px); }`;
                }
            } else if (sceneRootStyleRef.current) {
                sceneRootStyleRef.current.textContent = "";
            }

            // ── Update glow via direct DOM manipulation ──
            if (glowRef.current) {
                if (progress > 0.15) {
                    glowRef.current.style.display = "";
                    glowRef.current.style.background = `radial-gradient(circle at 50% 50%, rgba(255, 255, 255, ${progress * 0.6}) 0%, rgba(220, 220, 220, ${progress * 0.3}) 30%, transparent 70%)`;
                } else {
                    glowRef.current.style.display = "none";
                }
            }

            // ── Update dust canvas opacity ──
            if (canvasRef.current) {
                canvasRef.current.style.opacity = progress > 0.05 ? "1" : "0";
            }

            // Check if climax reached
            if (progress >= 1 && !flashing) {
                setFlashing(true);
                holdingRef.current = false;
                if (flashRef.current) {
                    flashRef.current.style.opacity = "1";
                }
                setTimeout(() => {
                    setTransitioned(true);
                    onTransitionComplete();
                }, FLASH_DURATION);
                return;
            }

            // ── Draw dust particles ──
            const canvas = canvasRef.current;
            if (canvas && progress > 0.05) {
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    const w = canvas.width;
                    const h = canvas.height;
                    ctx.clearRect(0, 0, w, h);

                    const intensity = progress;
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
            {/* Dust particle canvas — opacity controlled via direct DOM manipulation */}
            <canvas
                ref={canvasRef}
                className="pointer-events-none fixed inset-0 z-30"
                style={{ opacity: 0 }}
            />

            {/* White glow from center — background controlled via direct DOM manipulation */}
            <div
                ref={glowRef}
                className="pointer-events-none fixed inset-0 z-20"
                style={{ display: "none" }}
            />

            {/* White flash */}
            <div
                ref={flashRef}
                className="pointer-events-none fixed inset-0 z-40"
                style={{
                    backgroundColor: "white",
                    opacity: 0,
                    transition: `opacity ${FLASH_DURATION / 2}ms ease-in`,
                }}
            />
        </>
    );
}
