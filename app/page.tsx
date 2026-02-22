"use client";

import { Canvas } from "@react-three/fiber";
import { Environment, useGLTF } from "@react-three/drei";
import CameraController from "./CameraController";
import PillarAnimation from "./PillarAnimation";

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
    <Canvas>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <directionalLight position={[-5, -5, -5]} intensity={0.3} />
      <Environment preset="studio" />
      <SceneContent />
    </Canvas>
  );
}
