"use client";

import { useEffect, useRef } from "react";
import useStore from "./store";

// Thunderstorm volume limits
const THUNDER_MAX_VOLUME = 0.6;
// Music playback rates (speed only — pitch is preserved by the browser)
const MUSIC_DAY_RATE = 1.0;
const MUSIC_NIGHT_RATE = 0.7;
// Fade speed (per rAF tick, ~60fps → ~2s full transition)
const FADE_STEP = 0.008;
// Rate smoothing factor — small = slower, smoother transition
const RATE_SMOOTH = 0.015;

export default function AudioManager() {
    const musicRef = useRef<HTMLAudioElement | null>(null);
    const thunderRef = useRef<HTMLAudioElement | null>(null);

    // Current targets (driven by store)
    const targetMusicRate = useRef(MUSIC_DAY_RATE);
    const targetThunderVol = useRef(0);

    // Animation frame handle
    const rafRef = useRef<number>(0);

    // Track whether music has started playing
    const startedRef = useRef(false);
    // Target music volume (0 when muted, 0.8 when unmuted)
    const targetMusicVol = useRef(0.8);

    useEffect(() => {
        // Create audio elements — no AudioContext needed.
        // HTMLAudioElement.playbackRate changes speed while the browser's
        // built-in pitch-preservation (preservesPitch=true, default) keeps
        // the audio sounding clean.
        const music = new Audio("/music.mp3");
        music.loop = true;
        music.volume = 0;
        music.preload = "none";
        // Explicitly ensure pitch is preserved (default in modern browsers)
        music.preservesPitch = true;
        musicRef.current = music;

        const thunder = new Audio("/thunderstorm.mp3");
        thunder.loop = true;
        thunder.volume = 0;
        thunder.preload = "none";
        thunderRef.current = thunder;

        // Try to start music playback (called from bunkerOpen signal or user gesture)
        const tryPlay = () => {
            if (startedRef.current) return;
            // Only autoplay if user previously had audio unmuted
            if (useStore.getState().audioMuted) return;
            startedRef.current = true;
            music.play().catch(() => {
                // Autoplay blocked — reset so user gesture can retry
                startedRef.current = false;
            });
        };

        // Start music as soon as the bunker doors open (only if not muted)
        const unsubBunker = useStore.subscribe((state) => {
            if (state.bunkerOpen) tryPlay();
        });

        // Fallback: unlock on first user interaction if autoplay was blocked
        const unlock = () => tryPlay();
        document.addEventListener("click", unlock, { once: false });
        document.addEventListener("keydown", unlock, { once: false });
        document.addEventListener("pointerdown", unlock, { once: false });

        // Subscribe to store changes (mute, day/night, rain)
        const unsub = useStore.subscribe((state) => {
            targetMusicRate.current = state.isNight
                ? MUSIC_NIGHT_RATE
                : MUSIC_DAY_RATE;
            targetThunderVol.current =
                state.isRaining && !state.audioMuted ? THUNDER_MAX_VOLUME : 0;

            // Instant mute/unmute — set volume directly, no fade
            if (state.audioMuted) {
                music.volume = 0;
                targetMusicVol.current = 0;
            } else {
                targetMusicVol.current = 0.8;
                // If already playing, snap volume up immediately
                if (startedRef.current) {
                    music.volume = 0.8;
                }
            }

            // When user unmutes, ensure audio is playing
            if (!state.audioMuted && !startedRef.current && state.bunkerOpen) {
                startedRef.current = true;
                music.play().catch(() => {
                    startedRef.current = false;
                });
            }
        });

        // Whether the rAF loop is currently running
        let loopRunning = false;

        // Smoothing loop via rAF — only runs when a fade is in progress
        const tick = () => {
            const m = musicRef.current;
            const t = thunderRef.current;
            let settled = true;

            // Smoothly adjust music playbackRate and volume
            if (m) {
                const currentRate = m.playbackRate;
                const rateTarget = targetMusicRate.current;
                const rateDiff = rateTarget - currentRate;
                if (Math.abs(rateDiff) > 0.002) {
                    m.playbackRate = currentRate + rateDiff * RATE_SMOOTH;
                    settled = false;
                } else {
                    m.playbackRate = rateTarget;
                }

                // Keep music volume in sync with target
                // (mute/unmute is instant via the subscribe callback;
                //  this just catches any drift)
                if (m.volume !== targetMusicVol.current) {
                    m.volume = targetMusicVol.current;
                }
            }

            // Smoothly adjust thunder volume
            if (t) {
                const currentVol = t.volume;
                const target = targetThunderVol.current;
                const diff = target - currentVol;

                if (Math.abs(diff) > 0.005) {
                    t.volume = Math.max(
                        0,
                        Math.min(1, currentVol + Math.sign(diff) * FADE_STEP),
                    );
                    settled = false;
                } else {
                    t.volume = target;
                }

                // Start/stop thunder playback
                if (target > 0 && t.paused && startedRef.current) {
                    t.play().catch(() => {});
                } else if (target === 0 && t.volume < 0.005 && !t.paused) {
                    t.pause();
                    t.volume = 0;
                }
            }

            if (settled) {
                // All values have converged — stop the loop
                loopRunning = false;
                return;
            }
            rafRef.current = requestAnimationFrame(tick);
        };

        // Start the fading loop (idempotent)
        const startFadeLoop = () => {
            if (loopRunning) return;
            loopRunning = true;
            rafRef.current = requestAnimationFrame(tick);
        };

        // Kick off the fade loop whenever a store value changes that affects audio
        const unsubFade = useStore.subscribe(() => {
            startFadeLoop();
        });

        // Start once on mount in case initial state needs fading
        startFadeLoop();

        return () => {
            unsub();
            unsubBunker();
            unsubFade();
            cancelAnimationFrame(rafRef.current);
            loopRunning = false;
            document.removeEventListener("click", unlock);
            document.removeEventListener("keydown", unlock);
            document.removeEventListener("pointerdown", unlock);

            music.pause();
            thunder.pause();
            music.src = "";
            thunder.src = "";
        };
    }, []);

    return null;
}
