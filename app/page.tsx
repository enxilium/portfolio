"use client";

import { Canvas } from "@react-three/fiber";
import { Clouds, Cloud, Environment, useGLTF } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import CameraController from "./CameraController";
import PillarAnimation from "./PillarAnimation";
import RockAnimation from "./RockAnimation";
import StargateAnimation from "./StargateAnimation";

// Pre-configure the Draco decoder for compressed GLB files
useGLTF.setDecoderPath(
    "https://www.gstatic.com/draco/versioned/decoders/1.5.7/",
);

function SceneContent() {
    const { scene, cameras } = useGLTF("/scene.glb");

    return (
        <>
            
            <ambientLight intensity={0.1} />
            <spotLight
                color="#ffffff"
                angle={1.3}
                penumbra={1.3}
                position={[40, 20, -20]}
                intensity={1200}
                onUpdate={(self) => {
                    self.target.position.set(0, 0, 0);
                }}
            />
            <fog attach="fog" args={["#e0dad5", 40, 120]} />
            
            <CameraController cameras={cameras} scene={scene} />
            <PillarAnimation scene={scene} />
            <RockAnimation scene={scene} />
            <StargateAnimation scene={scene} />
            <primitive object={scene} />
            <EffectComposer enableNormalPass={false}>
                <Bloom
                    luminanceThreshold={0.8}
                    luminanceSmoothing={0}
                    mipmapBlur
                    intensity={1.2}
                />
            </EffectComposer>
        </>
    );
}

export default function Scene() {
    return (
        <div className="relative h-screen w-screen">
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
                <Environment files="/overcast_soil_puresky_4k.hdr" background environmentIntensity={0.1} />
                <SceneContent />
            </Canvas>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <h1 className="flex align-middle justify-center text-3xl tracking-[30px] text-black w-max" style={{ fontFamily: "'Avenir', 'Avenir Next', sans-serif" }}>
                    JACEY CHU'S PORTFOLIO
                </h1>
            </div>
        </div>
    );
}
