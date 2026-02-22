"use client";

import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

// How far the pillar rises (in scene units)
const RISE_DISTANCE = 1.5;
// Lerp speed for smooth animation
const LERP_SPEED = 0.05;

interface PillarAnimationProps {
    scene: THREE.Group;
}

export default function PillarAnimation({ scene }: PillarAnimationProps) {
    const pillarRightRef = useRef<THREE.Object3D | null>(null);
    const pillarRightMeshes = useRef<THREE.Mesh[]>([]);
    const basePositionRight = useRef<THREE.Vector3 | null>(null);
    const riseDirectionRight = useRef<THREE.Vector3 | null>(null);
    const hoveredRight = useRef(false);

    const pillarLeftRef = useRef<THREE.Object3D | null>(null);
    const pillarLeftMeshes = useRef<THREE.Mesh[]>([]);
    const basePositionLeft = useRef<THREE.Vector3 | null>(null);
    const riseDirectionLeft = useRef<THREE.Vector3 | null>(null);
    const hoveredLeft = useRef(false);

    const raycaster = useRef(new THREE.Raycaster());
    const pointer = useRef(new THREE.Vector2());
    const { gl } = useThree();

    // Find pillar objects and compute rise directions
    useEffect(() => {
        scene.updateMatrixWorld(true);

        // Pillar Right
        const pillarRight = scene.getObjectByName("Pillar_Right");
        if (pillarRight) {
            pillarRightRef.current = pillarRight;
            basePositionRight.current = pillarRight.position.clone();

            const worldQuat = new THREE.Quaternion();
            pillarRight.getWorldQuaternion(worldQuat);
            const axis = new THREE.Vector3(0, 1, 0);
            axis.applyQuaternion(worldQuat).normalize();
            riseDirectionRight.current = axis;

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
            basePositionLeft.current = pillarLeft.position.clone();

            const worldQuat = new THREE.Quaternion();
            pillarLeft.getWorldQuaternion(worldQuat);
            const axis = new THREE.Vector3(0, 1, 0);
            axis.applyQuaternion(worldQuat).normalize();
            riseDirectionLeft.current = axis;

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
        };

        canvas.addEventListener("pointermove", onPointerMove);
        return () => canvas.removeEventListener("pointermove", onPointerMove);
    }, [gl]);

    // Check hover and animate both pillars
    useFrame((state) => {
        raycaster.current.setFromCamera(pointer.current, state.camera);

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
        const basePosR = basePositionRight.current;
        const dirR = riseDirectionRight.current;
        if (pillarR && basePosR && dirR) {
            const targetPos = hoveredRight.current
                ? basePosR
                      .clone()
                      .add(dirR.clone().multiplyScalar(RISE_DISTANCE))
                : basePosR;
            pillarR.position.lerp(targetPos, LERP_SPEED);
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
        const basePosL = basePositionLeft.current;
        const dirL = riseDirectionLeft.current;
        if (pillarL && basePosL && dirL) {
            const targetPos = hoveredLeft.current
                ? basePosL
                      .clone()
                      .add(dirL.clone().multiplyScalar(RISE_DISTANCE))
                : basePosL;
            pillarL.position.lerp(targetPos, LERP_SPEED);
        }
    });

    return null;
}
