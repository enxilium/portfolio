"use client";

import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import useStore from "../../../lib/store";

const isDev = process.env.NODE_ENV === "development";

// Prefix used to find rock objects in the scene
const ROCK_PREFIX = "tyFlow_node_";
// Radius around cursor that affects rocks (in NDC units; 1.0 = half the screen)
const REPEL_RADIUS = 0.6;
// How quickly rocks move away / return (lerp factor)
const MOVE_SPEED = 0.04;
// Oscillation amplitude (scene units) — how far rocks drift
const DRIFT_AMPLITUDE = 0.3;

// ── Free-view (3D) mode constants ──
// Y height of the invisible plane used for cursor projection in 3D mode
const PLANE_Y = 5.8;
// Repel radius in world units for 3D mode
const REPEL_RADIUS_3D = 30;
// Repel strength in world units for 3D mode
const REPEL_STRENGTH_3D = 3;

// Per-instance animation data (world-space transforms)
interface InstanceData {
    basePosition: THREE.Vector3;
    currentPosition: THREE.Vector3;
    quaternion: THREE.Quaternion;
    scale: THREE.Vector3;
    phaseX: number;
    phaseY: number;
    phaseZ: number;
    speedMul: number;
}

// A group of rocks sharing the same geometry + material, rendered as one draw call
interface InstanceGroup {
    mesh: THREE.InstancedMesh;
    instances: InstanceData[];
}

interface RockAnimationProps {
    scene: THREE.Group;
}

export default function RockAnimation({ scene }: RockAnimationProps) {
    const groups = useRef<InstanceGroup[]>([]);
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
    // Reusable matrix for composing instance transforms
    const tempMatrix = useRef(new THREE.Matrix4());

    // ── Build instanced meshes from scene rocks ──
    useEffect(() => {
        scene.updateMatrixWorld(true);

        // Collect all rock Mesh objects from the scene
        const rockMeshes: THREE.Mesh[] = [];
        scene.traverse((child) => {
            if (
                child.name.startsWith(ROCK_PREFIX) &&
                (child as THREE.Mesh).isMesh
            ) {
                rockMeshes.push(child as THREE.Mesh);
            }
        });

        if (rockMeshes.length === 0) return;

        // Group rocks by shared geometry + material so each group becomes one draw call.
        // tyFlow exports typically share a single geometry/material across all particles.
        const groupMap = new Map<string, THREE.Mesh[]>();
        for (const mesh of rockMeshes) {
            const matKey = Array.isArray(mesh.material)
                ? mesh.material.map((m) => m.uuid).join(",")
                : mesh.material.uuid;
            const key = `${mesh.geometry.uuid}__${matKey}`;
            let arr = groupMap.get(key);
            if (!arr) {
                arr = [];
                groupMap.set(key, arr);
            }
            arr.push(mesh);
        }

        const newGroups: InstanceGroup[] = [];

        for (const [, meshes] of groupMap) {
            const template = meshes[0];
            const count = meshes.length;

            const instancedMesh = new THREE.InstancedMesh(
                template.geometry,
                template.material,
                count,
            );
            // Rocks are spread across the scene — skip per-instance frustum culling
            instancedMesh.frustumCulled = false;

            const instances: InstanceData[] = [];

            for (let i = 0; i < count; i++) {
                const mesh = meshes[i];

                // Decompose world transform for world-space instancing
                const worldPos = new THREE.Vector3();
                const worldQuat = new THREE.Quaternion();
                const worldScale = new THREE.Vector3();
                mesh.matrixWorld.decompose(worldPos, worldQuat, worldScale);

                instances.push({
                    basePosition: worldPos.clone(),
                    currentPosition: worldPos.clone(),
                    quaternion: worldQuat,
                    scale: worldScale,
                    phaseX: Math.random() * Math.PI * 2,
                    phaseY: Math.random() * Math.PI * 2,
                    phaseZ: Math.random() * Math.PI * 2,
                    speedMul: 0.7 + Math.random() * 0.6,
                });

                // Set initial instance matrix
                tempMatrix.current.compose(worldPos, worldQuat, worldScale);
                instancedMesh.setMatrixAt(i, tempMatrix.current);

                // Hide the original mesh — it's now represented by the instance
                mesh.visible = false;
            }

            instancedMesh.instanceMatrix.needsUpdate = true;
            scene.add(instancedMesh);

            newGroups.push({ mesh: instancedMesh, instances });
        }

        groups.current = newGroups;
        invalidate();

        // Cleanup: remove instanced meshes and restore original visibility
        return () => {
            for (const group of newGroups) {
                group.mesh.removeFromParent();
                group.mesh.dispose();
            }
            for (const mesh of rockMeshes) {
                mesh.visible = true;
            }
            groups.current = [];
        };
    }, [scene, invalidate]);

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
        const allGroups = groups.current;
        if (allGroups.length === 0) return;

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

        for (let g = 0; g < allGroups.length; g++) {
            const { mesh, instances } = allGroups[g];

            for (let i = 0; i < instances.length; i++) {
                const inst = instances[i];
                const {
                    basePosition,
                    currentPosition,
                    quaternion,
                    scale,
                    phaseX,
                    phaseY,
                    phaseZ,
                    speedMul,
                } = inst;

                // Compute oscillating drift offset
                const t = time * driftSpeedRef.current * speedMul;
                const driftX = Math.sin(t + phaseX) * DRIFT_AMPLITUDE;
                const driftY =
                    Math.sin(t * 0.7 + phaseY) * DRIFT_AMPLITUDE * 0.5;
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
                        const pushDist =
                            repelStrengthRef.current * falloff * falloff;

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

                // Smooth lerp toward target
                currentPosition.lerp(targetPos.current, MOVE_SPEED);

                // Compose world-space matrix and write to the instance buffer
                tempMatrix.current.compose(currentPosition, quaternion, scale);
                mesh.setMatrixAt(i, tempMatrix.current);
            }

            mesh.instanceMatrix.needsUpdate = true;
        }

        // Rocks are always drifting — keep requesting frames.
        // (The drift is the primary visual animation; stopping it would be noticeable.)
        state.invalidate();
    });

    return null;
}
