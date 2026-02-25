"use client";

import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import useStore from "./store";

const isDev = process.env.NODE_ENV === "development";

// Prefix used to find rock objects in the scene
const ROCK_PREFIX = "tyFlow_node_";
// Default repel strength — overridden by store
// const REPEL_STRENGTH = 1;
// Radius around cursor that affects rocks (in NDC units; 1.0 = half the screen)
const REPEL_RADIUS = 0.6;
// How quickly rocks move away / return (lerp factor)
const MOVE_SPEED = 0.04;
// Oscillation amplitude (scene units) — how far rocks drift
const DRIFT_AMPLITUDE = 0.3;
// Default drift speed — overridden by store
// const DRIFT_SPEED = 0.4;

// ── Free-view (3D) mode constants ──
// Y height of the invisible plane used for cursor projection in 3D mode
const PLANE_Y = 5.8;
// Repel radius in world units for 3D mode
const REPEL_RADIUS_3D = 30;
// Repel strength in world units for 3D mode
const REPEL_STRENGTH_3D = 3;

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

    // Read from Zustand store via refs to avoid re-renders in useFrame
    const driftSpeedRef = useRef(useStore.getState().driftSpeed);
    const repelStrengthRef = useRef(useStore.getState().repelStrength);
    useEffect(() => {
        const unsub = useStore.subscribe((state) => {
            driftSpeedRef.current = state.driftSpeed;
            repelStrengthRef.current = state.repelStrength;
            invalidate();
        });
        return unsub;
    }, [invalidate]);

    // Track free-view mode (dev only, mirrors CameraController's F key toggle)
    const freeView = useRef(false);
    useEffect(() => {
        if (!isDev) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "f" || e.key === "F") {
                freeView.current = !freeView.current;
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Pre-allocated objects — reused every frame to avoid GC pressure
    const raycaster = useRef(new THREE.Raycaster());
    const targetPos = useRef(new THREE.Vector3());
    // Screen-space projection of each rock
    const projected = useRef(new THREE.Vector3());
    // Camera basis vectors for converting screen push to world push
    const camRight = useRef(new THREE.Vector3());
    const camUp = useRef(new THREE.Vector3());
    const camForward = useRef(new THREE.Vector3());
    // 3D mode: plane intersection and temp vector
    const groundPlane = useRef(
        new THREE.Plane(new THREE.Vector3(0, 1, 0), -PLANE_Y),
    );
    const cursorWorldPos = useRef(new THREE.Vector3());
    const tempVec = useRef(new THREE.Vector3());

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
        const cam = state.camera;

        // Extract camera basis for converting screen-space push to world space
        cam.matrixWorld.extractBasis(
            camRight.current,
            camUp.current,
            camForward.current,
        );

        // Build cursor ray
        raycaster.current.setFromCamera(pointer.current, cam);

        // In free-view mode, project cursor onto a horizontal plane for 3D repulsion
        let hit3D: THREE.Vector3 | null = null;
        if (freeView.current) {
            hit3D = raycaster.current.ray.intersectPlane(
                groundPlane.current,
                cursorWorldPos.current,
            );
        }

        for (let i = 0; i < allRocks.length; i++) {
            const rock = allRocks[i];
            const { object, basePosition, phaseX, phaseY, phaseZ, speedMul } =
                rock;

            // Compute oscillating drift offset
            const t = time * driftSpeedRef.current * speedMul;
            const driftX = Math.sin(t + phaseX) * DRIFT_AMPLITUDE;
            const driftY = Math.sin(t * 0.7 + phaseY) * DRIFT_AMPLITUDE * 0.5;
            const driftZ = Math.cos(t * 0.8 + phaseZ) * DRIFT_AMPLITUDE;

            // Drifted base position
            targetPos.current.set(
                basePosition.x + driftX,
                basePosition.y + driftY,
                basePosition.z + driftZ,
            );

            if (freeView.current) {
                // ── Free-view: full 3D world-space repulsion ──
                if (hit3D) {
                    tempVec.current.subVectors(
                        targetPos.current,
                        cursorWorldPos.current,
                    );
                    const dist = tempVec.current.length();

                    if (dist < REPEL_RADIUS_3D && dist > 0.001) {
                        const falloff = 1 - dist / REPEL_RADIUS_3D;
                        const pushDist =
                            REPEL_STRENGTH_3D * falloff * falloff;

                        tempVec.current.normalize();
                        targetPos.current.addScaledVector(
                            tempVec.current,
                            pushDist,
                        );
                    }
                }
            } else {
                // ── Default view: screen-space (NDC) repulsion ──
                projected.current.copy(targetPos.current).project(cam);
                const dx = projected.current.x - pointer.current.x;
                const dy = projected.current.y - pointer.current.y;
                const screenDist = Math.sqrt(dx * dx + dy * dy);

                if (screenDist < REPEL_RADIUS && screenDist > 0.001) {
                    const falloff = 1 - screenDist / REPEL_RADIUS;
                    const pushDist = repelStrengthRef.current * falloff * falloff;

                    // Normalize screen direction and convert to world push
                    const invDist = 1 / screenDist;
                    const ndx = dx * invDist;
                    const ndy = dy * invDist;

                    targetPos.current.addScaledVector(
                        camRight.current,
                        ndx * pushDist,
                    );
                    targetPos.current.addScaledVector(
                        camUp.current,
                        ndy * pushDist,
                    );
                }
            }

            object.position.lerp(targetPos.current, MOVE_SPEED);
        }

        state.invalidate();
    });

    return null;
}
