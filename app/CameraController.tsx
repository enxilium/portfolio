"use client";

import * as THREE from "three";
import { useEffect, useRef, useState } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

const isDev = process.env.NODE_ENV === "development";

// Max rotation offset (radians) for mouse-follow panning
const PAN_AMOUNT = 0.03;
// Zoom range: 0 = base (most zoomed out), 1 = most zoomed in
const ZOOM_IN_FOV_FACTOR = 0.6; // zoomed-in FOV = baseFOV * this factor
const PAN_ZOOM_MULTIPLIER = 3; // at max zoom, pan amount is multiplied by this

interface BaseState {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    fov: number;
    target: THREE.Vector3;
}

interface CameraControllerProps {
    cameras: THREE.Camera[];
    scene: THREE.Group;
}

export default function CameraController({
    cameras,
    scene,
}: CameraControllerProps) {
    const { size } = useThree();
    const threeCamera = useThree((state) => state.camera);
    const cameraRef = useRef(threeCamera);

    useEffect(() => {
        cameraRef.current = threeCamera;
    }, [threeCamera]);
    const controlsRef = useRef<OrbitControlsImpl>(null);

    const [freeView, setFreeView] = useState(false);

    // Store base camera state from Blender
    const baseState = useRef<BaseState | null>(null);

    // Mouse position normalized to [-1, 1]
    const mouse = useRef({ x: 0, y: 0 });
    // Current zoom level [0 = base, 1 = max zoom in]
    const zoom = useRef(0);

    // Extract Blender camera on mount
    useEffect(() => {
        const activeCamera = cameraRef.current;
        if (cameras && cameras.length > 0) {
            const cam = cameras[0] as THREE.PerspectiveCamera;
            scene.updateMatrixWorld(true);

            const worldPos = new THREE.Vector3();
            const worldQuat = new THREE.Quaternion();
            cam.getWorldPosition(worldPos);
            cam.getWorldQuaternion(worldQuat);

            const lookDir = new THREE.Vector3(0, 0, -1).applyQuaternion(
                worldQuat,
            );
            const target = worldPos.clone().add(lookDir.multiplyScalar(10));

            baseState.current = {
                position: worldPos.clone(),
                quaternion: worldQuat.clone(),
                fov: cam.fov,
                target: target.clone(),
            };

            // Apply initial camera
            activeCamera.position.copy(worldPos);
            activeCamera.quaternion.copy(worldQuat);
            if (activeCamera instanceof THREE.PerspectiveCamera) {
                activeCamera.fov = cam.fov;
                activeCamera.near = cam.near;
                activeCamera.far = cam.far;
                activeCamera.aspect = size.width / size.height;
                activeCamera.updateProjectionMatrix();
            }
        }
    }, [cameras, size, scene]);

    // Toggle free view with F key (dev only)
    useEffect(() => {
        if (!isDev) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "f" || e.key === "F") {
                setFreeView((prev) => {
                    const next = !prev;
                    const activeCamera = cameraRef.current;
                    // When exiting free view, restore base camera
                    if (!next && baseState.current) {
                        activeCamera.position.copy(baseState.current.position);
                        activeCamera.quaternion.copy(
                            baseState.current.quaternion,
                        );
                        if (activeCamera instanceof THREE.PerspectiveCamera) {
                            activeCamera.fov = baseState.current.fov;
                            activeCamera.aspect = size.width / size.height;
                            activeCamera.updateProjectionMatrix();
                        }
                        zoom.current = 0;
                    }
                    // When entering free view, sync OrbitControls target
                    if (next && controlsRef.current && baseState.current) {
                        controlsRef.current.target.copy(
                            baseState.current.target,
                        );
                        controlsRef.current.update();
                    }
                    return next;
                });
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [size]);

    // Mouse tracking for default mode
    useEffect(() => {
        if (freeView) return;

        const handleMouseMove = (e: MouseEvent) => {
            mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.current.y = (e.clientY / window.innerHeight) * 2 - 1;
        };

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            // Scroll up = zoom in, scroll down = zoom out
            zoom.current = Math.max(
                0,
                Math.min(1, zoom.current - e.deltaY * 0.001),
            );
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("wheel", handleWheel, { passive: false });
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("wheel", handleWheel);
        };
    }, [freeView]);

    // Animate camera in default mode
    useFrame((state) => {
        if (freeView || !baseState.current) return;
        const cam = state.camera;
        if (!(cam instanceof THREE.PerspectiveCamera)) return;

        const { position, quaternion, fov } = baseState.current;

        // Subtle rotation offset based on mouse — scales up with zoom
        const panScale = 1 + zoom.current * (PAN_ZOOM_MULTIPLIER - 1);
        const panAmount = PAN_AMOUNT * panScale;
        const offsetQuat = new THREE.Quaternion();
        const euler = new THREE.Euler(
            -mouse.current.y * panAmount,
            -mouse.current.x * panAmount,
            0,
            "YXZ",
        );
        offsetQuat.setFromEuler(euler);

        const targetQuat = quaternion.clone().multiply(offsetQuat);
        cam.quaternion.slerp(targetQuat, 0.05);
        cam.position.lerp(position, 0.05);

        // Zoom via FOV
        const targetFov = fov * (1 - zoom.current * (1 - ZOOM_IN_FOV_FACTOR));
        cam.fov += (targetFov - cam.fov) * 0.05;
        cam.updateProjectionMatrix();
    });

    return isDev && freeView ? <OrbitControls ref={controlsRef} /> : null;
}
