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

    const raycaster = useRef(new THREE.Raycaster());
    const pointer = useRef(new THREE.Vector2());
    const { gl } = useThree();
    const invalidate = useThree((state) => state.invalidate);
    // Track last emitted hover state to avoid spamming the store
    const lastHoverEmitted = useRef<"left" | "right" | null>(null);
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
        }
    }, [scene]);

    // Mouse move handler for hover detection
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

    // Click handler: focus camera on clicked pillar
    useEffect(() => {
        const canvas = gl.domElement;

        const onClick = () => {
            // If already focused, clicking again returns to default view
            const store = useStore.getState();
            if (store.focusedPillar) {
                store.setFocusedPillar(null);
                return;
            }
            // Check which pillar (if any) is hovered
            if (hoveredLeft.current) {
                store.setFocusedPillar("left");
            } else if (hoveredRight.current) {
                store.setFocusedPillar("right");
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

    // Check hover and animate both pillars with tilt
    useFrame((state) => {
        raycaster.current.setFromCamera(pointer.current, state.camera);
        state.camera.getWorldPosition(camWorldPos.current);

        // Pillar Right
        const rightMeshes = pillarRightMeshes.current;
        if (rightMeshes.length > 0) {
            const intersects = raycaster.current.intersectObjects(
                rightMeshes,
                false,
            );
            hoveredRight.current = intersects.length > 0;
        }

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
                tiltAxis.current.cross(new THREE.Vector3(0, 1, 0)).normalize();
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
        const leftMeshes = pillarLeftMeshes.current;
        if (leftMeshes.length > 0) {
            const intersects = raycaster.current.intersectObjects(
                leftMeshes,
                false,
            );
            hoveredLeft.current = intersects.length > 0;
        }

        const pillarL = pillarLeftRef.current;
        const baseQL = baseQuatLeft.current;
        if (pillarL && baseQL) {
            if (hoveredLeft.current) {
                pillarL.getWorldPosition(pillarWorldPos.current);
                tiltAxis.current
                    .subVectors(camWorldPos.current, pillarWorldPos.current)
                    .normalize();
                tiltAxis.current.cross(new THREE.Vector3(0, 1, 0)).normalize();
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

        // ── Force hover active when pillar is focused ──
        const focused = focusedPillar;
        if (focused === "left") hoveredLeft.current = true;
        if (focused === "right") hoveredRight.current = true;

        // ── Emit hover state to the store ──
        const currentHover: "left" | "right" | null = hoveredLeft.current
            ? "left"
            : hoveredRight.current
              ? "right"
              : null;
        if (currentHover !== lastHoverEmitted.current) {
            lastHoverEmitted.current = currentHover;
            useStore.getState().setHoveredPillar(currentHover);
            document.body.style.cursor = currentHover ? "pointer" : "auto";
        }

        // Invalidate to request next frame (demand mode)
        state.invalidate();
    });

    return null;
}
