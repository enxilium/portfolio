"use client";

import * as THREE from "three";
import { useEffect, useRef, useState } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

const isDev = process.env.NODE_ENV === "development";

// Max rotation offset (radians) for mouse-follow panning
const PAN_AMOUNT = 0.03;
// Zoom range: -1 = max zoom out, 0 = base (Blender camera), 1 = max zoom in
const ZOOM_IN_FOV_FACTOR = 0.5;  // at max zoom-in, FOV = baseFOV * 0.5
const ZOOM_OUT_FOV_FACTOR = 1.4; // at max zoom-out, FOV = baseFOV * 1.4
const ZOOM_SENSITIVITY = 0.0015; // scroll sensitivity
const PAN_ZOOM_MULTIPLIER = 3;   // at max zoom, pan amount is multiplied by this

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
    const invalidate = useThree((state) => state.invalidate);
    const cameraRef = useRef(threeCamera);

    useEffect(() => {
        cameraRef.current = threeCamera;
    }, [threeCamera]);
    const controlsRef = useRef<OrbitControlsImpl>(null);
    // Callback ref to sync OrbitControls target when it mounts
    const setControlsRef = (controls: OrbitControlsImpl | null) => {
        controlsRef.current = controls;
        if (controls && baseState.current) {
            const cam = cameraRef.current;
            controls.target.copy(baseState.current.target);
            controls.object.position.copy(cam.position);
            controls.object.quaternion.copy(cam.quaternion);
            controls.rotateSpeed = 0.5;
            controls.zoomSpeed = 0.8;
            controls.update();
        }
    };

    const [freeView, setFreeView] = useState(false);

    // Store base camera state from Blender
    const baseState = useRef<BaseState | null>(null);

    // Mouse position normalized to [-1, 1]
    const mouse = useRef({ x: 0, y: 0 });
    // Current zoom level [-1 = max zoom out, 0 = base, 1 = max zoom in]
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

            // Compute target distance from scene bounding box center
            const box = new THREE.Box3().setFromObject(scene);
            const sceneCenter = new THREE.Vector3();
            box.getCenter(sceneCenter);
            const distToCenter = worldPos.distanceTo(sceneCenter);
            // Use distance to scene center, fall back to 10 if scene is empty
            const targetDist = distToCenter > 0.1 ? distToCenter : 10;
            const target = worldPos.clone().add(lookDir.multiplyScalar(targetDist));

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
                        const cam = cameraRef.current;
                        controlsRef.current.target.copy(
                            baseState.current.target,
                        );
                        controlsRef.current.object.position.copy(cam.position);
                        controlsRef.current.object.quaternion.copy(cam.quaternion);
                        controlsRef.current.rotateSpeed = 0.5;
                        controlsRef.current.zoomSpeed = 0.8;
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
            invalidate();
        };

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            // Scroll up = zoom in, scroll down = zoom out
            zoom.current = Math.max(
                -1,
                Math.min(1, zoom.current - e.deltaY * ZOOM_SENSITIVITY),
            );
            invalidate();
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("wheel", handleWheel, { passive: false });
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("wheel", handleWheel);
        };
    }, [freeView, invalidate]);

    // Pre-allocated objects reused every frame — avoids GC pressure in the render loop
    const offsetQuat = useRef(new THREE.Quaternion());
    const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
    const targetQuat = useRef(new THREE.Quaternion());

    // Animate camera in default mode
    useFrame((state) => {
        if (freeView || !baseState.current) return;
        const cam = state.camera;
        if (!(cam instanceof THREE.PerspectiveCamera)) return;

        const { position, quaternion, fov } = baseState.current;

        // Subtle rotation offset based on mouse — scales up with zoom
        const panScale = 1 + Math.abs(zoom.current) * (PAN_ZOOM_MULTIPLIER - 1);
        const panAmount = PAN_AMOUNT * panScale;
        euler.current.set(
            -mouse.current.y * panAmount,
            -mouse.current.x * panAmount,
            0,
        );
        offsetQuat.current.setFromEuler(euler.current);

        targetQuat.current.copy(quaternion).multiply(offsetQuat.current);
        cam.quaternion.slerp(targetQuat.current, 0.05);
        cam.position.lerp(position, 0.05);

        // Zoom via FOV — bidirectional around the Blender base FOV
        let targetFov: number;
        if (zoom.current >= 0) {
            // Zoom in: FOV decreases from baseFOV toward baseFOV * ZOOM_IN_FOV_FACTOR
            targetFov = fov * (1 - zoom.current * (1 - ZOOM_IN_FOV_FACTOR));
        } else {
            // Zoom out: FOV increases from baseFOV toward baseFOV * ZOOM_OUT_FOV_FACTOR
            targetFov = fov * (1 + Math.abs(zoom.current) * (ZOOM_OUT_FOV_FACTOR - 1));
        }
        cam.fov += (targetFov - cam.fov) * 0.05;
        cam.updateProjectionMatrix();

        // Invalidate to request next frame (demand mode)
        state.invalidate();
    });

    return isDev && freeView ? <OrbitControls ref={setControlsRef} /> : null;
}
