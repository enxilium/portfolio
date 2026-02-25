"use client";

import * as THREE from "three";
import { useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Stars, useGLTF } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import CameraController from "./CameraController";
import PillarAnimation from "./PillarAnimation";
import RockAnimation from "./RockAnimation";
import StargateAnimation from "./StargateAnimation";
import DayNightController from "./DayNightController";
import RainEffect from "./RainEffect";
import LightningEffect from "./LightningEffect";
import ControlPanel from "./ControlPanel";
import AudioManager from "./AudioManager";
import OnboardingOverlay from "./OnboardingOverlay";
import IntroSequence from "./IntroSequence";
import ScrambleTitle from "./ScrambleTitle";
import StargateActivation from "./StargateActivation";
import PostStargateScene from "./PostStargateScene";
import PillarTooltip from "./PillarTooltip";

// Pre-configure the Draco decoder for compressed GLB files
useGLTF.setDecoderPath(
    "https://www.gstatic.com/draco/versioned/decoders/1.5.7/",
);

// ── Bloom wrapper that reads intensity from a ref each frame ──
interface DynamicBloomProps {
    intensityRef: React.MutableRefObject<number>;
}

function DynamicBloom({ intensityRef }: DynamicBloomProps) {
    const bloomRef = useRef<{ intensity: number } | null>(null);

    useFrame(() => {
        if (bloomRef.current) {
            bloomRef.current.intensity = intensityRef.current;
        }
    });

    return (
        <Bloom
            ref={bloomRef}
            luminanceThreshold={0.8}
            luminanceSmoothing={0}
            mipmapBlur
            intensity={1.2}
        />
    );
}

// ── Stars wrapper that fades based on scene.userData.starsOpacity ──
function NightStars() {
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (!groupRef.current) return;
        const opacity = (state.scene.userData.starsOpacity as number) ?? 0;
        groupRef.current.visible = opacity > 0.01;
        // Drei Stars uses PointsMaterial — scale opacity via material
        groupRef.current.traverse((child) => {
            if (child instanceof THREE.Points) {
                const mat = child.material as THREE.PointsMaterial;
                mat.opacity = opacity;
                mat.transparent = true;
            }
        });
    });

    return (
        <group ref={groupRef}>
            <Stars
                radius={200}
                depth={80}
                count={4000}
                factor={6}
                fade
                speed={0.5}
            />
        </group>
    );
}

function SceneContent() {
    const { scene, cameras } = useGLTF("/scene.glb");

    // Signal scene readiness to the store on mount
    const readyFired = useRef(false);
    if (!readyFired.current) {
        readyFired.current = true;
        // useGLTF suspends until loaded — if we reach here, the scene is ready
        // Schedule after render to avoid setState-during-render
        setTimeout(() => {
            const { default: useStore } = require("./store");
            useStore.getState().setSceneReady(true);
        }, 0);
    }

    // Refs for lights and fog — passed to DayNightController for animated transitions
    const ambientRef = useRef<THREE.AmbientLight>(null);
    const spotRef = useRef<THREE.SpotLight>(null);
    const fogRef = useRef<THREE.Fog>(null);
    // Bloom intensity communicated via ref (avoids re-renders)
    const bloomIntensityRef = useRef(1.2);

    return (
        <>
            <ambientLight ref={ambientRef} intensity={0.1} />
            <spotLight
                ref={spotRef}
                color="#ffffff"
                angle={1.3}
                penumbra={1.3}
                position={[40, 20, -20]}
                intensity={1200}
                onUpdate={(self) => {
                    self.target.position.set(0, 0, 0);
                }}
            />
            <fog ref={fogRef} attach="fog" args={["#e0dad5", 40, 120]} />

            <DayNightController
                ambientRef={ambientRef}
                spotRef={spotRef}
                fogRef={fogRef}
                bloomIntensityRef={bloomIntensityRef}
            />

            <CameraController cameras={cameras} scene={scene} />
            <PillarAnimation scene={scene} />
            <RockAnimation scene={scene} />
            <StargateAnimation scene={scene} />
            <primitive object={scene} />

            <NightStars />
            <LightningEffect />

            <EffectComposer enableNormalPass={false}>
                <DynamicBloom intensityRef={bloomIntensityRef} />
            </EffectComposer>
        </>
    );
}

// ── Notifies parent when the GLB scene finishes loading ──
// (Removed — scene readiness is now signaled via the store from SceneContent)

// ── Orchestrator: reads store to conditionally render overlays ──
function Overlays() {
    // Lazy-import store so it doesn't touch the page default export
    const useStore = require("./store").default;
    const introComplete = useStore(
        (s: { introComplete: boolean }) => s.introComplete,
    );
    const sceneTransitioned = useStore(
        (s: { sceneTransitioned: boolean }) => s.sceneTransitioned,
    );

    return (
        <>
            {/* Scramble-reveal title (replaces old PortfolioTitle) */}
            <ScrambleTitle active={introComplete && !sceneTransitioned} />

            {/* Onboarding hints */}
            {introComplete && !sceneTransitioned && <OnboardingOverlay />}

            {/* Detroit-style pillar hover tooltips */}
            {introComplete && !sceneTransitioned && <PillarTooltip />}

            {/* Stargate activation overlay (dust, shake, glow, flash) */}
            {introComplete && !sceneTransitioned && (
                <StargateActivation
                    onTransitionComplete={() => {
                        useStore.getState().setSceneTransitioned(true);
                    }}
                />
            )}

            {/* Post-stargate placeholder scene */}
            {sceneTransitioned && <PostStargateScene />}
        </>
    );
}

// ── Intro wrapper: reads store for sceneReady ──
function IntroWrapper() {
    const useStore = require("./store").default;
    const introComplete = useStore(
        (s: { introComplete: boolean }) => s.introComplete,
    );
    const sceneReady = useStore((s: { sceneReady: boolean }) => s.sceneReady);

    if (introComplete) return null;

    return (
        <IntroSequence
            onComplete={() => {
                useStore.getState().setIntroComplete(true);
            }}
            sceneReady={sceneReady}
        />
    );
}

export default function Scene() {
    return (
        <div className="relative h-screen w-screen overflow-hidden scene-root">
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
                <Suspense fallback={null}>
                    <Environment
                        files="/overcast_soil_puresky_4k.hdr"
                        background
                        environmentIntensity={0.1}
                    />
                    <SceneContent />
                </Suspense>
            </Canvas>

            {/* Intro boot sequence */}
            <IntroWrapper />

            {/* All other overlays driven by store state */}
            <Overlays />

            <RainEffect />
            <ControlPanel />
            <AudioManager />
        </div>
    );
}
