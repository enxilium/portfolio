"use client";

import { useState, useEffect } from "react";

// ── Placeholder for the post-stargate scene ──
// Mounts at full-opacity white (seamlessly continuing the stargate flash),
// then fades its content in while the white background recedes.

export default function PostStargateScene() {
    // Content visibility — starts hidden, fades in after mount
    const [contentVisible, setContentVisible] = useState(false);

    useEffect(() => {
        // Allow one frame for the component to mount at full white,
        // then begin the content fade-in
        const raf = requestAnimationFrame(() => {
            setContentVisible(true);
        });
        return () => cancelAnimationFrame(raf);
    }, []);

    return (
        // Outer wrapper: always opacity-1 so the white flash is seamless.
        // Background transitions from white → dark once content is ready.
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{
                backgroundColor: contentVisible ? "#111" : "white",
                transition: "background-color 1200ms ease-out",
            }}
        >
            <div
                className="text-center"
                style={{
                    opacity: contentVisible ? 1 : 0,
                    transition: "opacity 1200ms ease-out",
                    fontFamily: "var(--font-open-sans), sans-serif",
                }}
            >
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
                    Welcome
                </h1>
                <p className="text-base sm:text-lg md:text-xl px-6 max-w-xl text-gray-400">
                    You have entered the stargate. This area is still under
                    construction.
                </p>
            </div>
        </div>
    );
}
