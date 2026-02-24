"use client";

import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

// Prefix used to find rock objects in the scene
const ROCK_PREFIX = "tyFlow_node_";
// How far rocks can be pushed (in scene units)
const REPEL_STRENGTH = 3;
// Radius around cursor that affects rocks
const REPEL_RADIUS = 30;
// How quickly rocks move away / return (lerp factor)
const MOVE_SPEED = 0.04;
// Y height of the invisible plane used for cursor projection
const PLANE_Y = 5.8;
// Oscillation amplitude (scene units) — how far rocks drift
const DRIFT_AMPLITUDE = 0.3;
// Oscillation speed — lower = slower, dreamier
const DRIFT_SPEED = 0.4;

interface RockData {
    object: THREE.Object3D;
    basePosition: THREE.Vector3;
    // Per-rock random phase offsets for X, Y, Z oscillation
    phaseX: number;
    phaseY: number;
    phaseZ: number;
    // Per-rock random speed multiplier for variation
    speedMul: number;
}

interface RockAnimationProps {
    scene: THREE.Group;
}

export default function RockAnimation({ scene }: RockAnimationProps) {
    const rocks = useRef<RockData[]>([]);
    const pointer = useRef(new THREE.Vector2());
    const { gl } = useThree();
    const invalidate = useThree((state) => state.invalidate);

    // Pre-allocated objects — reused every frame to avoid GC pressure
    const raycaster = useRef(new THREE.Raycaster());
    const groundPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -PLANE_Y));
    const cursorWorldPos = useRef(new THREE.Vector3());
    const tempVec = useRef(new THREE.Vector3());
    const targetPos = useRef(new THREE.Vector3());

    // Collect all rock objects on mount
    useEffect(() => {
        scene.updateMatrixWorld(true);
        const collected: RockData[] = [];

        scene.traverse((child) => {
            if (child.name.startsWith(ROCK_PREFIX)) {
                collected.push({
                    object: child,
                    basePosition: child.position.clone(),
                    phaseX: Math.random() * Math.PI * 2,
                    phaseY: Math.random() * Math.PI * 2,
                    phaseZ: Math.random() * Math.PI * 2,
                    speedMul: 0.7 + Math.random() * 0.6,
                });
            }
        });

        rocks.current = collected;
        console.log(`RockAnimation: found ${collected.length} rocks`);
    }, [scene]);

    // Track pointer position
    useEffect(() => {
        const canvas = gl.domElement;

        const onPointerMove = (e: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            pointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            invalidate();
        };

        canvas.addEventListener("pointermove", onPointerMove);
        return () => canvas.removeEventListener("pointermove", onPointerMove);
    }, [gl, invalidate]);

    useFrame((state) => {
        const allRocks = rocks.current;
        if (allRocks.length === 0) return;

        const time = state.clock.getElapsedTime();

        // Project cursor onto horizontal plane at PLANE_Y
        raycaster.current.setFromCamera(pointer.current, state.camera);
        const hit = raycaster.current.ray.intersectPlane(
            groundPlane.current,
            cursorWorldPos.current,
        );

        for (let i = 0; i < allRocks.length; i++) {
            const rock = allRocks[i];
            const { object, basePosition, phaseX, phaseY, phaseZ, speedMul } = rock;

            // Compute oscillating drift offset
            const t = time * DRIFT_SPEED * speedMul;
            const driftX = Math.sin(t + phaseX) * DRIFT_AMPLITUDE;
            const driftY = Math.sin(t * 0.7 + phaseY) * DRIFT_AMPLITUDE * 0.5;
            const driftZ = Math.cos(t * 0.8 + phaseZ) * DRIFT_AMPLITUDE;

            // Drifted base position
            targetPos.current.set(
                basePosition.x + driftX,
                basePosition.y + driftY,
                basePosition.z + driftZ,
            );

            if (hit) {
                // Distance from drifted position to cursor
                tempVec.current.subVectors(targetPos.current, cursorWorldPos.current);
                const dist = tempVec.current.length();

                if (dist < REPEL_RADIUS && dist > 0.001) {
                    const falloff = 1 - dist / REPEL_RADIUS;
                    const pushDist = REPEL_STRENGTH * falloff * falloff;

                    tempVec.current.normalize();
                    targetPos.current.addScaledVector(tempVec.current, pushDist);
                }
            }

            object.position.lerp(targetPos.current, MOVE_SPEED);
        }

        state.invalidate();
    });

    return null;
}
