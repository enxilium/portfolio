"use client";

import { useEffect, useRef } from "react";
import useStore from "../../../lib/store";

// ── Rain config ──
// Lower count = lighter, less particly rain
const DROP_COUNT = 200;
// Line length in pixels
const MIN_LENGTH = 18;
const MAX_LENGTH = 34;
// Speed in px/frame
const MIN_SPEED = 14;
const MAX_SPEED = 22;
// Angle from vertical (radians) — slight diagonal
const ANGLE = 0.22; // ~12.5°
// Fade speed per frame (~60fps)
const FADE_SPEED = 0.02;

interface Drop {
    x: number;
    y: number;
    length: number;
    speed: number;
    opacity: number;
}

export default function RainEffect() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const dropsRef = useRef<Drop[]>([]);
    const globalOpacity = useRef(0);
    const rafRef = useRef(0);
    const isRainingRef = useRef(useStore.getState().isRaining);

    useEffect(() => {
        const unsub = useStore.subscribe((state) => {
            isRainingRef.current = state.isRaining;
        });
        return unsub;
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener("resize", resize);

        // Init drops scattered across the viewport
        const drops: Drop[] = [];
        for (let i = 0; i < DROP_COUNT; i++) {
            drops.push({
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                length: MIN_LENGTH + Math.random() * (MAX_LENGTH - MIN_LENGTH),
                speed: MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED),
                opacity: 0.2 + Math.random() * 0.5,
            });
        }
        dropsRef.current = drops;

        const sinA = Math.sin(ANGLE);
        const cosA = Math.cos(ANGLE);

        // Whether the rAF loop is currently running
        let loopRunning = false;

        const tick = () => {
            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            // Fade global opacity toward target
            const target = isRainingRef.current ? 1 : 0;
            globalOpacity.current +=
                (target - globalOpacity.current) * FADE_SPEED;

            if (globalOpacity.current < 0.005) {
                if (!isRainingRef.current) {
                    // Rain fully faded out — stop the loop to save CPU
                    globalOpacity.current = 0;
                    loopRunning = false;
                    return;
                }
                rafRef.current = requestAnimationFrame(tick);
                return;
            }

            const gAlpha = globalOpacity.current;

            for (let i = 0; i < drops.length; i++) {
                const d = drops[i];

                // Move along the angled direction
                d.x += sinA * d.speed;
                d.y += cosA * d.speed;

                // Wrap around screen edges
                if (d.y > h + d.length) {
                    d.y = -d.length;
                    d.x = Math.random() * w;
                }
                if (d.x > w + 20) {
                    d.x = -20;
                }

                // Draw line
                const endX = d.x + sinA * d.length;
                const endY = d.y + cosA * d.length;

                const alpha = d.opacity * gAlpha;
                ctx.strokeStyle = `rgba(180, 210, 255, ${alpha})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(d.x, d.y);
                ctx.lineTo(endX, endY);
                ctx.stroke();
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        // Start the loop function (called when rain starts)
        const startLoop = () => {
            if (loopRunning) return;
            loopRunning = true;
            rafRef.current = requestAnimationFrame(tick);
        };

        // Subscribe to rain state to start/stop the loop
        const unsubRain = useStore.subscribe((state) => {
            if (state.isRaining) startLoop();
        });

        // If already raining at mount time, start immediately
        if (isRainingRef.current) startLoop();

        return () => {
            cancelAnimationFrame(rafRef.current);
            loopRunning = false;
            unsubRain();
            window.removeEventListener("resize", resize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0"
            style={{ zIndex: 10 }}
        />
    );
}
