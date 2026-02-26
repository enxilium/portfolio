"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
    IoSettingsOutline,
    IoVolumeHighOutline,
    IoVolumeMuteOutline,
} from "react-icons/io5";
import useStore from "../lib/store";

// Fade-out delay (ms) after closing the panel before the button goes translucent
const FADE_DELAY = 600;

export default function ControlPanel() {
    const [open, setOpen] = useState(false);
    const [hoveringAudio, setHoveringAudio] = useState(false);
    const [hoveringGear, setHoveringGear] = useState(false);
    // Tracks whether we're in the post-close fade window
    const [recentlyClosed, setRecentlyClosed] = useState(false);
    const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Store selectors
    const driftSpeed = useStore((s) => s.driftSpeed);
    const repelStrength = useStore((s) => s.repelStrength);
    const isNight = useStore((s) => s.isNight);
    const isRaining = useStore((s) => s.isRaining);
    const setDriftSpeed = useStore((s) => s.setDriftSpeed);
    const setRepelStrength = useStore((s) => s.setRepelStrength);
    const toggleNight = useStore((s) => s.toggleNight);
    const toggleRain = useStore((s) => s.toggleRain);
    const audioMuted = useStore((s) => s.audioMuted);
    const toggleAudioMuted = useStore((s) => s.toggleAudioMuted);

    // Night-aware colors
    const iconActive = isNight ? "#ffffff" : "#1a1a1a";
    const iconInactive = isNight ? "#ccc" : "#888";
    const btnBg = isNight ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.25)";

    const handleToggle = useCallback(() => {
        setOpen((prev) => {
            if (prev) {
                // Closing — start fade timer
                setRecentlyClosed(true);
                if (fadeTimer.current) clearTimeout(fadeTimer.current);
                fadeTimer.current = setTimeout(() => {
                    setRecentlyClosed(false);
                }, FADE_DELAY);
            }
            return !prev;
        });
    }, []);

    const panelRef = useRef<HTMLDivElement>(null);

    // Close panel when clicking outside
    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (
                panelRef.current &&
                !panelRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
                setRecentlyClosed(true);
                if (fadeTimer.current) clearTimeout(fadeTimer.current);
                fadeTimer.current = setTimeout(() => {
                    setRecentlyClosed(false);
                }, FADE_DELAY);
            }
        };
        // Delay listener to avoid closing on the same click that opened
        const raf = requestAnimationFrame(() => {
            window.addEventListener("mousedown", handleClickOutside);
        });
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("mousedown", handleClickOutside);
        };
    }, [open]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (fadeTimer.current) clearTimeout(fadeTimer.current);
        };
    }, []);

    // Per-button opaque state: each button lights up independently on hover.
    // The gear button also stays opaque when the panel is open or recently closed.
    const audioOpaque = hoveringAudio;
    const gearOpaque = open || hoveringGear || recentlyClosed;

    return (
        <div
            ref={panelRef}
            className="absolute top-4 right-4 z-50 flex flex-col items-end"
        >
            <div className="flex items-center gap-2">
                {/* Audio mute/unmute button */}
                <button
                    onClick={toggleAudioMuted}
                    onMouseEnter={() => setHoveringAudio(true)}
                    onMouseLeave={() => setHoveringAudio(false)}
                    className="cursor-pointer rounded-full p-2 transition-all duration-500"
                    style={{
                        opacity: audioOpaque ? 0.85 : 0.65,
                        background: audioOpaque ? btnBg : "transparent",
                        backdropFilter: audioOpaque ? "blur(8px)" : "none",
                    }}
                    aria-label={audioMuted ? "Unmute audio" : "Mute audio"}
                >
                    {audioMuted ? (
                        <IoVolumeMuteOutline
                            size={22}
                            className="transition-colors duration-500"
                            color={audioOpaque ? iconActive : iconInactive}
                        />
                    ) : (
                        <IoVolumeHighOutline
                            size={22}
                            className="transition-colors duration-500"
                            color={audioOpaque ? iconActive : iconInactive}
                        />
                    )}
                </button>

                {/* Gear button */}
                <button
                    onClick={handleToggle}
                    onMouseEnter={() => setHoveringGear(true)}
                    onMouseLeave={() => setHoveringGear(false)}
                    className="cursor-pointer rounded-full p-2 transition-all duration-500"
                    style={{
                        opacity: gearOpaque ? 0.85 : 0.65,
                        background: gearOpaque ? btnBg : "transparent",
                        backdropFilter: gearOpaque ? "blur(8px)" : "none",
                    }}
                    aria-label="Settings"
                >
                    <IoSettingsOutline
                        size={22}
                        className="transition-colors duration-500"
                        color={gearOpaque ? iconActive : iconInactive}
                    />
                </button>
            </div>

            {/* Dropdown panel */}
            <div
                className="mt-2 origin-top-right overflow-hidden transition-all duration-300"
                style={{
                    maxHeight: open ? "400px" : "0px",
                    opacity: open ? 1 : 0,
                    pointerEvents: open ? "auto" : "none",
                }}
            >
                <div
                    className="w-[calc(100vw-2rem)] max-w-72 rounded-md border border-white/10 bg-black/60 p-4 shadow-lg backdrop-blur-xl transition-colors duration-500"
                    style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                >
                    {/* Panel header */}
                    <div className="mb-3 flex items-center gap-2">
                        <span className="text-[10px] tracking-[3px] uppercase text-white/30">
                            {"// SYS.CONFIG"}
                        </span>
                        <div className="flex-1 border-t border-white/10" />
                    </div>

                    {/* Drift Speed Slider */}
                    <div className="mb-4">
                        <label className="mb-1 flex items-center justify-between text-[11px] tracking-[1px] uppercase text-white/50 transition-colors duration-500">
                            <span>asteroid_drift_speed</span>
                            <span className="text-[10px] text-white/30 transition-colors duration-500">
                                {driftSpeed.toFixed(2)}
                            </span>
                        </label>
                        <input
                            type="range"
                            min={0.05}
                            max={1.0}
                            step={0.05}
                            value={driftSpeed}
                            onChange={(e) =>
                                setDriftSpeed(parseFloat(e.target.value))
                            }
                            className="settings-slider w-full"
                        />
                    </div>

                    {/* Repel Strength Slider */}
                    <div className="mb-4">
                        <label className="mb-1 flex items-center justify-between text-[11px] tracking-[1px] uppercase text-white/50 transition-colors duration-500">
                            <span>cursor_repel_force</span>
                            <span className="text-[10px] text-white/30 transition-colors duration-500">
                                {repelStrength.toFixed(1)}
                            </span>
                        </label>
                        <input
                            type="range"
                            min={0}
                            max={3}
                            step={0.1}
                            value={repelStrength}
                            onChange={(e) =>
                                setRepelStrength(parseFloat(e.target.value))
                            }
                            className="settings-slider w-full"
                        />
                    </div>

                    {/* Divider */}
                    <div className="mb-3 border-t border-white/10" />

                    {/* Day / Night Toggle */}
                    <div className="mb-3 flex items-center justify-between">
                        <span className="text-[11px] tracking-[1px] uppercase text-white/50 transition-colors duration-500">
                            {isNight ? "mode::night" : "mode::day"}
                        </span>
                        <button
                            onClick={toggleNight}
                            className="settings-toggle relative h-[22px] w-11 cursor-pointer overflow-hidden transition-all duration-300"
                            style={{
                                background: "rgba(255, 255, 255, 0.04)",
                                border: `1px solid ${isNight ? "rgba(99, 102, 241, 0.4)" : "rgba(255, 255, 255, 0.10)"}`,
                            }}
                            aria-label="Toggle day/night"
                        >
                            {/* Sliding rectangle thumb */}
                            <span
                                className="absolute top-[2px] h-[calc(100%-4px)] w-[18px] transition-all duration-300"
                                style={{
                                    left: isNight ? "calc(100% - 20px)" : "2px",
                                    background: isNight
                                        ? "rgba(99, 102, 241, 0.5)"
                                        : "rgba(255, 255, 255, 0.12)",
                                    border: `1px solid ${isNight ? "rgba(129, 140, 248, 0.6)" : "rgba(255, 255, 255, 0.18)"}`,
                                    boxShadow: isNight
                                        ? "0 0 8px rgba(99, 102, 241, 0.4), inset 0 0 4px rgba(129, 140, 248, 0.2)"
                                        : "none",
                                }}
                            />
                        </button>
                    </div>

                    {/* Rain Toggle */}
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] tracking-[1px] uppercase text-white/50 transition-colors duration-500">
                            rain
                        </span>
                        <button
                            onClick={toggleRain}
                            className="settings-toggle relative h-[22px] w-11 cursor-pointer overflow-hidden transition-all duration-300"
                            style={{
                                background: "rgba(255, 255, 255, 0.04)",
                                border: `1px solid ${isRaining ? "rgba(59, 130, 246, 0.4)" : "rgba(255, 255, 255, 0.10)"}`,
                            }}
                            aria-label="Toggle rain"
                        >
                            {/* Sliding rectangle thumb */}
                            <span
                                className="absolute top-[2px] h-[calc(100%-4px)] w-[18px] transition-all duration-300"
                                style={{
                                    left: isRaining
                                        ? "calc(100% - 20px)"
                                        : "2px",
                                    background: isRaining
                                        ? "rgba(59, 130, 246, 0.5)"
                                        : "rgba(255, 255, 255, 0.12)",
                                    border: `1px solid ${isRaining ? "rgba(96, 165, 250, 0.6)" : "rgba(255, 255, 255, 0.18)"}`,
                                    boxShadow: isRaining
                                        ? "0 0 8px rgba(59, 130, 246, 0.4), inset 0 0 4px rgba(96, 165, 250, 0.2)"
                                        : "none",
                                }}
                            />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
