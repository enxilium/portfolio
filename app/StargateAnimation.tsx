"use client";

import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import useStore from "./store";

// Base rotation speed in radians per second
const BASE_ROTATION_SPEED = 0.1;
// Max rotation speed at full activation
const MAX_ROTATION_SPEED = 6.0;

interface StargateAnimationProps {
    scene: THREE.Group;
}

export default function StargateAnimation({ scene }: StargateAnimationProps) {
    const stargate1 = useRef<THREE.Object3D | null>(null);
    const stargate2 = useRef<THREE.Object3D | null>(null);
    const invalidate = useThree((state) => state.invalidate);

    // Read activation progress via ref to avoid re-renders in useFrame
    const activationRef = useRef(0);
    useEffect(() => {
        const unsub = useStore.subscribe((state) => {
            activationRef.current = state.activationProgress;
            invalidate();
        });
        return unsub;
    }, [invalidate]);

    // Pre-allocated rotation axis — stargates face along world Z so we spin around that
    const worldZAxis = useRef(new THREE.Vector3(0, 0, 1));

    useEffect(() => {
        scene.updateMatrixWorld(true);

        // Find stargate Groups by name — can't use getObjectByName because
        // child meshes share names like "Stargate_2", causing false matches.
        let sg1: THREE.Object3D | null = null;
        let sg2: THREE.Object3D | null = null;

        scene.traverse((child) => {
            if (child.name === "Stargate_1" && child.type === "Group") {
                sg1 = child;
            }
            if (child.name === "Stargate_2" && child.type === "Group") {
                sg2 = child;
            }
        });

        if (sg1) stargate1.current = sg1;
        if (sg2) stargate2.current = sg2;
    }, [scene]);

    useFrame((_, delta) => {
        const sg1 = stargate1.current;
        const sg2 = stargate2.current;

        // Blend between base speed and max speed based on activation progress
        const activation = activationRef.current;
        const speed =
            BASE_ROTATION_SPEED +
            activation * (MAX_ROTATION_SPEED - BASE_ROTATION_SPEED);

        if (sg1) sg1.rotateOnWorldAxis(worldZAxis.current, speed * delta);
        if (sg2) sg2.rotateOnWorldAxis(worldZAxis.current, -speed * delta);

        invalidate();
    });

    return null;
}
