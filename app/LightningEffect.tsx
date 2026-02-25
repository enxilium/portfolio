"use client";

import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import useStore from "./store";

// ── Flash light ──
// Point light placed high in the scene for ambient illumination flash
const FLASH_PEAK_INTENSITY = 1200;
const LIGHT_Y = 55;
// Light spawns within this XZ range
const LIGHT_X_RANGE = 80;
const LIGHT_Z_RANGE = 80;
// Flash phases (seconds)
const RAMP_UP = 0.04;
const HOLD = 0.08;
const DECAY = 0.2;
const FLASH_DURATION = RAMP_UP + HOLD + DECAY;

// ── Timing ──
const MIN_INTERVAL = 2;
const MAX_INTERVAL = 8;
const DOUBLE_FLASH_CHANCE = 0.35;
const DOUBLE_GAP = 0.12;

function getFlashIntensity(t: number): number {
    if (t < RAMP_UP) {
        return (t / RAMP_UP) * FLASH_PEAK_INTENSITY;
    } else if (t < RAMP_UP + HOLD) {
        return FLASH_PEAK_INTENSITY;
    } else {
        const decayT = (t - RAMP_UP - HOLD) / DECAY;
        return FLASH_PEAK_INTENSITY * Math.max(0, 1 - decayT);
    }
}

export default function LightningEffect() {
    const scene = useThree((s) => s.scene);
    const invalidate = useThree((s) => s.invalidate);

    const isRainingRef = useRef(useStore.getState().isRaining);
    useEffect(() => {
        const unsub = useStore.subscribe((state) => {
            isRainingRef.current = state.isRaining;
            invalidate();
        });
        return unsub;
    }, [invalidate]);

    // Point light for scene illumination during flash (no visible bolt)
    const lightRef = useRef<THREE.PointLight | null>(null);

    // Flash state
    const countdown = useRef(
        MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL),
    );
    const flashTime = useRef(-1);
    const isDoubleFlash = useRef(false);
    const secondFlashFired = useRef(false);

    // Create point light on mount
    useEffect(() => {
        const light = new THREE.PointLight("#c8d8ff", 0, 200, 1.5);
        light.position.set(0, LIGHT_Y, 0);
        scene.add(light);
        lightRef.current = light;

        return () => {
            scene.remove(light);
            light.dispose();
        };
    }, [scene]);

    // Reposition light randomly for each flash
    const repositionLight = () => {
        if (lightRef.current) {
            lightRef.current.position.set(
                (Math.random() - 0.5) * LIGHT_X_RANGE,
                LIGHT_Y,
                (Math.random() - 0.5) * LIGHT_Z_RANGE,
            );
        }
    };

    useFrame((_, delta) => {
        const light = lightRef.current;
        if (!light) return;

        if (!isRainingRef.current) {
            // No rain — reset
            light.intensity = THREE.MathUtils.lerp(light.intensity, 0, 0.1);
            flashTime.current = -1;
            countdown.current =
                MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
            if (light.intensity > 0.1) invalidate();
            return;
        }

        if (flashTime.current >= 0) {
            flashTime.current += delta;
            const ft = flashTime.current;
            let intensity = 0;

            if (ft < FLASH_DURATION) {
                intensity = getFlashIntensity(ft);
            } else if (
                isDoubleFlash.current &&
                !secondFlashFired.current &&
                ft < FLASH_DURATION + DOUBLE_GAP
            ) {
                // Gap between flashes
                intensity = 0;
            } else if (isDoubleFlash.current && !secondFlashFired.current) {
                // Start second flash at new position
                secondFlashFired.current = true;
                repositionLight();
                flashTime.current = FLASH_DURATION + DOUBLE_GAP;
                intensity = 0;
            } else if (isDoubleFlash.current && secondFlashFired.current) {
                const ft2 = ft - FLASH_DURATION - DOUBLE_GAP;
                if (ft2 < FLASH_DURATION) {
                    intensity = getFlashIntensity(ft2) * 0.6;
                } else {
                    flashTime.current = -1;
                    countdown.current =
                        MIN_INTERVAL +
                        Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
                    intensity = 0;
                }
            } else {
                // Single flash done
                flashTime.current = -1;
                countdown.current =
                    MIN_INTERVAL +
                    Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
                intensity = 0;
            }

            light.intensity = intensity;
            invalidate();
        } else {
            // Countdown to next flash
            countdown.current -= delta;
            if (countdown.current <= 0) {
                flashTime.current = 0;
                isDoubleFlash.current = Math.random() < DOUBLE_FLASH_CHANCE;
                secondFlashFired.current = false;
                repositionLight();
            }
            if (light.intensity > 0) {
                light.intensity = 0;
                invalidate();
            }
        }
    });

    return null;
}
