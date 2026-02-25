"use client";

import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import useStore from "./store";

// Max rotation offset (radians) for mouse-follow panning
const PAN_AMOUNT = 0.03;
// Zoom range: -1 = max zoom out, 0 = base (Blender camera), 1 = max zoom in
const ZOOM_IN_FOV_FACTOR = 0.5; // at max zoom-in, FOV = baseFOV * 0.5
const ZOOM_OUT_FOV_FACTOR = 1.4; // at max zoom-out, FOV = baseFOV * 1.4
const ZOOM_SENSITIVITY = 0.0015; // scroll sensitivity
const PAN_ZOOM_MULTIPLIER = 3; // at max zoom, pan amount is multiplied by this

// Smoothing factor for camera return transition (higher = faster)
const RETURN_LERP_FACTOR = 0.05;
// Threshold below which we consider the camera "arrived" at the base state
const RETURN_THRESHOLD = 0.001;

// Smoothing factor for pillar focus transitions
const FOCUS_LERP_FACTOR = 0.04;
// Threshold below which we consider pillar focus transition complete
const FOCUS_THRESHOLD = 0.01;

// Camera targets when focused on each pillar (captured from free-view)
const PILLAR_FOCUS = {
    left: {
        position: new THREE.Vector3(
            -32.46085307117368,
            7.700729158659538,
            -48.44703406077957,
        ),
        quaternion: new THREE.Quaternion(
            -0.045919588276593926,
            -0.41075282465792323,
            -0.020718975869243785,
            0.910353905075919,
        ),
        fov: 22.39941157626373,
    },
    right: {
        position: new THREE.Vector3(
            23.725313675202692,
            1.4904973660855205,
            -40.86229859862971,
        ),
        quaternion: new THREE.Quaternion(
            0.050045628119405286,
            0.36597066442481785,
            -0.019713497174963058,
            0.9290706571169516,
        ),
        fov: 22.39941157626373,
    },
} as const;

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

    const freeView = useStore((s) => s.freeView);
    const setFreeView = useStore((s) => s.setFreeView);
    const setIsDragging = useStore((s) => s.setIsDragging);
    const focusedPillar = useStore((s) => s.focusedPillar);

    // Store base camera state from Blender
    const baseState = useRef<BaseState | null>(null);

    // Mouse position normalized to [-1, 1]
    const mouse = useRef({ x: 0, y: 0 });
    // Current zoom level [-1 = max zoom out, 0 = base, 1 = max zoom in]
    const zoom = useRef(0);
    // Whether we are smoothly transitioning back from free view to base state
    const returning = useRef(false);
    // Track previous focusedPillar to detect transitions
    const prevFocused = useRef<"left" | "right" | null>(null);

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
            const target = worldPos
                .clone()
                .add(lookDir.multiplyScalar(targetDist));

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

    // Toggle free view with F key, print camera data with P key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "f" || e.key === "F") {
                setFreeView(!freeView);
                // When exiting free view, start smooth return (don't snap)
                if (freeView && baseState.current) {
                    returning.current = true;
                    zoom.current = 0;
                }
                // When entering free view, sync OrbitControls target
                if (!freeView && controlsRef.current && baseState.current) {
                    const cam = cameraRef.current;
                    controlsRef.current.target.copy(baseState.current.target);
                    controlsRef.current.object.position.copy(cam.position);
                    controlsRef.current.object.quaternion.copy(cam.quaternion);
                    controlsRef.current.rotateSpeed = 0.5;
                    controlsRef.current.zoomSpeed = 0.8;
                    controlsRef.current.update();
                }
            }

            // DEV: Print camera position, quaternion, and FOV to console
            if ((e.key === "p" || e.key === "P") && freeView) {
                const cam = cameraRef.current;
                const pos = cam.position;
                const quat = cam.quaternion;
                const fov =
                    cam instanceof THREE.PerspectiveCamera ? cam.fov : "N/A";
                const target = controlsRef.current?.target;
                console.log("=== CAMERA DATA ===");
                console.log(
                    `Position: { x: ${pos.x}, y: ${pos.y}, z: ${pos.z} }`,
                );
                console.log(
                    `Quaternion: { x: ${quat.x}, y: ${quat.y}, z: ${quat.z}, w: ${quat.w} }`,
                );
                console.log(`FOV: ${fov}`);
                if (target) {
                    console.log(
                        `OrbitControls Target: { x: ${target.x}, y: ${target.y}, z: ${target.z} }`,
                    );
                }
                console.log("===================");
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [size, freeView, setFreeView]);

    // Track OrbitControls drag start/end → push to store
    useEffect(() => {
        const controls = controlsRef.current;
        if (!controls || !freeView) return;

        const onStart = () => setIsDragging(true);
        const onEnd = () => setIsDragging(false);

        controls.addEventListener("start", onStart);
        controls.addEventListener("end", onEnd);

        return () => {
            controls.removeEventListener("start", onStart);
            controls.removeEventListener("end", onEnd);
            setIsDragging(false);
        };
    }, [freeView, setIsDragging]);

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
    const focusTargetPos = useRef(new THREE.Vector3());
    const focusTargetQuat = useRef(new THREE.Quaternion());

    // Animate camera in default mode (and smooth return from free view)
    useFrame((state) => {
        if (freeView || !baseState.current) return;
        const cam = state.camera;
        if (!(cam instanceof THREE.PerspectiveCamera)) return;

        const { position, quaternion, fov } = baseState.current;

        // ── Pillar focus transition ──
        if (focusedPillar) {
            const target = PILLAR_FOCUS[focusedPillar];
            focusTargetPos.current.copy(target.position);
            focusTargetQuat.current.set(
                target.quaternion.x,
                target.quaternion.y,
                target.quaternion.z,
                target.quaternion.w,
            );

            cam.position.lerp(focusTargetPos.current, FOCUS_LERP_FACTOR);
            cam.quaternion.slerp(focusTargetQuat.current, FOCUS_LERP_FACTOR);
            cam.fov += (target.fov - cam.fov) * FOCUS_LERP_FACTOR;
            cam.updateProjectionMatrix();

            prevFocused.current = focusedPillar;
            state.invalidate();
            return;
        }

        // ── Returning from pillar focus → base state ──
        if (prevFocused.current && !focusedPillar) {
            cam.position.lerp(position, RETURN_LERP_FACTOR);
            cam.quaternion.slerp(quaternion, RETURN_LERP_FACTOR);
            cam.fov += (fov - cam.fov) * RETURN_LERP_FACTOR;
            cam.updateProjectionMatrix();

            const positionDelta = cam.position.distanceTo(position);
            const angleDelta = cam.quaternion.angleTo(quaternion);
            if (
                positionDelta < FOCUS_THRESHOLD &&
                angleDelta < FOCUS_THRESHOLD
            ) {
                cam.position.copy(position);
                cam.quaternion.copy(quaternion);
                cam.fov = fov;
                cam.updateProjectionMatrix();
                prevFocused.current = null;
                zoom.current = 0;
            }

            state.invalidate();
            return;
        }

        // If returning from free view, interpolate back to base state first
        if (returning.current) {
            cam.position.lerp(position, RETURN_LERP_FACTOR);
            cam.quaternion.slerp(quaternion, RETURN_LERP_FACTOR);
            cam.fov += (fov - cam.fov) * RETURN_LERP_FACTOR;
            cam.updateProjectionMatrix();

            // Check if we've arrived close enough to the base state
            const positionDelta = cam.position.distanceTo(position);
            const angleDelta = cam.quaternion.angleTo(quaternion);
            if (
                positionDelta < RETURN_THRESHOLD &&
                angleDelta < RETURN_THRESHOLD
            ) {
                cam.position.copy(position);
                cam.quaternion.copy(quaternion);
                cam.fov = fov;
                cam.updateProjectionMatrix();
                returning.current = false;
            }

            state.invalidate();
            return;
        }

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
            targetFov =
                fov * (1 + Math.abs(zoom.current) * (ZOOM_OUT_FOV_FACTOR - 1));
        }
        cam.fov += (targetFov - cam.fov) * 0.05;
        cam.updateProjectionMatrix();

        // Invalidate to request next frame (demand mode)
        state.invalidate();
    });

    return freeView ? <OrbitControls ref={setControlsRef} /> : null;
}
