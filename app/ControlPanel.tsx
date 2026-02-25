"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
    IoSettingsOutline,
    IoVolumeHighOutline,
    IoVolumeMuteOutline,
} from "react-icons/io5";
import useStore from "./store";

// Fade-out delay (ms) after closing the panel before the button goes translucent
const FADE_DELAY = 600;

export default function ControlPanel() {
    const [open, setOpen] = useState(false);
    const [hovering, setHovering] = useState(false);
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
    const panelBg = isNight ? "bg-neutral-800/70" : "bg-white/30";
    const panelBorder = isNight ? "border-white/20" : "border-white/40";
    const labelColor = isNight ? "text-gray-200" : "text-gray-800";
    const subColor = isNight ? "text-gray-400" : "text-gray-500";

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

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (fadeTimer.current) clearTimeout(fadeTimer.current);
        };
    }, []);

    // Button is fully opaque when: panel open, hovering, or recently closed
    const buttonOpaque = open || hovering || recentlyClosed;

    return (
        <div
            className="absolute top-4 right-4 z-50 flex flex-col items-end"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
        >
            <div className="flex items-center gap-2">
                {/* Audio mute/unmute button */}
                <button
                    onClick={toggleAudioMuted}
                    className="cursor-pointer rounded-full p-2 transition-all duration-500"
                    style={{
                        opacity: buttonOpaque ? 0.85 : 0.65,
                        background: buttonOpaque ? btnBg : "transparent",
                        backdropFilter: buttonOpaque ? "blur(8px)" : "none",
                    }}
                    aria-label={audioMuted ? "Unmute audio" : "Mute audio"}
                >
                    {audioMuted ? (
                        <IoVolumeMuteOutline
                            size={22}
                            className="transition-colors duration-500"
                            color={buttonOpaque ? iconActive : iconInactive}
                        />
                    ) : (
                        <IoVolumeHighOutline
                            size={22}
                            className="transition-colors duration-500"
                            color={buttonOpaque ? iconActive : iconInactive}
                        />
                    )}
                </button>

                {/* Gear button */}
                <button
                    onClick={handleToggle}
                    className="cursor-pointer rounded-full p-2 transition-all duration-500"
                    style={{
                        opacity: buttonOpaque ? 0.85 : 0.65,
                        background: buttonOpaque ? btnBg : "transparent",
                        backdropFilter: buttonOpaque ? "blur(8px)" : "none",
                    }}
                    aria-label="Settings"
                >
                    <IoSettingsOutline
                        size={22}
                        className="transition-colors duration-500"
                        color={buttonOpaque ? iconActive : iconInactive}
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
                    className={`w-72 rounded-xl border ${panelBorder} ${panelBg} p-4 shadow-lg backdrop-blur-md transition-colors duration-500`}
                >
                    {/* Drift Speed Slider */}
                    <div className="mb-4">
                        <label
                            className={`mb-1 flex items-center justify-between text-xs font-medium ${labelColor} transition-colors duration-500`}
                        >
                            <span>Rock Drift Speed</span>
                            <span
                                className={`font-mono text-[10px] ${subColor} transition-colors duration-500`}
                            >
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
                        <label
                            className={`mb-1 flex items-center justify-between text-xs font-medium ${labelColor} transition-colors duration-500`}
                        >
                            <span>Cursor Repel Strength</span>
                            <span
                                className={`font-mono text-[10px] ${subColor} transition-colors duration-500`}
                            >
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
                    <div className="mb-3 border-t border-white/30" />

                    {/* Day / Night Toggle */}
                    <div className="mb-3 flex items-center justify-between">
                        <span
                            className={`text-xs font-medium ${labelColor} transition-colors duration-500`}
                        >
                            {isNight ? "Night" : "Day"}
                        </span>
                        <button
                            onClick={toggleNight}
                            className={`settings-toggle relative h-6 w-11 cursor-pointer rounded-full transition-colors duration-300 ${
                                isNight ? "bg-indigo-500" : "bg-gray-300"
                            }`}
                            aria-label="Toggle day/night"
                        >
                            <span
                                className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300"
                                style={{
                                    transform: isNight
                                        ? "translateX(20px)"
                                        : "translateX(0)",
                                }}
                            />
                        </button>
                    </div>

                    {/* Rain Toggle */}
                    <div className="flex items-center justify-between">
                        <span
                            className={`text-xs font-medium ${labelColor} transition-colors duration-500`}
                        >
                            Rain
                        </span>
                        <button
                            onClick={toggleRain}
                            className={`settings-toggle relative h-6 w-11 cursor-pointer rounded-full transition-colors duration-300 ${
                                isRaining ? "bg-blue-500" : "bg-gray-300"
                            }`}
                            aria-label="Toggle rain"
                        >
                            <span
                                className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300"
                                style={{
                                    transform: isRaining
                                        ? "translateX(20px)"
                                        : "translateX(0)",
                                }}
                            />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
