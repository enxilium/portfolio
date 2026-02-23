"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import CameraController from "./CameraController";
import PillarAnimation from "./PillarAnimation";

// Pre-configure the Draco decoder for compressed GLB files
useGLTF.setDecoderPath(
    "https://www.gstatic.com/draco/versioned/decoders/1.5.7/",
);

function SceneContent() {
    const { scene, cameras } = useGLTF("/scene.glb");

    return (
        <>
            <CameraController cameras={cameras} scene={scene} />
            <PillarAnimation scene={scene} />
            <primitive object={scene} />
        </>
    );
}

export default function Scene() {
    return (
        <Canvas
            // Cap pixel ratio at 1.5 for integrated GPUs — visually close to 2x at half the fill cost
            dpr={[1, 1.5]}
            // Only re-render when something invalidates — saves GPU cycles when scene is idle
            frameloop="demand"
            gl={{
                // Power preference hint for GPU selection on dual-GPU laptops
                powerPreference: "high-performance",
            }}
        >
            <Environment preset="studio" environmentIntensity={0.1} />
            <SceneContent />
        </Canvas>
    );
}
