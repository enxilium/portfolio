"use client";

import { useState, useEffect } from "react";

// ── Placeholder for the post-stargate scene ──
// Fades in from white after the stargate activation flash.

export default function PostStargateScene() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Small delay so the white flash covers the mount
        const t = setTimeout(() => setVisible(true), 100);
        return () => clearTimeout(t);
    }, []);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-white"
            style={{
                opacity: visible ? 1 : 0,
                transition: "opacity 800ms ease-out",
            }}
        >
            <div
                className="text-center"
                style={{
                    fontFamily: "var(--font-open-sans), sans-serif",
                }}
            >
                <h1 className="text-5xl font-bold text-gray-900 mb-4">
                    Welcome
                </h1>
                <p className="text-xl text-gray-500">
                    You have entered the stargate. This is a placeholder scene.
                </p>
            </div>
        </div>
    );
}
