"use client";

import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame, useThree, useLoader } from "@react-three/fiber";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import useStore from "../../../lib/store";

// ── Day preset ──
const DAY_AMBIENT_INTENSITY = 0.1;
const DAY_AMBIENT_COLOR = new THREE.Color("#ffffff");
const DAY_SPOT_INTENSITY = 1200;
const DAY_FOG_COLOR = new THREE.Color("#e0dad5");
const DAY_FOG_NEAR = 40;
const DAY_FOG_FAR = 120;
const DAY_ENV_INTENSITY = 0.1;
const DAY_MOON_INTENSITY = 0;
const DAY_BLOOM_INTENSITY = 1.2;
const DAY_BG_INTENSITY = 1.0;

// ── Night preset ──
const NIGHT_AMBIENT_INTENSITY = 0.25;
const NIGHT_AMBIENT_COLOR = new THREE.Color("#3a3a80");
const NIGHT_SPOT_INTENSITY = 250;
const NIGHT_FOG_COLOR = new THREE.Color("#272831");
const NIGHT_FOG_NEAR = 20;
const NIGHT_FOG_FAR = 120;
const NIGHT_ENV_INTENSITY = 0.03;
const NIGHT_MOON_INTENSITY = 1.8;
const NIGHT_BLOOM_INTENSITY = 1.8;
const NIGHT_BG_INTENSITY = 1.0;

// Lerp speed — roughly 2.5s full transition at 60fps (factor per frame)
const LERP_SPEED = 0.03;
// Threshold below which we consider backgroundIntensity "at zero" and swap textures
const BG_SWAP_THRESHOLD = 0.02;

interface DayNightControllerProps {
    ambientRef: React.RefObject<THREE.AmbientLight | null>;
    spotRef: React.RefObject<THREE.SpotLight | null>;
    fogRef: React.RefObject<THREE.Fog | null>;
    bloomIntensityRef: React.MutableRefObject<number>;
}

export default function DayNightController({
    ambientRef,
    spotRef,
    fogRef,
    bloomIntensityRef,
}: DayNightControllerProps) {
    const scene = useThree((s) => s.scene);
    const invalidate = useThree((s) => s.invalidate);

    // Load both HDR textures
    const dayHDR = useLoader(RGBELoader, "/overcast_soil_puresky_4k.hdr");
    const nightHDR = useLoader(
        RGBELoader,
        "/overcast_soil_puresky_4k-night.hdr",
    );

    // Prepare textures on mount
    useEffect(() => {
        dayHDR.mapping = THREE.EquirectangularReflectionMapping;
        nightHDR.mapping = THREE.EquirectangularReflectionMapping;
    }, [dayHDR, nightHDR]);

    // Moonlight — added imperatively
    const moonLight = useRef<THREE.DirectionalLight | null>(null);
    // Stars group visibility factor (0 = hidden, 1 = visible)
    const starsOpacity = useRef(0);
    // Current backgroundIntensity (smoothed each frame)
    const bgIntensity = useRef(DAY_BG_INTENSITY);
    // Which HDR is currently set as scene.background ("day" | "night")
    const currentBg = useRef<"day" | "night">("day");
    // Whether we're in the middle of a crossfade (fading down to swap)
    const crossfading = useRef(false);

    // Track isNight via ref to avoid useFrame closure issues
    const isNightRef = useRef(useStore.getState().isNight);
    useEffect(() => {
        const unsub = useStore.subscribe((state) => {
            isNightRef.current = state.isNight;
            invalidate();
        });
        return unsub;
    }, [invalidate]);

    // Create moonlight on mount
    useEffect(() => {
        const moon = new THREE.DirectionalLight("#b0c4de", 0);
        moon.position.set(-30, 25, 15);
        moon.target.position.set(0, 0, 0);
        scene.add(moon);
        scene.add(moon.target);
        moonLight.current = moon;

        return () => {
            scene.remove(moon);
            scene.remove(moon.target);
            moon.dispose();
        };
    }, [scene]);

    useFrame(() => {
        const night = isNightRef.current;
        const t = LERP_SPEED; // lerp factor per frame

        // ── Ambient light ──
        const ambient = ambientRef.current;
        if (ambient) {
            const targetIntensity = night
                ? NIGHT_AMBIENT_INTENSITY
                : DAY_AMBIENT_INTENSITY;
            ambient.intensity = THREE.MathUtils.lerp(
                ambient.intensity,
                targetIntensity,
                t,
            );
            const targetColor = night ? NIGHT_AMBIENT_COLOR : DAY_AMBIENT_COLOR;
            ambient.color.lerp(targetColor, t);
        }

        // ── Spot light ──
        const spot = spotRef.current;
        if (spot) {
            const targetIntensity = night
                ? NIGHT_SPOT_INTENSITY
                : DAY_SPOT_INTENSITY;
            spot.intensity = THREE.MathUtils.lerp(
                spot.intensity,
                targetIntensity,
                t,
            );
        }

        // ── Fog ──
        const fog = fogRef.current;
        if (fog) {
            const targetColor = night ? NIGHT_FOG_COLOR : DAY_FOG_COLOR;
            fog.color.lerp(targetColor, t);
            const targetNear = night ? NIGHT_FOG_NEAR : DAY_FOG_NEAR;
            const targetFar = night ? NIGHT_FOG_FAR : DAY_FOG_FAR;
            fog.near = THREE.MathUtils.lerp(fog.near, targetNear, t);
            fog.far = THREE.MathUtils.lerp(fog.far, targetFar, t);
        }

        // ── Moonlight ──
        const moon = moonLight.current;
        if (moon) {
            const targetIntensity = night
                ? NIGHT_MOON_INTENSITY
                : DAY_MOON_INTENSITY;
            moon.intensity = THREE.MathUtils.lerp(
                moon.intensity,
                targetIntensity,
                t,
            );
        }

        // ── Background / environment HDR crossfade ──
        const wantBg = night ? "night" : "day";
        const bgScene = scene as unknown as {
            backgroundIntensity: number;
            environmentIntensity: number;
        };

        if (wantBg !== currentBg.current) {
            // We need to swap — first fade intensity down
            crossfading.current = true;
            bgIntensity.current = THREE.MathUtils.lerp(
                bgIntensity.current,
                0,
                t,
            );
            bgScene.backgroundIntensity = bgIntensity.current;

            // Once near zero, swap the texture
            if (bgIntensity.current < BG_SWAP_THRESHOLD) {
                const tex = wantBg === "night" ? nightHDR : dayHDR;
                scene.background = tex;
                scene.environment = tex;
                currentBg.current = wantBg;
                crossfading.current = false;
            }
        } else {
            // We're on the right texture — fade intensity up to target
            const targetBgI = night ? NIGHT_BG_INTENSITY : DAY_BG_INTENSITY;
            bgIntensity.current = THREE.MathUtils.lerp(
                bgIntensity.current,
                targetBgI,
                t,
            );
            bgScene.backgroundIntensity = bgIntensity.current;
        }

        // ── Environment intensity ──
        const targetEnv = night ? NIGHT_ENV_INTENSITY : DAY_ENV_INTENSITY;
        bgScene.environmentIntensity = THREE.MathUtils.lerp(
            bgScene.environmentIntensity,
            targetEnv,
            t,
        );

        // ── Bloom intensity (communicated via ref) ──
        const targetBloom = night ? NIGHT_BLOOM_INTENSITY : DAY_BLOOM_INTENSITY;
        bloomIntensityRef.current = THREE.MathUtils.lerp(
            bloomIntensityRef.current,
            targetBloom,
            t,
        );

        // ── Stars opacity (communicated via scene userData) ──
        const targetStars = night ? 1 : 0;
        starsOpacity.current = THREE.MathUtils.lerp(
            starsOpacity.current,
            targetStars,
            t,
        );
        scene.userData.starsOpacity = starsOpacity.current;

        invalidate();
    });

    return null;
}
