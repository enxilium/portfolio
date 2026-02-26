"use client";

import { useEffect, useRef, useState } from "react";
import useStore from "../lib/store";

// Fade duration (ms)
const FADE_MS = 400;

export default function AcknowledgmentsModal() {
    const acknowledgmentsOpen = useStore((s) => s.acknowledgmentsOpen);
    const setAcknowledgmentsOpen = useStore((s) => s.setAcknowledgmentsOpen);

    // Manage mount/fade independently so we can animate out before unmounting
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(false);
    const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (acknowledgmentsOpen) {
            setMounted(true);
            // Double-rAF: first frame mounts at opacity 0, second frame
            // triggers the transition to opacity 1. A single rAF can get
            // batched with the mount by the browser, skipping the transition.
            const raf1 = requestAnimationFrame(() => {
                raf2 = requestAnimationFrame(() => {
                    setVisible(true);
                });
            });
            let raf2 = 0;
            return () => {
                cancelAnimationFrame(raf1);
                cancelAnimationFrame(raf2);
            };
        } else {
            // Fade out, then unmount
            setVisible(false);
            if (fadeTimer.current) clearTimeout(fadeTimer.current);
            fadeTimer.current = setTimeout(() => {
                setMounted(false);
            }, FADE_MS + 50);
        }
    }, [acknowledgmentsOpen]);

    useEffect(() => {
        return () => {
            if (fadeTimer.current) clearTimeout(fadeTimer.current);
        };
    }, []);

    // Close on click anywhere
    const handleClose = () => {
        setAcknowledgmentsOpen(false);
    };

    // Close on Escape key
    useEffect(() => {
        if (!acknowledgmentsOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") handleClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [acknowledgmentsOpen]);

    if (!mounted) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer"
            onClick={handleClose}
            style={{
                opacity: visible ? 1 : 0,
                transition: `opacity ${FADE_MS}ms ease-in-out`,
                backgroundColor: "rgba(0, 0, 0, 0.6)",
                backdropFilter: "blur(8px)",
            }}
        >
            <div
                className="relative max-h-[80vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto rounded-md border border-white/10 bg-black/80 p-6 shadow-xl backdrop-blur-xl"
                style={{
                    fontFamily: "var(--font-geist-mono), monospace",
                    cursor: "default",
                    transform: visible ? "scale(1)" : "scale(0.96)",
                    transition: `transform ${FADE_MS}ms ease-in-out`,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="mb-4 flex items-center gap-2">
                    <span className="text-[10px] tracking-[3px] uppercase text-white/30">
                        {"// ACKNOWLEDGMENTS"}
                    </span>
                    <div className="flex-1 border-t border-white/10" />
                </div>

                {/* Content */}
                <div
                    className="space-y-4 text-sm leading-relaxed text-white/70"
                    style={{
                        fontFamily:
                            "var(--font-open-sans), 'Avenir', sans-serif",
                    }}
                >
                    <p>
                        The 3D scene and background music you hear were created
                        with the help of{" "}
                        <a
                            href="https://sophieshu.vercel.app/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-white/90 underline decoration-white/30 underline-offset-2 transition-colors hover:text-white hover:decoration-white/60"
                        >
                            Sophie Shu
                        </a>
                        , using assets by:
                    </p>

                    <ul className="list-none space-y-3 pl-0">
                        <li className="flex gap-2">
                            <span className="text-white/30">▸</span>
                            <span>
                                <a
                                    href="https://sketchfab.com/3d-models/gothic-interior-kit-mid-poly-cd988423f3ff4cec8193cb1abfa11b8f"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-white/90 underline decoration-white/30 underline-offset-2 transition-colors hover:text-white hover:decoration-white/60"
                                >
                                    @Zver3D
                                </a>{" "}
                                — Gothic Interior Kit (Mid-Poly)
                            </span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-white/30">▸</span>
                            <span>
                                <a
                                    href="https://sketchfab.com/3d-models/bomb-crack-ground-00-free-c5cb1a953d1747b0af697c004d74735d"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-white/90 underline decoration-white/30 underline-offset-2 transition-colors hover:text-white hover:decoration-white/60"
                                >
                                    @paulyang
                                </a>{" "}
                                — Bomb Crack Ground 00 (Free)
                            </span>
                        </li>
                        <li className="flex gap-2">
                            <span className="text-white/30">▸</span>
                            <span>
                                <a
                                    href="https://sketchfab.com/3d-models/milky-way-stargate-stargate-sg-1-517b56e322a548ac81dd8454dbbd95bf"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-white/90 underline decoration-white/30 underline-offset-2 transition-colors hover:text-white hover:decoration-white/60"
                                >
                                    @AnquietasSystem
                                </a>{" "}
                                — Milky Way Stargate (Stargate SG-1)
                            </span>
                        </li>
                    </ul>

                    <p className="text-white/40 text-xs pt-2">
                        Click anywhere to close.
                    </p>
                </div>
            </div>
        </div>
    );
}
