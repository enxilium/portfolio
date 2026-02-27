"use client";

import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import useStore from "../../../lib/store";

// How far the pillar tilts toward the camera (in radians)
const TILT_ANGLE = 0.1;
// Lerp speed for smooth animation
const LERP_SPEED = 0.02;

interface PillarAnimationProps {
    scene: THREE.Group;
}

export default function PillarAnimation({ scene }: PillarAnimationProps) {
    const pillarRightRef = useRef<THREE.Object3D | null>(null);
    const pillarRightMeshes = useRef<THREE.Mesh[]>([]);
    const baseQuatRight = useRef<THREE.Quaternion | null>(null);
    const hoveredRight = useRef(false);

    const pillarLeftRef = useRef<THREE.Object3D | null>(null);
    const pillarLeftMeshes = useRef<THREE.Mesh[]>([]);
    const baseQuatLeft = useRef<THREE.Quaternion | null>(null);
    const hoveredLeft = useRef(false);

    const pillarBackRef = useRef<THREE.Object3D | null>(null);
    const pillarBackMeshes = useRef<THREE.Mesh[]>([]);
    const baseQuatBack = useRef<THREE.Quaternion | null>(null);
    const hoveredBack = useRef(false);

    const raycaster = useRef(new THREE.Raycaster());
    const pointer = useRef(new THREE.Vector2());
    // Dirty flag — only raycast when the pointer actually moves
    const pointerDirty = useRef(false);
    const { gl } = useThree();
    const invalidate = useThree((state) => state.invalidate);
    // Track last emitted hover state to avoid spamming the store
    const lastHoverEmitted = useRef<"left" | "right" | "back" | null>(null);
    const lastFocusedEmitted = useRef<"left" | "right" | null>(null);
    const focusedPillar = useStore((s) => s.focusedPillar);

    // Find pillar objects and store base rotations
    useEffect(() => {
        scene.updateMatrixWorld(true);

        // Pillar Right
        const pillarRight = scene.getObjectByName("Pillar_Right");
        if (pillarRight) {
            pillarRightRef.current = pillarRight;
            baseQuatRight.current = pillarRight.quaternion.clone();

            const meshes: THREE.Mesh[] = [];
            pillarRight.traverse((child) => {
                if (child instanceof THREE.Mesh) meshes.push(child);
            });
            pillarRightMeshes.current = meshes;

            // Compute bounding sphere for cheap raycast pre-test
            const boxR = new THREE.Box3().setFromObject(pillarRight);
            boundRight.current = boxR.getBoundingSphere(new THREE.Sphere());
        }

        // Pillar Left
        const pillarLeft = scene.getObjectByName("Pillar_Left");
        if (pillarLeft) {
            pillarLeftRef.current = pillarLeft;
            baseQuatLeft.current = pillarLeft.quaternion.clone();

            const meshes: THREE.Mesh[] = [];
            pillarLeft.traverse((child) => {
                if (child instanceof THREE.Mesh) meshes.push(child);
            });
            pillarLeftMeshes.current = meshes;

            const boxL = new THREE.Box3().setFromObject(pillarLeft);
            boundLeft.current = boxL.getBoundingSphere(new THREE.Sphere());
        }

        // Pillar Back
        const pillarBack = scene.getObjectByName("Pillar_Back");
        if (pillarBack) {
            pillarBackRef.current = pillarBack;
            baseQuatBack.current = pillarBack.quaternion.clone();

            const meshes: THREE.Mesh[] = [];
            pillarBack.traverse((child) => {
                if (child instanceof THREE.Mesh) meshes.push(child);
            });
            pillarBackMeshes.current = meshes;

            const boxB = new THREE.Box3().setFromObject(pillarBack);
            boundBack.current = boxB.getBoundingSphere(new THREE.Sphere());
        }
    }, [scene]);

    // Mouse move handler for hover detection
    useEffect(() => {
        const canvas = gl.domElement;

        const onPointerMove = (e: PointerEvent) => {
            const rect = canvas.getBoundingClientRect();
            pointer.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            pointerDirty.current = true;
            invalidate();
        };

        canvas.addEventListener("pointermove", onPointerMove);
        return () => canvas.removeEventListener("pointermove", onPointerMove);
    }, [gl, invalidate]);

    // Click handler: focus camera on clicked pillar
    useEffect(() => {
        const canvas = gl.domElement;

        const onClick = () => {
            const store = useStore.getState();
            // Don't allow pillar interaction while content overlay is open
            if (store.contentOverlay) return;
            // Don't allow pillar focus in free-look mode
            if (store.freeView) return;
            // If already focused, clicking again returns to default view
            if (store.focusedPillar) {
                store.setFocusedPillar(null);
                return;
            }
            // Check which pillar (if any) is hovered
            if (hoveredLeft.current) {
                store.setFocusedPillar("left");
            } else if (hoveredRight.current) {
                store.setFocusedPillar("right");
            } else if (hoveredBack.current) {
                // Back pillar opens acknowledgments modal instead of focusing camera
                store.setAcknowledgmentsOpen(true);
            }
        };

        canvas.addEventListener("click", onClick);
        return () => canvas.removeEventListener("click", onClick);
    }, [gl]);

    // Pre-allocated objects — reused every frame to avoid GC pressure
    const tiltQuat = useRef(new THREE.Quaternion());
    const tiltAxis = useRef(new THREE.Vector3());
    const camWorldPos = useRef(new THREE.Vector3());
    const pillarWorldPos = useRef(new THREE.Vector3());
    const targetQuat = useRef(new THREE.Quaternion());
    // Pre-allocated up vector — reused across all three pillars (never mutated)
    const UP = useRef(new THREE.Vector3(0, 1, 0));

    // Bounding spheres for cheap raycast pre-test (computed once on mount)
    const boundRight = useRef<THREE.Sphere | null>(null);
    const boundLeft = useRef<THREE.Sphere | null>(null);
    const boundBack = useRef<THREE.Sphere | null>(null);
    // Pre-allocated ray for bounding sphere test
    const tempRay = useRef(new THREE.Ray());

    // Helper: test ray against bounding sphere before expensive mesh intersection
    const rayHitsBound = (bound: THREE.Sphere | null): boolean => {
        if (!bound) return true; // no bounds computed — fall through to mesh test
        return tempRay.current.intersectsSphere(bound);
    };

    // Check hover and animate both pillars with tilt
    useFrame((state) => {
        state.camera.getWorldPosition(camWorldPos.current);

        // ── Hover detection via raycasting ──
        // Skip entirely when a pillar is focused (camera is transitioning —
        // no hover detection needed, saves expensive ray-mesh intersection)
        const skipRaycast = !!focusedPillar;

        // Only raycast when the pointer has actually moved
        if (!skipRaycast && pointerDirty.current) {
            pointerDirty.current = false;
            raycaster.current.setFromCamera(pointer.current, state.camera);
            // Cache ray origin/direction for bounding sphere tests
            tempRay.current.copy(raycaster.current.ray);

            // Pillar Right
            const rightMeshes = pillarRightMeshes.current;
            if (rightMeshes.length > 0) {
                if (rayHitsBound(boundRight.current)) {
                    const intersects = raycaster.current.intersectObjects(
                        rightMeshes,
                        false,
                    );
                    hoveredRight.current = intersects.length > 0;
                } else {
                    hoveredRight.current = false;
                }
            }

            // Pillar Left
            const leftMeshes = pillarLeftMeshes.current;
            if (leftMeshes.length > 0) {
                if (rayHitsBound(boundLeft.current)) {
                    const intersects = raycaster.current.intersectObjects(
                        leftMeshes,
                        false,
                    );
                    hoveredLeft.current = intersects.length > 0;
                } else {
                    hoveredLeft.current = false;
                }
            }

            // Pillar Back
            const backMeshes = pillarBackMeshes.current;
            if (backMeshes.length > 0) {
                if (rayHitsBound(boundBack.current)) {
                    const intersects = raycaster.current.intersectObjects(
                        backMeshes,
                        false,
                    );
                    hoveredBack.current = intersects.length > 0;
                } else {
                    hoveredBack.current = false;
                }
            }
        }

        // ── Tilt animation (runs regardless of raycast) ──

        // Pillar Right
        const pillarR = pillarRightRef.current;
        const baseQR = baseQuatRight.current;
        if (pillarR && baseQR) {
            if (hoveredRight.current) {
                // Compute tilt axis: cross product of pillar's up and direction to camera
                pillarR.getWorldPosition(pillarWorldPos.current);
                tiltAxis.current
                    .subVectors(camWorldPos.current, pillarWorldPos.current)
                    .normalize();
                // Tilt axis is perpendicular to both the up vector and the direction to camera
                tiltAxis.current.cross(UP.current).normalize();
                tiltQuat.current.setFromAxisAngle(
                    tiltAxis.current,
                    -TILT_ANGLE,
                );
                targetQuat.current.copy(baseQR).premultiply(tiltQuat.current);
            } else {
                targetQuat.current.copy(baseQR);
            }
            pillarR.quaternion.slerp(targetQuat.current, LERP_SPEED);
        }

        // Pillar Left
        const pillarL = pillarLeftRef.current;
        const baseQL = baseQuatLeft.current;
        if (pillarL && baseQL) {
            if (hoveredLeft.current) {
                pillarL.getWorldPosition(pillarWorldPos.current);
                tiltAxis.current
                    .subVectors(camWorldPos.current, pillarWorldPos.current)
                    .normalize();
                tiltAxis.current.cross(UP.current).normalize();
                tiltQuat.current.setFromAxisAngle(
                    tiltAxis.current,
                    -TILT_ANGLE,
                );
                targetQuat.current.copy(baseQL).premultiply(tiltQuat.current);
            } else {
                targetQuat.current.copy(baseQL);
            }
            pillarL.quaternion.slerp(targetQuat.current, LERP_SPEED);
        }

        // Pillar Back
        const pillarB = pillarBackRef.current;
        const baseQB = baseQuatBack.current;
        if (pillarB && baseQB) {
            if (hoveredBack.current) {
                pillarB.getWorldPosition(pillarWorldPos.current);
                tiltAxis.current
                    .subVectors(camWorldPos.current, pillarWorldPos.current)
                    .normalize();
                tiltAxis.current.cross(UP.current).normalize();
                tiltQuat.current.setFromAxisAngle(
                    tiltAxis.current,
                    -TILT_ANGLE,
                );
                targetQuat.current.copy(baseQB).premultiply(tiltQuat.current);
            } else {
                targetQuat.current.copy(baseQB);
            }
            pillarB.quaternion.slerp(targetQuat.current, LERP_SPEED);
        }

        // ── Force hover active when pillar is focused ──
        const focused = focusedPillar;
        if (focused === "left") hoveredLeft.current = true;
        if (focused === "right") hoveredRight.current = true;

        // ── Emit hover state to the store ──
        const currentHover: "left" | "right" | "back" | null =
            hoveredLeft.current
                ? "left"
                : hoveredRight.current
                  ? "right"
                  : hoveredBack.current
                    ? "back"
                    : null;
        if (
            currentHover !== lastHoverEmitted.current ||
            focused !== lastFocusedEmitted.current
        ) {
            lastHoverEmitted.current = currentHover;
            lastFocusedEmitted.current = focused;
            useStore.getState().setHoveredPillar(currentHover);
            // Only show pointer cursor in the default view (no pillar focused, not in free-view)
            const freeView = useStore.getState().freeView;
            document.body.style.cursor =
                currentHover && !focused && !freeView ? "pointer" : "auto";
        }

        // Only keep requesting frames while pillars are actively tilting
        const isAnyHovered =
            hoveredRight.current || hoveredLeft.current || hoveredBack.current;
        const isAnyAnimating = (() => {
            const EPS = 0.0005;
            if (pillarRightRef.current && baseQuatRight.current) {
                if (
                    pillarRightRef.current.quaternion.angleTo(
                        baseQuatRight.current,
                    ) > EPS &&
                    !hoveredRight.current
                )
                    return true;
                if (hoveredRight.current) return true;
            }
            if (pillarLeftRef.current && baseQuatLeft.current) {
                if (
                    pillarLeftRef.current.quaternion.angleTo(
                        baseQuatLeft.current,
                    ) > EPS &&
                    !hoveredLeft.current
                )
                    return true;
                if (hoveredLeft.current) return true;
            }
            if (pillarBackRef.current && baseQuatBack.current) {
                if (
                    pillarBackRef.current.quaternion.angleTo(
                        baseQuatBack.current,
                    ) > EPS &&
                    !hoveredBack.current
                )
                    return true;
                if (hoveredBack.current) return true;
            }
            return false;
        })();
        if (isAnyHovered || isAnyAnimating || focusedPillar) {
            state.invalidate();
        }
    });

    return null;
}
