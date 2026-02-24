"use client";

import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

// Rotation speed in radians per second
const ROTATION_SPEED = 0.1;

interface StargateAnimationProps {
    scene: THREE.Group;
}

export default function StargateAnimation({ scene }: StargateAnimationProps) {
    const stargate1 = useRef<THREE.Object3D | null>(null);
    const stargate2 = useRef<THREE.Object3D | null>(null);
    const invalidate = useThree((state) => state.invalidate);

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

        console.log("StargateAnimation: sg1:", sg1?.name, "id:", (sg1 as THREE.Object3D | null)?.id);
        console.log("StargateAnimation: sg2:", sg2?.name, "id:", (sg2 as THREE.Object3D | null)?.id);

        if (sg1) stargate1.current = sg1;
        if (sg2) stargate2.current = sg2;
    }, [scene]);

    useFrame((_, delta) => {
        const sg1 = stargate1.current;
        const sg2 = stargate2.current;

        if (sg1) sg1.rotateOnWorldAxis(worldZAxis.current, ROTATION_SPEED * delta);
        if (sg2) sg2.rotateOnWorldAxis(worldZAxis.current, -ROTATION_SPEED * delta);

        invalidate();
    });

    return null;
}
